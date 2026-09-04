/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { In } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import type { DriveFilesRepository, FollowingsRepository, MiMeta, NoteFavoritesRepository, NoteReactionsRepository, NotesRepository } from '@/models/_.js';
import type { MiLocalUser } from '@/models/User.js';
import { DI } from '@/di-symbols.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { QueryService } from '@/core/QueryService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { IdService } from '@/core/IdService.js';

type Settings = {
	candidatePoolLimit: number;
	candidateScanLimit: number;
	resultLimit: number;
	snapshotHours: number;
	seenDays: number;
	seenLimit: number;
	twoHopPercent: number;
	followingPercent: number;
	unknownPercent: number;
	qualityPercent: number;
	balancedPercent: number;
	freshPercent: number;
	maxNotesPerAuthor: number;
	publicBonus: number;
	localUserBonus: number;
	reactionBonus: number;
	boostBonus: number;
	sensitivePenalty: number;
	botPenalty: number;
	twoHopRenoteBonus: number;
	negativePenalty: number;
	forcedLimit: number;
	forcedAccounts: string[];
	negativeWords: string[];
	boostWords: string[];
	negativeAccounts: string[];
};

const defaults: Settings = {
	candidatePoolLimit: 3000,
	candidateScanLimit: 300,
	resultLimit: 100,
	snapshotHours: 24,
	seenDays: 7,
	seenLimit: 1000,
	twoHopPercent: 60,
	followingPercent: 20,
	unknownPercent: 20,
	qualityPercent: 50,
	balancedPercent: 30,
	freshPercent: 20,
	maxNotesPerAuthor: 2,
	publicBonus: 2,
	localUserBonus: 2,
	reactionBonus: 1,
	boostBonus: 4,
	sensitivePenalty: 6,
	botPenalty: 3,
	twoHopRenoteBonus: 6,
	negativePenalty: 8,
	forcedLimit: 3,
	forcedAccounts: [],
	negativeWords: [],
	boostWords: [],
	negativeAccounts: [],
};

// Increment when the ranking/seen semantics change so previously generated
// snapshots and stale seen records cannot hide the corrected result set.
const recommendationCacheVersion = 'v7';

export const meta = {
	tags: ['notes'],
	requireCredential: true,
	kind: 'read:account',
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
			const resultKey = `torikago:recommended:${recommendationCacheVersion}:snapshot:${me.id}:${ps.snapshotId}:${ps.includeFollowing ? 'home' : 'discovery'}`;
			let resultIds = await this.redisClient.lrange(resultKey, 0, -1);
			if (resultIds.length === 0) {
				// The host has a known midnight load spike. Do not make a reader wait
				// for a fresh ranking if the browser already has a usable snapshot:
				// carry that fixed snapshot forward instead. Returning an empty array
				// here used to render "No notes" for every reader from 00:00 to 00:09.
				const previousResultKey = ps.previousSnapshotId == null ? null : `torikago:recommended:${recommendationCacheVersion}:snapshot:${me.id}:${ps.previousSnapshotId}:${ps.previousIncludeFollowing ? 'home' : 'discovery'}`;
				const previousResultIds = previousResultKey == null ? [] : await this.redisClient.lrange(previousResultKey, 0, -1);
				if (this.isMidnightProtectionWindow() && previousResultKey != null && previousResultIds.length > 0) {
					const previousSeenIds = await this.redisClient.smembers(`${previousResultKey}:seen`);
					const pipeline = this.redisClient.pipeline().del(resultKey);
					pipeline.rpush(resultKey, ...previousResultIds);
					pipeline.expire(resultKey, settings.snapshotHours * 3600);
					pipeline.set(`${resultKey}:candidate-cursor`, '0', 'EX', settings.snapshotHours * 3600);
					pipeline.set(`${resultKey}:version`, (await this.redisForTimelines.get('torikago:recommended:version')) ?? '0', 'EX', settings.snapshotHours * 3600);
					if (previousSeenIds.length > 0) pipeline.sadd(`${resultKey}:seen`, ...previousSeenIds);
					pipeline.expire(`${resultKey}:seen`, settings.snapshotHours * 3600);
					await pipeline.exec();
					resultIds = previousResultIds;
				} else {
					// A first-time reader has no snapshot to reuse. Generate one rather
					// than presenting an empty timeline; this is request-driven, not a
					// midnight-wide background job.
					resultIds = await this.buildRecommendation(me, ps.includeFollowing, settings, new Set(), 0, settings.resultLimit, ps.snapshotId);
					const pipeline = this.redisClient.pipeline().del(resultKey);
					if (resultIds.length > 0) pipeline.rpush(resultKey, ...resultIds);
					pipeline.expire(resultKey, settings.snapshotHours * 3600);
					pipeline.set(`${resultKey}:candidate-cursor`, '0', 'EX', settings.snapshotHours * 3600);
					pipeline.set(`${resultKey}:version`, (await this.redisForTimelines.get('torikago:recommended:version')) ?? '0', 'EX', settings.snapshotHours * 3600);
					await pipeline.exec();
				}
			}

			// Older snapshots may have been created before target-note de-duplication
			// was added. Normalize them once, including different pure renotes of the
			// same original note, before pagination can expose a duplicate.
			const snapshotNotes = resultIds.length === 0 ? [] : await this.notesRepository.find({ select: { id: true, renoteId: true, text: true, cw: true }, where: { id: In(resultIds) } });
			const snapshotNoteMap = new Map(snapshotNotes.map(note => [note.id, note]));
			const snapshotTargets = new Set<string>();
			const normalizedResultIds = resultIds.filter(id => {
				const target = snapshotNoteMap.get(id);
				const targetId = target == null ? id : this.targetId(target);
				if (snapshotTargets.has(targetId)) return false;
				snapshotTargets.add(targetId);
				return true;
			});
			if (normalizedResultIds.length !== resultIds.length) {
				resultIds = normalizedResultIds;
				const pipeline = this.redisClient.pipeline().del(resultKey);
				if (resultIds.length > 0) pipeline.rpush(resultKey, ...resultIds);
				pipeline.expire(resultKey, settings.snapshotHours * 3600);
				await pipeline.exec();
			}
			const offset = ps.untilId == null ? 0 : Math.max(0, resultIds.indexOf(ps.untilId) + 1);
			let pageIds = resultIds.slice(offset, offset + ps.limit * 8);
			// Reaching the end of a snapshot is the only time scrolling performs more
			// ranking. The existing IDs remain fixed, so the reader never sees items
			// move or duplicate while loading older entries.
			if (ps.untilId != null && pageIds.length < ps.limit) {
				const existingNotes = resultIds.length === 0 ? [] : await this.notesRepository.find({ select: { id: true, renoteId: true, text: true, cw: true }, where: { id: In(resultIds) } });
				const existingTargets = new Set(existingNotes.map(note => this.targetId(note)));
				const cursorKey = `${resultKey}:candidate-cursor`;
				const cursor = Number(await this.redisClient.get(cursorKey) ?? '0');
				const batchSize = Math.min(100, Math.max(ps.limit * 2, 30));
				const extraIds = await this.buildRecommendation(me, ps.includeFollowing, settings, existingTargets, Math.max(0, cursor) * settings.candidateScanLimit, batchSize, ps.snapshotId);
				if (extraIds.length > 0) {
					// Multiple widgets or Deck columns may share this snapshot. Append only
					// when its length is unchanged, so concurrent end-of-list requests can
					// never append the same ranking batch twice.
					const appended = await this.redisClient.eval(`
						if redis.call('LLEN', KEYS[1]) ~= tonumber(ARGV[1]) then return 0 end
						redis.call('RPUSH', KEYS[1], unpack(ARGV, 4))
						redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
						redis.call('EXPIRE', KEYS[1], ARGV[3])
						return 1
					`, 2, resultKey, cursorKey, String(resultIds.length), String(cursor + 1), String(settings.snapshotHours * 3600), ...extraIds);
					if (appended === 1) resultIds.push(...extraIds);
					else resultIds = await this.redisClient.lrange(resultKey, 0, -1);
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
				where: { id: In([...new Set(notes.flatMap(note => note.fileIds))]) },
			});
			const sensitiveFileIds = new Set(files.filter(file => file.isSensitive).map(file => file.id));
			const noteMap = new Map(notes.map(note => [note.id, note]));
			const [snapshotSeenIds, globallySeenIds] = await Promise.all([
				this.redisClient.smembers(`${resultKey}:seen`),
				this.redisClient.zrangebyscore(`torikago:recommended:${recommendationCacheVersion}:seen:${me.id}`, Date.now() - settings.seenDays * 86400000, '+inf'),
			]);
			const snapshotSeen = new Set(snapshotSeenIds);
			const globallySeen = new Set(globallySeenIds);
			// The same fixed snapshot must remain readable while moving between views,
			// but a later snapshot must never reintroduce a note already delivered by
			// another snapshot. This second guard also closes the generation race where
			// two refreshes rank candidates before either response has recorded them.
			const ordered = pageIds.map(id => noteMap.get(id)).filter(note => note != null)
				.filter(note => {
					const targetId = this.targetId(note);
					return snapshotSeen.has(targetId) || !globallySeen.has(targetId);
				})
				.filter(note => ps.withSensitive || !note.fileIds.some(id => sensitiveFileIds.has(id))).slice(0, ps.limit);
			// A page returned to the client is the smallest reliable approximation of
			// "seen". Never consume an entire snapshot merely because it was replaced.
			await this.markSeen(me.id, resultKey, ordered.map(note => this.targetId(note)), settings);
			return await this.noteEntityService.packMany(ordered, me);
		});
	}

	private isMidnightProtectionWindow(): boolean {
		const now = new Date();
		return now.getHours() === 0 && now.getMinutes() < 10;
	}

	private settings(): Settings {
		const raw = this.serverSettings.recommendedTimelineSettings ?? {};
		const integer = (key: keyof Settings, min: number, max: number) => {
			const value = raw[key];
			return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : defaults[key] as number;
		};
		const strings = (key: keyof Settings) => Array.isArray(raw[key]) ? raw[key].filter((x): x is string => typeof x === 'string').slice(0, 100) : defaults[key] as string[];
		return {
			candidatePoolLimit: integer('candidatePoolLimit', 100, 10000), candidateScanLimit: integer('candidateScanLimit', 50, 500), resultLimit: integer('resultLimit', 20, 200),
			snapshotHours: integer('snapshotHours', 1, 168), seenDays: integer('seenDays', 1, 30), seenLimit: integer('seenLimit', 100, 5000),
			twoHopPercent: integer('twoHopPercent', 0, 100), followingPercent: integer('followingPercent', 0, 100), unknownPercent: integer('unknownPercent', 0, 100),
			qualityPercent: integer('qualityPercent', 0, 100), balancedPercent: integer('balancedPercent', 0, 100), freshPercent: integer('freshPercent', 0, 100),
			maxNotesPerAuthor: integer('maxNotesPerAuthor', 1, 10), publicBonus: integer('publicBonus', 0, 100), localUserBonus: integer('localUserBonus', 0, 100), reactionBonus: integer('reactionBonus', 0, 100), boostBonus: integer('boostBonus', 0, 100), sensitivePenalty: integer('sensitivePenalty', 0, 100), botPenalty: integer('botPenalty', 0, 100),
			twoHopRenoteBonus: integer('twoHopRenoteBonus', 0, 100), negativePenalty: integer('negativePenalty', 0, 100), forcedLimit: integer('forcedLimit', 0, 20),
			forcedAccounts: strings('forcedAccounts'), negativeWords: strings('negativeWords'), boostWords: strings('boostWords'), negativeAccounts: strings('negativeAccounts'),
		};
	}

	private async buildRecommendation(me: MiLocalUser, includeFollowing: boolean, settings: Settings, excludedTargets = new Set<string>(), candidateOffset = 0, resultLimit = settings.resultLimit, seed = ''): Promise<string[]> {
		const candidateIds = await this.redisForTimelines.lrange('torikago:recommended:candidates', candidateOffset, candidateOffset + settings.candidateScanLimit - 1);
		const followingIds = (await this.followingsRepository.find({ select: { followeeId: true }, where: { followerId: me.id } })).map(row => row.followeeId);
		// Keep the Home portion faithful for the account owner as well. In particular,
		// this lets a specified note addressed to the owner pass the normal visibility
		// query without ever making it a shared recommendation candidate.
		const directIds = [me.id, ...followingIds];
		const twoHopRows: { userId: string; socialProof: string }[] = followingIds.length === 0 ? [] : await this.followingsRepository.createQueryBuilder('following')
			.select('following.followeeId', 'userId').addSelect('COUNT(*)', 'socialProof')
			.where('following.followerId IN (:...followingIds)', { followingIds }).andWhere('following.followeeId != :meId', { meId: me.id })
			.andWhere('following.followeeId NOT IN (:...followingIds)', { followingIds }).groupBy('following.followeeId').orderBy('COUNT(*)', 'DESC').limit(80).getRawMany();
		const twoHopIds = twoHopRows.map(row => row.userId);
		if (candidateIds.length === 0 && directIds.length === 0) return [];

		const authorIds = [...new Set([...directIds, ...twoHopIds])];
		const [reactionAffinityRows, favoriteAffinityRows, renoteAffinityRows] = authorIds.length === 0 ? [[], [], []] : await Promise.all([
			this.noteReactionsRepository.createQueryBuilder('reaction').innerJoin('reaction.note', 'target').select('target.userId', 'userId').addSelect('COUNT(*)', 'count').where('reaction.userId = :meId', { meId: me.id }).andWhere('target.userId IN (:...authorIds)', { authorIds }).groupBy('target.userId').getRawMany<{ userId: string; count: string }>(),
			this.noteFavoritesRepository.createQueryBuilder('favorite').innerJoin('favorite.note', 'target').select('target.userId', 'userId').addSelect('COUNT(*)', 'count').where('favorite.userId = :meId', { meId: me.id }).andWhere('target.userId IN (:...authorIds)', { authorIds }).groupBy('target.userId').getRawMany<{ userId: string; count: string }>(),
			this.notesRepository.createQueryBuilder('ownRenote').innerJoin('ownRenote.renote', 'target').select('target.userId', 'userId').addSelect('COUNT(*)', 'count').where('ownRenote.userId = :meId', { meId: me.id }).andWhere('ownRenote.id >= :oldestId', { oldestId: this.idService.gen(Date.now() - 90 * 86400000) }).andWhere('target.userId IN (:...authorIds)', { authorIds }).groupBy('target.userId').getRawMany<{ userId: string; count: string }>(),
		]);
		const reactionAffinity = new Map(reactionAffinityRows.map(row => [row.userId, Number(row.count)]));
		const favoriteAffinity = new Map(favoriteAffinityRows.map(row => [row.userId, Number(row.count)]));
		const renoteAffinity = new Map(renoteAffinityRows.map(row => [row.userId, Number(row.count)]));
		const directSet = new Set(directIds);
		const twoHopProof = new Map(twoHopRows.map(row => [row.userId, Number(row.socialProof)]));
		const createVisibleQuery = () => {
			const query = this.notesRepository.createQueryBuilder('note').innerJoinAndSelect('note.user', 'user').leftJoinAndSelect('note.reply', 'reply').leftJoinAndSelect('reply.user', 'replyUser').leftJoinAndSelect('note.renote', 'renote').leftJoinAndSelect('renote.user', 'renoteUser')
				.andWhere('note.channelId IS NULL').orderBy('note.id', 'DESC').take(settings.candidateScanLimit);
			this.queryService.generateVisibilityQuery(query, me);
			this.queryService.generateBaseNoteFilteringQuery(query, me);
			this.queryService.generateMutedUserRenotesQueryForNotes(query, me);
			return query;
		};
		// Keep Home and discovery retrieval independent. A busy global candidate pool
		// must not crowd out followed accounts before scoring. Followed posts remain a
		// normal recommendation source even when the explicit Home mix is off.
		const directQuery = createVisibleQuery().andWhere('note.userId = ANY(:directIds)', { directIds }).andWhere('note.id >= :oldestId', { oldestId: this.idService.gen(Date.now() - 7 * 86400000) });
		// When the Home mix is off, followed accounts are still scored according to
		// the configured source share. Only notes eligible for the shared candidate
		// pool may enter through that path; private/followers-only and ordinary Home
		// posts are Home timeline material, not recommendations.
		if (!includeFollowing) {
			directQuery.andWhere(`(
				note.visibility = 'public'
				OR (note.visibility = 'home' AND cardinality(note.tags) > 0)
				OR (note.visibility = 'home' AND note.renoteId IS NOT NULL AND renote.visibility = 'public' AND (note.text IS NULL OR note.text = '') AND (note.cw IS NULL OR note.cw = ''))
			)`);
		}
		const noteLists = await Promise.all([
			candidateIds.length > 0 ? createVisibleQuery().andWhere('note.id = ANY(:candidateIds)', { candidateIds }).getMany() : [],
			directIds.length > 0 ? directQuery.getMany() : [],
		]);
		const notes = [...new Map(noteLists.flat().map(note => [note.id, note])).values()].sort((a, b) => b.id.localeCompare(a.id));
		// A plain renote is displayed as its original, so include the original's
		// files when evaluating the sensitive-file penalty as well.
		const fileIds = [...new Set(notes.flatMap(note => [...note.fileIds, ...(note.renote?.fileIds ?? [])]))];
		const sensitiveFileIds = new Set((await this.driveFilesRepository.find({ select: { id: true }, where: { id: In(fileIds), isSensitive: true } })).map(file => file.id));
		const seen = new Set(await this.redisClient.zrangebyscore(`torikago:recommended:${recommendationCacheVersion}:seen:${me.id}`, Date.now() - settings.seenDays * 86400000, '+inf'));
		const forcedWords = (this.serverSettings.recommendedTimelineForcedWords ?? []).map(word => word.toLocaleLowerCase());
		const now = Date.now();
		const normalizedAccounts = (accounts: string[]) => new Set(accounts.map(x => x.trim().replace(/^@/, '').toLocaleLowerCase()).filter(Boolean));
		const forcedAccounts = normalizedAccounts(settings.forcedAccounts);
		const negativeAccounts = normalizedAccounts(settings.negativeAccounts);
		const negativeWords = settings.negativeWords.map(word => word.toLocaleLowerCase());
		const boostWords = settings.boostWords.map(word => word.toLocaleLowerCase());
		const accountName = (note: typeof notes[number]) => `${note.user?.username ?? ''}${note.user?.host ? `@${note.user.host}` : ''}`.toLocaleLowerCase();
		const scored = notes.filter(note => !seen.has(this.targetId(note)) && !excludedTargets.has(this.targetId(note))).flatMap(note => {
			const source = directSet.has(note.userId) ? 'following' : twoHopProof.has(note.userId) ? 'twoHop' : 'unknown';
			// A renote with no own text or CW is the only form that may be replaced
			// with its original. Quote posts retain their wrapper and commentary.
			const plainRenote = note.renote != null && (note.text == null || note.text === '') && (note.cw == null || note.cw === '');
			// We only expose a renote's original when it is public. Non-public
			// originals are skipped rather than leaking their content through a
			// recommendation.
			if (plainRenote && note.renote?.visibility !== 'public') return [];
			const plainPublicRenote = plainRenote && note.renote?.visibility === 'public';
			const pureTwoHopRenote = source === 'twoHop' && plainPublicRenote;
			// Keep the renoter as the social signal, but score the note the reader
			// will actually see. Quotes intentionally retain their own wrapper here.
			const rankingNote = plainRenote ? note.renote! : note;
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
			const quality = 4 * Math.log1p(twoHopProof.get(note.userId) ?? 0) + 5 * Math.log1p(reactionAffinity.get(note.userId) ?? 0) + 6 * Math.log1p(renoteAffinity.get(note.userId) ?? 0) + 4 * Math.log1p(favoriteAffinity.get(note.userId) ?? 0) + settings.reactionBonus * Math.log1p(reactions) + 1.5 * Math.log1p(rankingNote.renoteCount) + (rankingNote.visibility === 'public' ? settings.publicBonus : 0) + (rankingNote.user?.host == null ? settings.localUserBonus : 0) + (pureTwoHopRenote ? settings.twoHopRenoteBonus : 0) + (boosted ? settings.boostBonus : 0) - (rankingNote.fileIds.some(id => sensitiveFileIds.has(id)) ? settings.sensitivePenalty : 0) - (rankingNote.user?.isBot ? settings.botPenalty : 0) - (negative ? settings.negativePenalty : 0);
			return [{ id: note.id, displayId, targetId: this.targetId(note), authorId: rankingNote.userId, source, forced: isForced, quality, freshness, balanced: quality + freshness * 4 }];
		});
		// A plain renote and its original note represent one thing to the reader.
		// Keep the stronger candidate before splitting forced and regular slots.
		const uniqueScored = [...scored].sort((a, b) => b.quality - a.quality).filter((item, index, items) => items.findIndex(other => other.targetId === item.targetId) === index);
		const forced = uniqueScored.filter(item => item.forced).slice(0, settings.forcedLimit);
		const forcedTargets = new Set(forced.map(item => item.targetId));
		const selectionSettings = resultLimit === settings.resultLimit ? settings : { ...settings, resultLimit };
		const selected = this.selectSources(uniqueScored.filter(item => !item.forced && !forcedTargets.has(item.targetId)), selectionSettings, true);
		// Forced rules are priority rules, not merely a score bonus. Keep these at the
		// head of the fixed snapshot. When the user asks to mix Home, retain the Home
		// portion's chronological order while leaving the other sources score-mixed.
		const regular = includeFollowing
			? [...selected.filter(item => item.source === 'following').sort((a, b) => b.id.localeCompare(a.id)), ...this.interleave(selected.filter(item => item.source !== 'following'), settings, seed)]
			: this.interleave(selected, settings, seed);
		return [...forced, ...regular].slice(0, resultLimit).map(item => item.displayId);
	}

	private selectSources<T extends { id: string; source: string; authorId: string; targetId: string; quality: number }>(items: T[], settings: Settings, includeFollowing: boolean): T[] {
		const bySource = new Map(['following', 'twoHop', 'unknown'].map(source => [source, items.filter(item => item.source === source).sort((a, b) => b.quality - a.quality)]));
		const percentages: Array<[string, number]> = includeFollowing
			? [['twoHop', settings.twoHopPercent], ['following', settings.followingPercent], ['unknown', settings.unknownPercent]]
			: [['twoHop', settings.twoHopPercent], ['unknown', settings.unknownPercent]];
		if (percentages.every(([, percent]) => percent === 0)) percentages[0]![1] = 100;
		const out: T[] = []; const counts = new Map<string, number>(); const targets = new Set<string>();
		for (let i = 0; i < settings.resultLimit; i++) {
			const wanted = [...percentages].sort((a, b) => ((out.filter(item => item.source === a[0]).length + 1) / Math.max(a[1], 1)) - ((out.filter(item => item.source === b[0]).length + 1) / Math.max(b[1], 1)))[0]![0];
			const sources = [wanted, ...percentages.map(x => x[0]).filter(source => source !== wanted)];
			let picked: T | undefined;
			for (const source of sources) {
				const list = bySource.get(source) ?? [];
				picked = list.find(item => !targets.has(item.targetId) && (counts.get(item.authorId) ?? 0) < settings.maxNotesPerAuthor);
				if (picked != null) { list.splice(list.indexOf(picked), 1); break; }
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
		for (const type of order) { const item = pools[type].find(x => !used.has(x)); if (item != null) { output.push(item); used.add(item); } }
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

	private targetId(note: { id: string; renoteId: string | null; text?: string | null; cw?: string | null }): string {
		return note.renoteId != null && (note.text == null || note.text === '') && (note.cw == null || note.cw === '') ? note.renoteId : note.id;
	}

	private async markSeen(userId: string, resultKey: string, noteIds: string[], settings: Settings): Promise<void> {
		if (noteIds.length === 0) return;
		const key = `torikago:recommended:${recommendationCacheVersion}:seen:${userId}`;
		const now = Date.now();
		const pipeline = this.redisClient.pipeline();
		for (const id of noteIds) pipeline.zadd(key, now, id);
		pipeline.sadd(`${resultKey}:seen`, ...noteIds);
		pipeline.expire(`${resultKey}:seen`, settings.snapshotHours * 3600);
		pipeline.zremrangebyscore(key, 0, now - settings.seenDays * 86400000);
		pipeline.expire(key, settings.seenDays * 86400);
		await pipeline.exec();
		const count = await this.redisClient.zcard(key);
		if (count > settings.seenLimit) await this.redisClient.zremrangebyrank(key, 0, count - settings.seenLimit - 1);
	}
}
