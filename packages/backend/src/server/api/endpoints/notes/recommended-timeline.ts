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
	sensitivePenalty: number;
	twoHopRenoteBonus: number;
	negativePenalty: number;
	forcedLimit: number;
	forcedAccounts: string[];
	negativeWords: string[];
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
	sensitivePenalty: 6,
	twoHopRenoteBonus: 6,
	negativePenalty: 8,
	forcedLimit: 3,
	forcedAccounts: [],
	negativeWords: [],
	negativeAccounts: [],
};

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
			const resultKey = `torikago:recommended:snapshot:${me.id}:${ps.snapshotId}:${ps.includeFollowing ? 'home' : 'discovery'}`;
			let resultIds = await this.redisClient.lrange(resultKey, 0, -1);
			if (resultIds.length === 0) {
				// The host has a known midnight load spike. Existing snapshots remain
				// readable, but avoid starting the relatively expensive first ranking
				// pass during this window. A later manual refresh will generate it.
				if (this.isMidnightProtectionWindow()) return [];
				resultIds = await this.buildRecommendation(me, ps.includeFollowing, settings);
				const pipeline = this.redisClient.pipeline().del(resultKey);
				if (resultIds.length > 0) pipeline.rpush(resultKey, ...resultIds);
				pipeline.expire(resultKey, settings.snapshotHours * 3600);
				pipeline.set(`${resultKey}:version`, (await this.redisForTimelines.get('torikago:recommended:version')) ?? '0', 'EX', settings.snapshotHours * 3600);
				await pipeline.exec();
			}

			const offset = ps.untilId == null ? 0 : Math.max(0, resultIds.indexOf(ps.untilId) + 1);
			const pageIds = resultIds.slice(offset, offset + ps.limit * 4);
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
			const ordered = pageIds.map(id => noteMap.get(id)).filter(note => note != null)
				.filter(note => ps.withSensitive || !note.fileIds.some(id => sensitiveFileIds.has(id))).slice(0, ps.limit);
			await this.markSeen(me.id, ordered.map(note => this.targetId(note)), settings);
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
			maxNotesPerAuthor: integer('maxNotesPerAuthor', 1, 10), publicBonus: integer('publicBonus', 0, 100), sensitivePenalty: integer('sensitivePenalty', 0, 100),
			twoHopRenoteBonus: integer('twoHopRenoteBonus', 0, 100), negativePenalty: integer('negativePenalty', 0, 100), forcedLimit: integer('forcedLimit', 0, 20),
			forcedAccounts: strings('forcedAccounts'), negativeWords: strings('negativeWords'), negativeAccounts: strings('negativeAccounts'),
		};
	}

	private async buildRecommendation(me: MiLocalUser, includeFollowing: boolean, settings: Settings): Promise<string[]> {
		const candidateIds = await this.redisForTimelines.lrange('torikago:recommended:candidates', 0, settings.candidateScanLimit - 1);
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
		if (candidateIds.length === 0 && (!includeFollowing || directIds.length === 0)) return [];

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
		// must not crowd out the Home-like portion of the timeline before scoring.
		const noteLists = await Promise.all([
			candidateIds.length > 0 ? createVisibleQuery().andWhere('note.id = ANY(:candidateIds)', { candidateIds }).getMany() : [],
			includeFollowing ? createVisibleQuery().andWhere('note.userId = ANY(:directIds)', { directIds }).andWhere('note.id >= :oldestId', { oldestId: this.idService.gen(Date.now() - 7 * 86400000) }).getMany() : [],
		]);
		const notes = [...new Map(noteLists.flat().map(note => [note.id, note])).values()].sort((a, b) => b.id.localeCompare(a.id));
		const fileIds = [...new Set(notes.flatMap(note => note.fileIds))];
		const sensitiveFileIds = new Set((await this.driveFilesRepository.find({ select: { id: true }, where: { id: In(fileIds), isSensitive: true } })).map(file => file.id));
		const seen = new Set(await this.redisClient.zrangebyscore(`torikago:recommended:seen:${me.id}`, Date.now() - settings.seenDays * 86400000, '+inf'));
		const forcedWords = (this.serverSettings.recommendedTimelineForcedWords ?? []).map(word => word.toLocaleLowerCase());
		const now = Date.now();
		const normalizedAccounts = (accounts: string[]) => new Set(accounts.map(x => x.trim().replace(/^@/, '').toLocaleLowerCase()).filter(Boolean));
		const forcedAccounts = normalizedAccounts(settings.forcedAccounts);
		const negativeAccounts = normalizedAccounts(settings.negativeAccounts);
		const negativeWords = settings.negativeWords.map(word => word.toLocaleLowerCase());
		const accountName = (note: typeof notes[number]) => `${note.user?.username ?? ''}${note.user?.host ? `@${note.user.host}` : ''}`.toLocaleLowerCase();
		const scored = notes.filter(note => !seen.has(this.targetId(note))).map(note => {
			const source = directSet.has(note.userId) ? 'following' : twoHopProof.has(note.userId) ? 'twoHop' : 'unknown';
			const reactions = Object.values(note.reactions).reduce((sum, count) => sum + count, 0);
			const ageHours = Math.max(0, (now - this.idService.parse(note.id).date.getTime()) / 3600000);
			const freshness = Math.pow(0.5, ageHours / 8);
			const text = `${note.cw ?? ''}\n${note.text ?? ''}`.toLocaleLowerCase();
			const isForced = forcedWords.some(word => text.includes(word)) || forcedAccounts.has(accountName(note));
			const negative = negativeWords.some(word => text.includes(word)) || negativeAccounts.has(accountName(note));
			const pureTwoHopRenote = source === 'twoHop' && note.renote != null && note.renote.visibility === 'public' && (note.text == null || note.text === '');
			const quality = 4 * Math.log1p(twoHopProof.get(note.userId) ?? 0) + 5 * Math.log1p(reactionAffinity.get(note.userId) ?? 0) + 6 * Math.log1p(renoteAffinity.get(note.userId) ?? 0) + 4 * Math.log1p(favoriteAffinity.get(note.userId) ?? 0) + Math.log1p(reactions) + 1.5 * Math.log1p(note.renoteCount) + (note.visibility === 'public' ? settings.publicBonus : 0) + (pureTwoHopRenote ? settings.twoHopRenoteBonus : 0) - (note.fileIds.some(id => sensitiveFileIds.has(id)) ? settings.sensitivePenalty : 0) - (negative ? settings.negativePenalty : 0);
			return { id: note.id, targetId: this.targetId(note), authorId: note.userId, source, forced: isForced, quality, freshness, balanced: quality + freshness * 4 };
		});
		const forced = scored.filter(item => item.forced).sort((a, b) => b.quality - a.quality).slice(0, settings.forcedLimit);
		const selected = this.selectSources(scored.filter(item => !item.forced), settings, includeFollowing);
		// Forced rules are priority rules, not merely a score bonus. Keep these at the
		// head of the fixed snapshot, then mix all regular sources below them.
		return [...forced, ...this.interleave(selected, settings)].slice(0, settings.resultLimit).map(item => item.id);
	}

	private selectSources<T extends { source: string; authorId: string; targetId: string; quality: number }>(items: T[], settings: Settings, includeFollowing: boolean): T[] {
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

	private interleave<T extends { quality: number; freshness: number; balanced: number }>(items: T[], settings: Settings): T[] {
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
		for (const item of pools.balanced) if (!used.has(item)) output.push(item);
		return output;
	}

	private targetId(note: { id: string; renoteId: string | null; text?: string | null }): string {
		return note.renoteId != null && (note.text == null || note.text === '') ? note.renoteId : note.id;
	}

	private async markSeen(userId: string, noteIds: string[], settings: Settings): Promise<void> {
		if (noteIds.length === 0) return;
		const key = `torikago:recommended:seen:${userId}`; const now = Date.now(); const pipeline = this.redisClient.pipeline();
		for (const id of noteIds) pipeline.zadd(key, now, id);
		pipeline.zremrangebyscore(key, 0, now - settings.seenDays * 86400000); pipeline.expire(key, settings.seenDays * 86400);
		await pipeline.exec();
		const count = await this.redisClient.zcard(key);
		if (count > settings.seenLimit) await this.redisClient.zremrangebyrank(key, 0, count - settings.seenLimit - 1);
	}
}
