/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { In } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import ms from 'ms';
import type Redis from 'ioredis';
import type { DriveFilesRepository, FollowingsRepository, MiMeta, NoteFavoritesRepository, NoteReactionsRepository, NotesRepository } from '@/models/_.js';
import type { MiLocalUser } from '@/models/User.js';
import { DI } from '@/di-symbols.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { QueryService } from '@/core/QueryService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { IdService } from '@/core/IdService.js';
import { shouldHideNoteByTime } from '@/misc/should-hide-note-by-time.js';

type Settings = {
	candidatePoolLimit: number;
	candidateScanLimit: number;
	resultLimit: number;
	snapshotHours: number;
	seenDays: number;
	seenLimit: number;
	reactionAffinityPercent: number;
	followingPercent: number;
	unknownPercent: number;
	qualityPercent: number;
	balancedPercent: number;
	freshPercent: number;
	maxNotesPerAuthor: number;
	publicBonus: number;
	localUserBonus: number;
	followingBonus: number;
	reactionAffinityBonus: number;
	reactionBonus: number;
	boostBonus: number;
	sensitivePenalty: number;
	botPenalty: number;
	negativePenalty: number;
	minimumScore: number;
	fallbackMaxAgeDays: number;
	forcedLimit: number;
	forcedAccounts: string[];
	negativeWords: string[];
	boostWords: string[];
	negativeAccounts: string[];
};

const defaults: Settings = {
	candidatePoolLimit: 3000,
	candidateScanLimit: 300,
	// Keep the first request deliberately small. Older entries are appended only
	// when the reader reaches the end of the fixed snapshot.
	resultLimit: 40,
	snapshotHours: 24,
	seenDays: 7,
	seenLimit: 10000,
	reactionAffinityPercent: 60,
	followingPercent: 20,
	unknownPercent: 20,
	qualityPercent: 50,
	balancedPercent: 30,
	freshPercent: 20,
	maxNotesPerAuthor: 2,
	publicBonus: 2,
	localUserBonus: 2,
	followingBonus: 4,
	reactionAffinityBonus: 5,
	reactionBonus: 1,
	boostBonus: 4,
	sensitivePenalty: 6,
	botPenalty: 3,
	negativePenalty: 8,
	minimumScore: 0,
	fallbackMaxAgeDays: 90,
	forcedLimit: 3,
	forcedAccounts: [],
	negativeWords: [],
	boostWords: [],
	negativeAccounts: [],
};

// Increment when the ranking/seen semantics change so previously generated
// snapshots and stale seen records cannot hide the corrected result set.
const recommendationCacheVersion = 'v25';
const previousRecommendationCacheVersion = 'v18';

type RecommendationContext = {
	followingIds: string[];
	reactionAffinity: Array<[string, number]>;
	favoriteAffinity: Array<[string, number]>;
	renoteAffinity: Array<[string, number]>;
};

export const meta = {
	tags: ['notes'],
	requireCredential: true,
	kind: 'read:account',

	// A recommendation snapshot can perform several bounded database queries.
	// Keep ordinary paging responsive, while preventing a client from creating
	// an unlimited number of fresh snapshots in a short period.
	limit: {
		duration: ms('1minute'),
		max: 60,
	},
	errors: {
		featureDisabled: {
			message: 'Recommended timeline is disabled.',
			code: 'FEATURE_DISABLED',
			id: '871d7f45-09fc-42ab-9060-9fd05d8f38dd',
		},
		notAllowed: {
			message: 'Recommended timeline is not available for this user.',
			code: 'FEATURE_NOT_AVAILABLE',
			id: 'bd49fd24-aae2-482f-93ea-f62fa0c878b8',
		},
	},
	res: {
		type: 'array', optional: false, nullable: false,
		items: { type: 'object', optional: false, nullable: false, ref: 'Note' },
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		untilId: { type: 'string', format: 'misskey:id' },
		snapshotId: { type: 'string', minLength: 8, maxLength: 128 },
		previousSnapshotId: { type: 'string', minLength: 8, maxLength: 128 },
		previousIncludeFollowing: { type: 'boolean', default: true },
		includeFollowing: { type: 'boolean', default: true },
		withFiles: { type: 'boolean', default: false },
		withRenotes: { type: 'boolean', default: true },
		withSensitive: { type: 'boolean', default: true },
	},
	required: ['snapshotId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.meta) private serverSettings: MiMeta,
		@Inject(DI.notesRepository) private notesRepository: NotesRepository,
		@Inject(DI.followingsRepository) private followingsRepository: FollowingsRepository,
		@Inject(DI.driveFilesRepository) private driveFilesRepository: DriveFilesRepository,
		@Inject(DI.noteReactionsRepository) private noteReactionsRepository: NoteReactionsRepository,
		@Inject(DI.noteFavoritesRepository) private noteFavoritesRepository: NoteFavoritesRepository,
		@Inject(DI.redis) private redisClient: Redis.Redis,
		@Inject(DI.redisForTimelines) private redisForTimelines: Redis.Redis,
		private queryService: QueryService,
		private noteEntityService: NoteEntityService,
		private idService: IdService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!this.serverSettings.enableRecommendedTimeline) throw new ApiError(meta.errors.featureDisabled);
			const allowedUserIds = this.serverSettings.recommendedTimelineAllowedUserIds ?? [];
			if (allowedUserIds.length > 0 && !allowedUserIds.includes(me.id)) throw new ApiError(meta.errors.notAllowed);
			const settings = this.settings();
			// A request may inspect several candidate windows. Load the potentially large
			// seen set once and share it across ranking and response filtering.
			const requestSeen = new Set(await this.loadSeenIds(me.id, settings));
			// Home-eligible notes are always scored as recommendation candidates. Keep
			// accepting the former request parameters for older clients, but never let
			// them create a separate discovery-only result set.
			const resultKey = `torikago:recommended:${recommendationCacheVersion}:snapshot:${me.id}:${ps.snapshotId}:home`;
			const personalizedProgressKey = `torikago:recommended:${recommendationCacheVersion}:personalized-progress:${me.id}`;
			const snapshotReadyKey = `${resultKey}:ready`;
			const relationshipVersionKey = `torikago:recommended:relationship-version:${me.id}`;
			const [cachedResultIds, cachedSnapshotReady, snapshotRelationshipVersion, relationshipVersionValue] = await Promise.all([
				this.redisClient.lrange(resultKey, 0, -1),
				this.redisClient.exists(snapshotReadyKey),
				this.redisClient.get(`${resultKey}:relationship-version`),
				this.redisClient.get(relationshipVersionKey),
			]);
			const relationshipVersion = relationshipVersionValue ?? '0';
			const relationshipChanged = cachedSnapshotReady !== 0 && (snapshotRelationshipVersion ?? '0') !== relationshipVersion;
			const snapshotReady = relationshipChanged ? 0 : cachedSnapshotReady;
			let resultIds = relationshipChanged ? [] : cachedResultIds;
			if (snapshotReady === 0) {
				// The host has a known midnight load spike. Do not make a reader wait
				// for a fresh ranking if the browser already has a usable snapshot:
				// carry that fixed snapshot forward instead. Returning an empty array
				// here used to render "No notes" for every reader during the protected window.
				const latestSnapshotKey = `torikago:recommended:${recommendationCacheVersion}:latest-snapshot:${me.id}:renotes:${ps.withRenotes ? '1' : '0'}`;
				// An explicit in-app refresh supplies the preceding ID. A browser reload
				// cannot, so remember the last compatible snapshot server-side as well.
				const previousSnapshotId = ps.previousSnapshotId ?? await this.redisClient.get(latestSnapshotKey);
				const previousResultKey = previousSnapshotId == null || previousSnapshotId === ps.snapshotId ? null : `torikago:recommended:${recommendationCacheVersion}:snapshot:${me.id}:${previousSnapshotId}:home`;
				const previousReadyKey = previousResultKey == null ? null : `${previousResultKey}:ready`;
				const [previousResultIds, previousSnapshotReady, previousRelationshipVersion, previousWithRenotes] = previousResultKey == null || previousReadyKey == null ? [[], 0, null, null] : await Promise.all([
					this.redisClient.lrange(previousResultKey, 0, -1),
					this.redisClient.exists(previousReadyKey),
					this.redisClient.get(`${previousResultKey}:relationship-version`),
					this.redisClient.get(`${previousResultKey}:with-renotes`),
				]);
				const previousSnapshotCompatible = previousSnapshotReady !== 0 && (previousRelationshipVersion ?? '0') === relationshipVersion && previousWithRenotes === (ps.withRenotes ? '1' : '0');
				if (this.isMidnightProtectionWindow() && previousResultKey != null && previousSnapshotCompatible) {
					const previousSeenIds = await this.redisClient.smembers(`${previousResultKey}:seen`);
					const pipeline = this.redisClient.pipeline().del(resultKey, `${resultKey}:seen`, snapshotReadyKey);
					if (previousResultIds.length > 0) pipeline.rpush(resultKey, ...previousResultIds);
					pipeline.expire(resultKey, settings.snapshotHours * 3600);
					pipeline.set(snapshotReadyKey, '1', 'EX', settings.snapshotHours * 3600);
					pipeline.set(`${resultKey}:candidate-cursor`, '0', 'EX', settings.snapshotHours * 3600);
					pipeline.set(`${resultKey}:personalized-cursor`, '0', 'EX', settings.snapshotHours * 3600);
					pipeline.set(`${resultKey}:version`, (await this.redisForTimelines.get('torikago:recommended:version')) ?? '0', 'EX', settings.snapshotHours * 3600);
					pipeline.set(`${resultKey}:relationship-version`, relationshipVersion, 'EX', settings.snapshotHours * 3600);
					pipeline.set(`${resultKey}:with-renotes`, ps.withRenotes ? '1' : '0', 'EX', settings.snapshotHours * 3600);
					pipeline.set(latestSnapshotKey, ps.snapshotId, 'EX', settings.snapshotHours * 3600);
					if (previousSeenIds.length > 0) pipeline.sadd(`${resultKey}:seen`, ...previousSeenIds);
					pipeline.expire(`${resultKey}:seen`, settings.snapshotHours * 3600);
					await pipeline.exec();
					resultIds = previousResultIds;
				} else {
					// A first-time reader has no snapshot to reuse. Generate one rather
					// than presenting an empty timeline; this is request-driven, not a
					// midnight-wide background job.
					const progressKey = `torikago:recommended:${recommendationCacheVersion}:candidate-progress:${me.id}`;
					const savedCursor = Math.max(1, Number(await this.redisClient.get(progressKey) ?? '1'));
					const savedPersonalizedCursor = Math.max(0, Number(await this.redisClient.get(personalizedProgressKey) ?? '0'));
					// Always inspect the newest window, then resume older per-user windows only
					// until there is enough content to make the initial view scrollable.
					// Candidate ranges remain bounded; candidate IDs are combined before one
					// indexed hydration query instead of repeating the expensive joins.
					// Keep a small part of the preceding snapshot that has not actually been
					// delivered yet. Refresh used to throw these candidates away, rescan the
					// same newest window, and rapidly exhaust quiet accounts.
					const canReusePrevious = previousSnapshotCompatible;
					const reusablePreviousIds = canReusePrevious ? previousResultIds.slice(0, Math.min(settings.resultLimit, ps.limit * 4)) : [];
					// The newest window finds newly arrived notes. The resumed window may cover
					// several inexpensive Redis-ID ranges so sparse/minimum-score-filtered pools
					// still produce a scrollable page without one joined query per range.
					const windows = [{ cursor: 0, count: 1 }, { cursor: savedCursor, count: 3 }]
						.filter((window, index, items) => items.findIndex(other => other.cursor === window.cursor) === index);
					const selectedTargets = new Set<string>();
					const selectedAuthorCounts = new Map<string, number>();
					let nextCursor = savedCursor;
					let nextPersonalizedCursor = savedPersonalizedCursor;
					resultIds = reusablePreviousIds;
					if (resultIds.length > 0) {
						const reusableNotes = await this.notesRepository.find({ select: { id: true, userId: true, renoteId: true, text: true, cw: true }, where: { id: In(resultIds) } });
						const reusableById = new Map(reusableNotes.map(note => [note.id, note]));
						resultIds = resultIds.filter(id => {
							const note = reusableById.get(id);
							return note != null && !requestSeen.has(this.targetId(note));
						});
						for (const note of reusableNotes.filter(note => resultIds.includes(note.id))) {
							selectedTargets.add(note.id);
							selectedAuthorCounts.set(note.userId, (selectedAuthorCounts.get(note.userId) ?? 0) + 1);
						}
					}
					for (const [cursorIndex, window] of windows.entries()) {
						const { cursor, count } = window;
						const remaining = settings.resultLimit - resultIds.length;
						if (remaining <= 0 || resultIds.length >= Math.min(15, settings.resultLimit)) break;
						// Home and affinity queries are the expensive part for accounts with
						// many followings. Fetch them once; the second pass only backfills from the
						// shared candidate pool. Further personalised pages are loaded on scroll.
						const includePersonalizedSources = cursorIndex === 0;
						const extraIds = await this.buildRecommendation(me, settings, selectedTargets, cursor * settings.candidateScanLimit, remaining, `${ps.snapshotId}:${cursor}`, selectedAuthorCounts, ps.withRenotes, includePersonalizedSources, requestSeen, nextPersonalizedCursor, count);
						if (includePersonalizedSources) nextPersonalizedCursor += this.personalizedCursorAdvance(settings, remaining);
						for (const id of extraIds) {
							if (!selectedTargets.has(id)) resultIds.push(id);
						}
						if (extraIds.length > 0) {
							const selectedNotes = await this.notesRepository.find({ select: { id: true, userId: true }, where: { id: In(resultIds) } });
							selectedTargets.clear();
							selectedAuthorCounts.clear();
							for (const note of selectedNotes) {
								selectedTargets.add(note.id);
								selectedAuthorCounts.set(note.userId, (selectedAuthorCounts.get(note.userId) ?? 0) + 1);
							}
						}
						if (cursor > 0) nextCursor = cursor + count;
					}
					resultIds = await this.spreadSnapshotAuthors(resultIds, ps.snapshotId);
					const pipeline = this.redisClient.pipeline().del(resultKey, `${resultKey}:seen`, snapshotReadyKey);
					if (resultIds.length > 0) pipeline.rpush(resultKey, ...resultIds);
					pipeline.expire(resultKey, settings.snapshotHours * 3600);
					// The marker deliberately exists even for an empty list. Otherwise an
					// empty result is mistaken for a cache miss and rebuilt on every reload.
					pipeline.set(snapshotReadyKey, '1', 'EX', settings.snapshotHours * 3600);
					pipeline.set(`${resultKey}:candidate-cursor`, String(nextCursor), 'EX', settings.snapshotHours * 3600);
					pipeline.set(`${resultKey}:personalized-cursor`, String(nextPersonalizedCursor), 'EX', settings.snapshotHours * 3600);
					pipeline.set(progressKey, String(nextCursor), 'EX', settings.seenDays * 86400);
					pipeline.set(personalizedProgressKey, String(nextPersonalizedCursor), 'EX', settings.seenDays * 86400);
					pipeline.set(`${resultKey}:version`, (await this.redisForTimelines.get('torikago:recommended:version')) ?? '0', 'EX', settings.snapshotHours * 3600);
					pipeline.set(`${resultKey}:relationship-version`, relationshipVersion, 'EX', settings.snapshotHours * 3600);
					pipeline.set(`${resultKey}:with-renotes`, ps.withRenotes ? '1' : '0', 'EX', settings.snapshotHours * 3600);
					pipeline.set(latestSnapshotKey, ps.snapshotId, 'EX', settings.snapshotHours * 3600);
					await pipeline.exec();
				}
			}

			// Cache version v8 only creates snapshots after target-note de-duplication,
			// so an extra DB pass to repair legacy snapshot lists is no longer needed.
			const offset = ps.untilId == null ? 0 : Math.max(0, resultIds.indexOf(ps.untilId) + 1);
			let pageIds = resultIds.slice(offset, offset + ps.limit * 8);
			// Reaching the end of a snapshot is the only time scrolling performs more
			// ranking. The existing IDs remain fixed, so the reader never sees items
			// move or duplicate while loading older entries.
			if (ps.untilId != null && pageIds.length < ps.limit) {
				const existingNotes = resultIds.length === 0 ? [] : await this.notesRepository.find({ select: { id: true, renoteId: true, userId: true, text: true, cw: true }, where: { id: In(resultIds) } });
				const existingTargets = new Set(existingNotes.map(note => this.targetId(note)));
				const existingAuthorCounts = new Map<string, number>();
				for (const note of existingNotes) {
					existingAuthorCounts.set(note.userId, (existingAuthorCounts.get(note.userId) ?? 0) + 1);
				}
				const cursorKey = `${resultKey}:candidate-cursor`;
				const personalizedCursorKey = `${resultKey}:personalized-cursor`;
				let cursor = Number(await this.redisClient.get(cursorKey) ?? '0');
				let personalizedCursor = Number(await this.redisClient.get(personalizedCursorKey) ?? '0');
				const batchSize = Math.min(60, Math.max(ps.limit * 2, 30));
				// A sparse candidate window must not make scrolling stop permanently.
				// Try a few bounded windows and persist progress even when none produce
				// a displayable note, so the next request continues farther back.
				for (let attempt = 0; attempt < 2 && pageIds.length < ps.limit; attempt++) {
					const includePersonalizedSources = attempt === 0;
					const candidateWindowCount = attempt === 0 ? 1 : 3;
					const builtExtraIds = await this.buildRecommendation(me, settings, existingTargets, Math.max(0, cursor) * settings.candidateScanLimit, batchSize, ps.snapshotId, existingAuthorCounts, ps.withRenotes, includePersonalizedSources, requestSeen, personalizedCursor, candidateWindowCount);
					const extraIds = await this.spreadSnapshotAuthors(builtExtraIds, `${ps.snapshotId}:page:${cursor}`, resultIds.at(-1));
					// Multiple widgets or Deck columns may share this snapshot. Append only
					// when its length is unchanged, so concurrent end-of-list requests can
					// never append the same ranking batch twice.
					const appended = await this.redisClient.eval(`
						if redis.call('LLEN', KEYS[1]) ~= tonumber(ARGV[1]) then return 0 end
						if #ARGV > 5 then redis.call('RPUSH', KEYS[1], unpack(ARGV, 6)) end
						redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
						if tonumber(ARGV[4]) == 1 then redis.call('SET', KEYS[3], ARGV[5], 'EX', ARGV[3]) end
						redis.call('EXPIRE', KEYS[1], ARGV[3])
						return 1
					`, 3, resultKey, cursorKey, personalizedCursorKey, String(resultIds.length), String(cursor + candidateWindowCount), String(settings.snapshotHours * 3600), includePersonalizedSources ? '1' : '0', String(personalizedCursor + this.personalizedCursorAdvance(settings, batchSize)), ...extraIds);
					if (appended === 1) {
						resultIds.push(...extraIds);
						cursor += candidateWindowCount;
						if (includePersonalizedSources) {
							personalizedCursor += this.personalizedCursorAdvance(settings, batchSize);
							await this.redisClient.set(personalizedProgressKey, String(personalizedCursor), 'EX', settings.seenDays * 86400);
						}
					} else {
						resultIds = await this.redisClient.lrange(resultKey, 0, -1);
						break;
					}
					pageIds = resultIds.slice(offset, offset + ps.limit * 8);
				}
			}
			if (pageIds.length === 0) return [];
			const notes = await this.notesRepository.find({
				where: { id: In(pageIds) },
				relations: { user: true, reply: { user: true }, renote: { user: true } },
			});
			const files = await this.driveFilesRepository.find({
				select: { id: true, isSensitive: true },
				where: { id: In([...new Set(notes.flatMap(note => [...note.fileIds, ...(note.renote?.fileIds ?? [])]))]) },
			});
			const sensitiveFileIds = new Set(files.filter(file => file.isSensitive).map(file => file.id));
			const noteMap = new Map(notes.map(note => [note.id, note]));
			const snapshotSeenIds = await this.redisClient.smembers(`${resultKey}:seen`);
			const snapshotSeen = new Set(snapshotSeenIds);
			const globallySeen = requestSeen;
			const pageTargets = new Set<string>();
			// A fixed snapshot is a candidate list, not a permission to replay notes.
			// Treat both snapshot-local and cross-snapshot history as exclusions; the
			// final atomic claim below closes the race between concurrent requests.
			const ordered = pageIds.map(id => noteMap.get(id)).filter(note => note != null)
				.filter(note => {
					const targetId = this.targetId(note);
					return !snapshotSeen.has(targetId) && !globallySeen.has(targetId);
				})
				.filter(note => !this.isPastVisibilityDeadline(note))
				.filter(note => ps.withFiles !== true || [...note.fileIds, ...(note.renote?.fileIds ?? [])].length > 0)
				.filter(note => ps.withSensitive || ![...note.fileIds, ...(note.renote?.fileIds ?? [])].some(id => sensitiveFileIds.has(id)))
				.filter(note => {
					const targetId = this.targetId(note);
					if (pageTargets.has(targetId)) return false;
					pageTargets.add(targetId);
					return true;
				}).slice(0, ps.limit);
			const claimedTargetIds = new Set(await this.claimUnseen(me.id, resultKey, ordered.map(note => this.targetId(note)), settings));
			return await this.noteEntityService.packMany(ordered.filter(note => claimedTargetIds.has(this.targetId(note))), me);
		});
	}

	private isMidnightProtectionWindow(): boolean {
		const now = new Date();
		return now.getHours() === 0 && now.getMinutes() < 1;
	}

	private settings(): Settings {
		const raw = this.serverSettings.recommendedTimelineSettings ?? {};
		const integer = (key: keyof Settings, min: number, max: number) => {
			const value = raw[key];
			return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : defaults[key] as number;
		};
		const unboundedInteger = (key: keyof Settings, min: number) => {
			const value = raw[key];
			const integerValue = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : null;
			return integerValue != null && Number.isSafeInteger(integerValue) ? Math.max(min, integerValue) : defaults[key] as number;
		};
		const strings = (key: keyof Settings) => Array.isArray(raw[key]) ? raw[key].filter((x): x is string => typeof x === 'string').slice(0, 100) : defaults[key] as string[];
		const legacyReactionAffinityPercent = typeof raw.twoHopPercent === 'number' && Number.isFinite(raw.twoHopPercent) ? Math.min(100, Math.max(0, Math.floor(raw.twoHopPercent))) : defaults.reactionAffinityPercent;
		return {
			candidatePoolLimit: unboundedInteger('candidatePoolLimit', 100), candidateScanLimit: integer('candidateScanLimit', 30, 200), resultLimit: integer('resultLimit', 20, 100),
			snapshotHours: integer('snapshotHours', 1, 168), seenDays: integer('seenDays', 1, 30), seenLimit: integer('seenLimit', 1000, 100000),
			reactionAffinityPercent: typeof raw.reactionAffinityPercent === 'number' && Number.isFinite(raw.reactionAffinityPercent) ? Math.min(100, Math.max(0, Math.floor(raw.reactionAffinityPercent))) : legacyReactionAffinityPercent, followingPercent: integer('followingPercent', 0, 100), unknownPercent: integer('unknownPercent', 0, 100),
			qualityPercent: integer('qualityPercent', 0, 100), balancedPercent: integer('balancedPercent', 0, 100), freshPercent: integer('freshPercent', 0, 100),
			maxNotesPerAuthor: integer('maxNotesPerAuthor', 1, 10), publicBonus: integer('publicBonus', 0, 100), localUserBonus: integer('localUserBonus', 0, 100), followingBonus: integer('followingBonus', 0, 100), reactionAffinityBonus: integer('reactionAffinityBonus', 0, 100), reactionBonus: integer('reactionBonus', 0, 100), boostBonus: integer('boostBonus', 0, 100), sensitivePenalty: integer('sensitivePenalty', 0, 100), botPenalty: integer('botPenalty', 0, 100),
			negativePenalty: integer('negativePenalty', 0, 100), minimumScore: integer('minimumScore', -100, 100), fallbackMaxAgeDays: integer('fallbackMaxAgeDays', 7, 365), forcedLimit: integer('forcedLimit', 0, 20),
			forcedAccounts: strings('forcedAccounts'), negativeWords: strings('negativeWords'), boostWords: strings('boostWords'), negativeAccounts: strings('negativeAccounts'),
		};
	}

	private personalizedCursorAdvance(settings: Settings, resultLimit: number): number {
		const sourceNoteLimit = Math.min(settings.candidateScanLimit, Math.max(60, resultLimit * 3));
		const directFetchLimit = Math.min(120, Math.max(sourceNoteLimit, resultLimit * 2));
		// The Home source is read from Redis in a wider window than one page. Advance
		// by that complete window so a fresh snapshot does not rescan the same already
		// seen followed notes after every reload.
		return directFetchLimit * 2;
	}

	private async buildRecommendation(me: MiLocalUser, settings: Settings, excludedTargets = new Set<string>(), candidateOffset = 0, resultLimit = settings.resultLimit, seed = '', existingAuthorCounts = new Map<string, number>(), includeRenotes = true, includePersonalizedSources = true, seen = new Set<string>(), personalizedOffset = 0, candidateWindowCount = 1): Promise<string[]> {
		const candidateScanSize = settings.candidateScanLimit * Math.max(1, candidateWindowCount);
		const rawCandidateIds = await this.redisForTimelines.lrange('torikago:recommended:candidates', candidateOffset, candidateOffset + candidateScanSize - 1);
		// Most entries near the head have already been delivered after one or two
		// refreshes. Discard known IDs before hydrating notes and their relations.
		const candidateIds = rawCandidateIds.filter(id => !seen.has(id) && !excludedTargets.has(id));
		const context = await this.getRecommendationContext(me, settings);
		const followingIds = context.followingIds;
		const directIds = followingIds;
		const reactionAffinityIds = context.reactionAffinity.map(([userId]) => userId);
		if (candidateIds.length === 0 && (!includePersonalizedSources || (directIds.length === 0 && reactionAffinityIds.length === 0))) return [];

		const reactionAffinity = new Map(context.reactionAffinity);
		const favoriteAffinity = new Map(context.favoriteAffinity);
		const renoteAffinity = new Map(context.renoteAffinity);
		const directSet = new Set(directIds);
		const reactionAffinitySet = new Set(reactionAffinityIds);
		const createVisibleQuery = (limit = settings.candidateScanLimit) => {
			const query = this.notesRepository.createQueryBuilder('note').innerJoinAndSelect('note.user', 'user').leftJoinAndSelect('note.reply', 'reply').leftJoinAndSelect('reply.user', 'replyUser').leftJoinAndSelect('note.renote', 'renote').leftJoinAndSelect('renote.user', 'renoteUser')
				.andWhere('note.channelId IS NULL').orderBy('note.id', 'DESC').take(limit);
			this.queryService.generateVisibilityQuery(query, me);
			this.queryService.generateBaseNoteFilteringQuery(query, me);
			this.queryService.generateMutedUserRenotesQueryForNotes(query, me);
			return query;
		};
		// Keep Home and discovery retrieval independent. A busy global candidate pool
		// must not crowd out followed accounts before scoring. Followed posts remain a
		// normal recommendation source even when the explicit Home mix is off.
		// A bounded per-source fetch makes the result genuinely personal even when
		// the shared Redis candidate pool is dominated by a busy relay. The cap is
		// intentionally small: ranking needs a varied shortlist, not every note
		// written by every followed account.
		const sourceNoteLimit = Math.min(settings.candidateScanLimit, Math.max(60, resultLimit * 3));
		const directFetchLimit = Math.min(120, Math.max(sourceNoteLimit, resultLimit * 2));
		const prioritizedReactionAffinityIds = reactionAffinityIds.slice(0, Math.min(200, Math.max(80, settings.candidateScanLimit * 2)));
		const reactionAffinityFetchLimit = Math.min(140, Math.max(sourceNoteLimit, resultLimit * 2));
		// Personalised sources have their own snapshot-local cursor. Tying this offset
		// to the shared candidate pool used to skip large ranges of Home and
		// affinity notes whenever sparse shared windows advanced quickly.
		const personalisedOffset = Math.max(0, personalizedOffset);
		// Misskey already maintains the reader's Home timeline as a bounded Redis
		// list. It includes followed followers-only posts and avoids searching the
		// note table with an ever-growing author array on every recommendation load.
		const homeTimelineIds = includePersonalizedSources
			? await this.redisForTimelines.lrange(`list:homeTimeline:${me.id}`, personalisedOffset, personalisedOffset + directFetchLimit * 2 - 1)
			: [];
		// A newly created/disabled fanout cache can be empty. Keep a bounded DB
		// fallback so a recent follow is reflected immediately without allowing the
		// query cost to grow without limit for accounts following thousands of users.
		const directFallbackIds = directIds.slice(0, 200);
		const fetchDirectNoteIds = (days: number) => directFallbackIds.length === 0 || homeTimelineIds.length > 0 ? Promise.resolve([]) : this.notesRepository.createQueryBuilder('note')
			.select('note.id', 'id')
			.andWhere('note.userId = ANY(:directIds)', { directIds: directFallbackIds })
			.andWhere('note.channelId IS NULL')
			// Match Home timeline semantics: ordinary posts and self-replies belong
			// in this source, while replies to other accounts must not crowd them out.
			.andWhere('(note.replyId IS NULL OR note.replyUserId = note.userId)')
			.andWhere('note.id >= :oldestId', { oldestId: this.idService.gen(Date.now() - days * 86400000) })
			.orderBy('note.id', 'DESC')
			.take(directFetchLimit)
			.skip(personalisedOffset)
			.getRawMany<{ id: string }>();
		const fetchReactionAffinityNoteIds = (days: number) => prioritizedReactionAffinityIds.length === 0 ? Promise.resolve([]) : this.notesRepository.createQueryBuilder('note')
			.select('note.id', 'id')
			.andWhere('note.userId = ANY(:reactionAffinityIds)', { reactionAffinityIds: prioritizedReactionAffinityIds })
			.andWhere('note.channelId IS NULL')
			.andWhere('note.id >= :oldestId', { oldestId: this.idService.gen(Date.now() - days * 86400000) })
			// Subsequent scroll batches inspect older notes from the same interest cohort.
			// The final selector enforces maxNotesPerAuthor across the snapshot.
			.orderBy('note.id', 'DESC')
			.take(reactionAffinityFetchLimit)
			.skip(personalisedOffset)
			.getRawMany<{ id: string }>();
		// First select only IDs through the (userId, id) index. Applying every
		// visibility join while PostgreSQL is still searching for followed authors
		// made even a single sparse follow scan the large note table until timeout.
		const [directRows, reactionAffinityRowsForNotes] = await Promise.all([
			includePersonalizedSources ? fetchDirectNoteIds(settings.fallbackMaxAgeDays) : [],
			includePersonalizedSources ? fetchReactionAffinityNoteIds(settings.fallbackMaxAgeDays) : [],
		]);
		const sourceIds = [...homeTimelineIds, ...directRows.map(row => row.id), ...reactionAffinityRowsForNotes.map(row => row.id)]
			.filter(id => !seen.has(id) && !excludedTargets.has(id));
		const hydrationIds = [...new Set([...candidateIds, ...sourceIds])];
		const notes = hydrationIds.length === 0 ? [] : await createVisibleQuery(hydrationIds.length)
			.andWhere('note.id = ANY(:hydrationIds)', { hydrationIds })
			.getMany();
		const sourceTarget = (percent: number) => {
			const total = settings.reactionAffinityPercent + settings.followingPercent + settings.unknownPercent;
			return percent === 0 ? 0 : Math.max(1, Math.ceil(resultLimit * percent / Math.max(total, 1)));
		};
		notes.sort((a, b) => b.id.localeCompare(a.id));
		// A plain renote is displayed as its original, so include the original's
		// files when evaluating the sensitive-file penalty as well.
		const fileIds = [...new Set(notes.flatMap(note => [...note.fileIds, ...(note.renote?.fileIds ?? [])]))];
		const sensitiveFileIds = new Set((await this.driveFilesRepository.find({ select: { id: true }, where: { id: In(fileIds), isSensitive: true } })).map(file => file.id));
		const forcedWords = (this.serverSettings.recommendedTimelineForcedWords ?? []).map(word => word.toLocaleLowerCase());
		const now = Date.now();
		const normalizedAccounts = (accounts: string[]) => new Set(accounts.map(x => x.trim().replace(/^@/, '').toLocaleLowerCase()).filter(Boolean));
		const forcedAccounts = normalizedAccounts(settings.forcedAccounts);
		const negativeAccounts = normalizedAccounts(settings.negativeAccounts);
		const negativeWords = settings.negativeWords.map(word => word.toLocaleLowerCase());
		const boostWords = settings.boostWords.map(word => word.toLocaleLowerCase());
		const accountName = (note: typeof notes[number]) => `${note.user?.username ?? ''}${note.user?.host ? `@${note.user.host}` : ''}`.toLocaleLowerCase();
		const scored = notes.filter(note => !seen.has(this.targetId(note)) && !excludedTargets.has(this.targetId(note))).flatMap(note => {
			const source = directSet.has(note.userId) ? 'following' : reactionAffinitySet.has(note.userId) ? 'reactionAffinity' : 'unknown';
			// A renote with no own text or CW is the only form that may be replaced
			// with its original. Quote posts retain their wrapper and commentary.
			const plainRenote = note.renote != null && (note.text == null || note.text === '') && (note.cw == null || note.cw === '');
			if (plainRenote && !includeRenotes) return [];
			// We only expose a renote's original when it is public. Non-public
			// originals are skipped rather than leaking their content through a
			// recommendation.
			if (plainRenote && note.renote?.visibility !== 'public') return [];
			// Keep the renoter as the social signal, but score the note the reader
			// will actually see. Quotes intentionally retain their own wrapper here.
			const rankingNote = plainRenote ? note.renote! : note;
			// Packing a note past the author's privacy deadline deliberately produces an
			// "unavailable" shell. Recommendations must omit it entirely instead of
			// presenting that shell as a candidate.
			if (this.isPastVisibilityDeadline(rankingNote)) return [];
			// Do not recommend the reader's own post. This also covers a public
			// original that another account has purely renoted.
			if (rankingNote.userId === me.id) return [];
			const reactions = Object.values(rankingNote.reactions).reduce((sum, count) => sum + count, 0);
			const ageHours = Math.max(0, (now - this.idService.parse(rankingNote.id).date.getTime()) / 3600000);
			const freshness = Math.pow(0.5, ageHours / 8);
			const text = `${rankingNote.cw ?? ''}\n${rankingNote.text ?? ''}`.toLocaleLowerCase();
			const isForced = forcedWords.some(word => text.includes(word)) || forcedAccounts.has(accountName(rankingNote));
			const negative = negativeWords.some(word => text.includes(word)) || negativeAccounts.has(accountName(rankingNote));
			const boosted = boostWords.some(word => text.includes(word));
			// A pure renote is a recommendation signal; show its public original
			// directly so the reader does not see a redundant renote wrapper.
			const displayId = plainRenote ? note.renoteId! : note.id;
			const isFollowedAuthor = directSet.has(rankingNote.userId);
			const quality = settings.reactionAffinityBonus * Math.log1p(reactionAffinity.get(note.userId) ?? 0) + 6 * Math.log1p(renoteAffinity.get(note.userId) ?? 0) + 4 * Math.log1p(favoriteAffinity.get(note.userId) ?? 0) + settings.reactionBonus * Math.log1p(reactions) + 1.5 * Math.log1p(rankingNote.renoteCount) + (rankingNote.visibility === 'public' ? settings.publicBonus : 0) + (rankingNote.user?.host == null ? settings.localUserBonus : 0) + (isFollowedAuthor ? settings.followingBonus : 0) + (boosted ? settings.boostBonus : 0) - (rankingNote.fileIds.some(id => sensitiveFileIds.has(id)) ? settings.sensitivePenalty : 0) - (rankingNote.user?.isBot ? settings.botPenalty : 0) - (negative ? settings.negativePenalty : 0);
			return [{ id: note.id, displayId, targetId: this.targetId(note), authorId: rankingNote.userId, source, forced: isForced, quality, freshness, balanced: quality + freshness * 4 }];
		});
		// A plain renote and its original note represent one thing to the reader.
		// Keep the stronger candidate before splitting forced and regular slots.
		const uniqueScored = [...scored].sort((a, b) => b.quality - a.quality).filter((item, index, items) => items.findIndex(other => other.targetId === item.targetId) === index);
		const selectedAuthorCounts = new Map(existingAuthorCounts);
		const forced: typeof uniqueScored = [];
		for (const item of uniqueScored) {
			if (!item.forced || forced.length >= settings.forcedLimit) continue;
			if ((selectedAuthorCounts.get(item.authorId) ?? 0) >= settings.maxNotesPerAuthor) continue;
			selectedAuthorCounts.set(item.authorId, (selectedAuthorCounts.get(item.authorId) ?? 0) + 1);
			forced.push(item);
		}
		const forcedTargets = new Set(forced.map(item => item.targetId));
		// Forced entries bypass the threshold, but every ordinary source uses the
		// configured minimum score consistently, including followed accounts.
		const eligible = uniqueScored.filter(item => item.forced || item.quality >= settings.minimumScore);
		const selectionSettings = { ...settings, resultLimit: Math.max(0, resultLimit - forced.length) };
		const selected = this.selectSources(eligible.filter(item => !item.forced && !forcedTargets.has(item.targetId)), selectionSettings, seed, selectedAuthorCounts);
		for (const item of selected) {
			selectedAuthorCounts.set(item.authorId, (selectedAuthorCounts.get(item.authorId) ?? 0) + 1);
		}
		// Source selection normally honours the configured ratios, but a depleted
		// source can fall back to another list while iterating. Do not let that
		// fallback erase the followed-account share when visible Home/followers
		// notes actually exist for the reader.
		const wantedFollowing = sourceTarget(settings.followingPercent);
		const selectedFollowing = selected.filter(item => item.source === 'following').length;
		if (selectedFollowing < wantedFollowing) {
			const selectedTargets = new Set(selected.map(item => item.targetId));
			const replacements = eligible
				.filter(item => item.source === 'following' && !item.forced && !forcedTargets.has(item.targetId) && !selectedTargets.has(item.targetId))
				.sort((a, b) => b.quality - a.quality)
				.slice(0, wantedFollowing - selectedFollowing);
			for (const replacement of replacements) {
				// Keep the separate reaction-affinity share intact while filling the
				// followed-account share. Unknown slots are the fallback space.
				const replaceAt = selected.map(item => item.source === 'unknown').lastIndexOf(true);
				if (replaceAt < 0) break;
				const replaced = selected[replaceAt]!;
				const replacedCount = selectedAuthorCounts.get(replaced.authorId) ?? 0;
				selectedAuthorCounts.set(replaced.authorId, Math.max(0, replacedCount - 1));
				if ((selectedAuthorCounts.get(replacement.authorId) ?? 0) >= settings.maxNotesPerAuthor) {
					selectedAuthorCounts.set(replaced.authorId, replacedCount);
					continue;
				}
				selected[replaceAt] = replacement;
				selectedAuthorCounts.set(replacement.authorId, (selectedAuthorCounts.get(replacement.authorId) ?? 0) + 1);
			}
		}
		// Home-eligible notes are scored and interleaved with every other source;
		// they are no longer inserted as an independent chronological Home segment.
		const regular = this.interleave(selected, settings, seed);
		return this.spreadAuthors([...forced, ...regular], seed).slice(0, resultLimit).map(item => item.displayId);
	}

	private async getRecommendationContext(me: MiLocalUser, settings: Settings): Promise<RecommendationContext> {
		const key = `torikago:recommended:${recommendationCacheVersion}:context:${me.id}`;
		const cached = await this.redisClient.get(key);
		if (cached != null) {
			try {
				const context = JSON.parse(cached) as RecommendationContext;
				if (Array.isArray(context.followingIds) && Array.isArray(context.reactionAffinity) && Array.isArray(context.favoriteAffinity) && Array.isArray(context.renoteAffinity)) return context;
			} catch {
				// Rebuild a malformed or obsolete cache entry.
			}
		}

		const followingIds = (await this.followingsRepository.find({ select: { followeeId: true }, where: { followerId: me.id } })).map(row => row.followeeId);
		const reactionInterestLimit = Math.min(200, Math.max(80, settings.candidateScanLimit * 2));
		// Interest discovery is intentionally independent from the follow graph.
		// It stays bounded and does not traverse anyone else's follow relationships.
		const reactionRows = await this.noteReactionsRepository.createQueryBuilder('reaction')
			.innerJoin('reaction.note', 'target')
			.select('target.userId', 'userId')
			.addSelect('COUNT(*)', 'count')
			.where('reaction.userId = :meId', { meId: me.id })
			.andWhere('target.id >= :reactionOldestId', { reactionOldestId: this.idService.gen(Date.now() - 90 * 86400000) })
			.andWhere('target.userId != :meId', { meId: me.id })
			.groupBy('target.userId')
			.orderBy('COUNT(*)', 'DESC')
			.limit(reactionInterestLimit)
			.getRawMany<{ userId: string; count: string }>();
		// Affinity queries stay bounded even though the retrieval pool is wider.
		const authorIds = [...new Set([me.id, ...followingIds.slice(0, 500), ...reactionRows.slice(0, 80).map(row => row.userId)])];
		const affinityOldestId = this.idService.gen(Date.now() - 90 * 86400000);
		const [favoriteRows, renoteRows] = authorIds.length === 0 ? [[], []] : await Promise.all([
			this.noteFavoritesRepository.createQueryBuilder('favorite').innerJoin('favorite.note', 'target').select('target.userId', 'userId').addSelect('COUNT(*)', 'count').where('favorite.userId = :meId', { meId: me.id }).andWhere('target.id >= :affinityOldestId', { affinityOldestId }).andWhere('target.userId IN (:...authorIds)', { authorIds }).groupBy('target.userId').getRawMany<{ userId: string; count: string }>(),
			this.notesRepository.createQueryBuilder('ownRenote').innerJoin('ownRenote.renote', 'target').select('target.userId', 'userId').addSelect('COUNT(*)', 'count').where('ownRenote.userId = :meId', { meId: me.id }).andWhere('ownRenote.id >= :affinityOldestId', { affinityOldestId }).andWhere('target.userId IN (:...authorIds)', { authorIds }).groupBy('target.userId').getRawMany<{ userId: string; count: string }>(),
		]);
		const context: RecommendationContext = {
			followingIds,
			reactionAffinity: reactionRows.map(row => [row.userId, Number(row.count)]),
			favoriteAffinity: favoriteRows.map(row => [row.userId, Number(row.count)]),
			renoteAffinity: renoteRows.map(row => [row.userId, Number(row.count)]),
		};
		await this.redisClient.set(key, JSON.stringify(context), 'EX', 900);
		return context;
	}

	private selectSources<T extends { id: string; source: string; authorId: string; targetId: string; quality: number }>(items: T[], settings: Settings, seed: string, existingAuthorCounts = new Map<string, number>()): T[] {
		const bySource = new Map(['following', 'reactionAffinity', 'unknown'].map(source => [source, items.filter(item => item.source === source).sort((a, b) => b.quality - a.quality)]));
		const percentages: Array<[string, number]> = [['reactionAffinity', settings.reactionAffinityPercent], ['following', settings.followingPercent], ['unknown', settings.unknownPercent]];
		if (percentages.every(([, percent]) => percent === 0)) percentages[0]![1] = 100;
		const out: T[] = []; const counts = new Map(existingAuthorCounts); const targets = new Set<string>();
		for (let i = 0; i < settings.resultLimit; i++) {
			const wanted = [...percentages].sort((a, b) => ((out.filter(item => item.source === a[0]).length + 1) / Math.max(a[1], 1)) - ((out.filter(item => item.source === b[0]).length + 1) / Math.max(b[1], 1)))[0]![0];
			const sources = [wanted, ...percentages.map(x => x[0]).filter(source => source !== wanted)];
			let picked: T | undefined;
			for (const source of sources) {
				const list = bySource.get(source) ?? [];
				const eligible = list.filter(item => !targets.has(item.targetId) && (counts.get(item.authorId) ?? 0) < settings.maxNotesPerAuthor);
				if (eligible.length > 0) {
					// Sampling from the stronger portion rather than always taking rank 1
					// prevents every snapshot from having the same score-heavy head.
					const windowSize = Math.max(1, Math.ceil(eligible.length * 0.6));
					picked = eligible[Math.floor(this.seededRandom(`${seed}:source:${source}:${i}`) * windowSize)]!;
					list.splice(list.indexOf(picked), 1);
					break;
				}
			}
			if (picked == null) break;
			out.push(picked); targets.add(picked.targetId); counts.set(picked.authorId, (counts.get(picked.authorId) ?? 0) + 1);
		}
		return out;
	}

	private interleave<T extends { id: string; quality: number; freshness: number; balanced: number }>(items: T[], settings: Settings, seed: string): T[] {
		const pools = { quality: [...items].sort((a, b) => b.quality - a.quality), balanced: [...items].sort((a, b) => b.balanced - a.balanced), fresh: [...items].sort((a, b) => b.freshness - a.freshness) };
		const ratioTotal = settings.qualityPercent + settings.balancedPercent + settings.freshPercent || 100;
		const counts = {
			quality: Math.round(10 * settings.qualityPercent / ratioTotal),
			balanced: Math.round(10 * settings.balancedPercent / ratioTotal),
			fresh: Math.round(10 * settings.freshPercent / ratioTotal),
		};
		while (counts.quality + counts.balanced + counts.fresh < 10) counts.quality++;
		while (counts.quality + counts.balanced + counts.fresh > 10) {
			const largest = [...(['quality', 'balanced', 'fresh'] as const)].sort((a, b) => counts[b] - counts[a])[0]!;
			counts[largest]--;
		}
		const output: T[] = []; const used = new Set<T>(); const order: (keyof typeof pools)[] = [];
		while (order.length < 10) {
			for (const type of ['quality', 'balanced', 'fresh'] as const) {
				if (counts[type] > order.filter(x => x === type).length) order.push(type);
			}
		}
		for (const [index, type] of order.entries()) {
			const candidates = pools[type].filter(item => !used.has(item));
			if (candidates.length === 0) continue;
			// Draw independently from each score/freshness category. The seed keeps
			// pagination stable while avoiding a concentration of the top-ranked
			// notes at the beginning of every response.
			const windowSize = Math.max(1, Math.ceil(candidates.length * 0.6));
			const item = candidates[Math.floor(this.seededRandom(`${seed}:display:${type}:${index}`) * windowSize)]!;
			output.push(item);
			used.add(item);
		}
		// The first slots preserve a deliberate quality/freshness mix. Shuffle the
		// remaining eligible items with a snapshot-stable seed so lower-scored notes
		// are not deterministically relegated to the bottom on every refresh.
		const remaining = pools.balanced.filter(item => !used.has(item)).map(item => ({ item, random: this.seededRandom(`${seed}:${item.id}`) }))
			.sort((a, b) => a.random - b.random).map(({ item }) => item);
		output.push(...remaining);
		return output;
	}

	private seededRandom(value: string): number {
		let hash = 2166136261;
		for (let i = 0; i < value.length; i++) {
			hash ^= value.charCodeAt(i);
			hash = Math.imul(hash, 16777619);
		}
		return (hash >>> 0) / 0x100000000;
	}

	private spreadAuthors<T extends { id: string; authorId: string }>(items: T[], seed: string, initialPreviousAuthorId: string | null = null): T[] {
		const remaining = [...items];
		const output: T[] = [];
		let previousAuthorId: string | null = initialPreviousAuthorId;
		while (remaining.length > 0) {
			let candidates = remaining.filter(item => item.authorId !== previousAuthorId);
			if (candidates.length === 0) candidates = remaining;
			// Keep the score/category order mostly intact while choosing among the first
			// few alternatives. This separates repeated authors without flattening the
			// recommendation ranking into a fully random list.
			const window = candidates.slice(0, Math.min(4, candidates.length));
			const picked = window[Math.floor(this.seededRandom(`${seed}:author:${output.length}`) * window.length)]!;
			output.push(picked);
			remaining.splice(remaining.indexOf(picked), 1);
			previousAuthorId = picked.authorId;
		}
		return output;
	}

	private async spreadSnapshotAuthors(ids: string[], seed: string, previousId?: string): Promise<string[]> {
		if (ids.length < 2) return ids;
		const lookupIds = previousId == null ? ids : [previousId, ...ids];
		const notes = await this.notesRepository.find({ select: { id: true, userId: true }, where: { id: In(lookupIds) } });
		const authorById = new Map(notes.map(note => [note.id, note.userId]));
		return this.spreadAuthors(ids.map(id => ({ id, authorId: authorById.get(id) ?? id })), seed, previousId == null ? null : authorById.get(previousId) ?? null).map(item => item.id);
	}

	private isPastVisibilityDeadline(note: { id: string; user?: { makeNotesHiddenBefore?: number | null } | null }): boolean {
		return shouldHideNoteByTime(note.user?.makeNotesHiddenBefore, this.idService.parse(note.id).date);
	}

	private targetId(note: { id: string; renoteId: string | null; text?: string | null; cw?: string | null }): string {
		return note.renoteId != null && (note.text == null || note.text === '') && (note.cw == null || note.cw === '') ? note.renoteId : note.id;
	}

	private async loadSeenIds(userId: string, settings: Settings): Promise<string[]> {
		const oldest = Date.now() - settings.seenDays * 86400000;
		const [stable, legacy] = await Promise.all([
			this.redisClient.zrangebyscore(`torikago:recommended:seen:${userId}`, oldest, '+inf'),
			this.redisClient.zrangebyscore(`torikago:recommended:${previousRecommendationCacheVersion}:seen:${userId}`, oldest, '+inf'),
		]);
		return [...new Set([...stable, ...legacy])];
	}

	private async claimUnseen(userId: string, resultKey: string, noteIds: string[], settings: Settings): Promise<string[]> {
		if (noteIds.length === 0) return [];
		const uniqueIds = [...new Set(noteIds)];
		const key = `torikago:recommended:seen:${userId}`;
		const now = Date.now();
		return await this.redisClient.eval(`
			local claimed = {}
			for i = 6, #ARGV do
				local id = ARGV[i]
				if redis.call('SISMEMBER', KEYS[1], id) == 0 and redis.call('ZSCORE', KEYS[2], id) == false then
					redis.call('SADD', KEYS[1], id)
					redis.call('ZADD', KEYS[2], ARGV[1], id)
					table.insert(claimed, id)
				end
			end
			redis.call('EXPIRE', KEYS[1], ARGV[2])
			redis.call('ZREMRANGEBYSCORE', KEYS[2], 0, ARGV[3])
			redis.call('EXPIRE', KEYS[2], ARGV[4])
			local count = redis.call('ZCARD', KEYS[2])
			if count > tonumber(ARGV[5]) then
				redis.call('ZREMRANGEBYRANK', KEYS[2], 0, count - tonumber(ARGV[5]) - 1)
			end
			return claimed
		`, 2, `${resultKey}:seen`, key, String(now), String(settings.snapshotHours * 3600), String(now - settings.seenDays * 86400000), String(settings.seenDays * 86400), String(settings.seenLimit), ...uniqueIds) as string[];
	}
}
