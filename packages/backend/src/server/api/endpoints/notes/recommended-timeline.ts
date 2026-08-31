/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Brackets, In } from 'typeorm';
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

const RESULT_LIMIT = 100;
const TWO_HOP_AUTHOR_LIMIT = 80;
const CANDIDATE_LIMIT = 400;
const CANDIDATE_POOL_LIMIT = 3000;
const CANDIDATE_AGE_MS = 24 * 60 * 60 * 1000;
const RESULT_TTL_SECONDS = 10 * 60;
const SEEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const SEEN_LIMIT = 1000;

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
	},
	res: {
		type: 'array',
		optional: false, nullable: false,
		items: { type: 'object', optional: false, nullable: false, ref: 'Note' },
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		untilId: { type: 'string', format: 'misskey:id' },
		includeFollowing: { type: 'boolean', default: true },
		withFiles: { type: 'boolean', default: false },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.meta)
		private serverSettings: MiMeta,
		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,
		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,
		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,
		@Inject(DI.noteReactionsRepository)
		private noteReactionsRepository: NoteReactionsRepository,
		@Inject(DI.noteFavoritesRepository)
		private noteFavoritesRepository: NoteFavoritesRepository,
		@Inject(DI.redis)
		private redisClient: Redis.Redis,
		@Inject(DI.redisForTimelines)
		private redisForTimelines: Redis.Redis,
		private queryService: QueryService,
		private noteEntityService: NoteEntityService,
		private idService: IdService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!this.serverSettings.enableRecommendedTimeline) throw new ApiError(meta.errors.featureDisabled);
			const resultKey = `torikago:recommended:result:${me.id}:${ps.includeFollowing ? 'with-following' : 'discovery'}:${ps.withFiles ? 'files' : 'all'}`;
			let resultIds = await this.redisClient.lrange(resultKey, 0, -1);

			if (resultIds.length === 0 || ps.untilId == null) {
				resultIds = await this.buildRecommendation(me, ps.includeFollowing, ps.withFiles);
				const pipeline = this.redisClient.pipeline().del(resultKey);
				if (resultIds.length > 0) pipeline.rpush(resultKey, ...resultIds);
				pipeline.expire(resultKey, RESULT_TTL_SECONDS);
				await pipeline.exec();
			}

			const offset = ps.untilId == null ? 0 : Math.max(0, resultIds.indexOf(ps.untilId) + 1);
			const pageIds = resultIds.slice(offset, offset + ps.limit);
			if (pageIds.length === 0) return [];

			const notes = await this.notesRepository.find({
				where: { id: In(pageIds) },
				relations: { user: true, reply: { user: true }, renote: { user: true } },
			});
			const noteMap = new Map(notes.map(note => [note.id, note]));
			const ordered = pageIds.map(id => noteMap.get(id)).filter(note => note != null);

			await this.markSeen(me.id, ordered.map(note => note.renoteId ?? note.id));
			return await this.noteEntityService.packMany(ordered, me);
		});
	}

	private async buildRecommendation(me: MiLocalUser, includeFollowing: boolean, withFiles: boolean): Promise<string[]> {
		const candidateIds = await this.redisForTimelines.lrange('torikago:recommended:candidates', 0, CANDIDATE_POOL_LIMIT - 1);
		const directRows = await this.followingsRepository.find({
			select: { followeeId: true },
			where: { followerId: me.id },
		});
		const directIds = directRows.map(row => row.followeeId);

		const twoHopRows: { userId: string; socialProof: string }[] = directIds.length === 0 ? [] : await this.followingsRepository.createQueryBuilder('following')
			.select('following.followeeId', 'userId')
			.addSelect('COUNT(*)', 'socialProof')
			.where('following.followerId IN (:...directIds)', { directIds })
			.andWhere('following.followeeId != :meId', { meId: me.id })
			.andWhere(directIds.length > 0 ? 'following.followeeId NOT IN (:...directIds)' : '1 = 1', { directIds })
			.groupBy('following.followeeId')
			.orderBy('COUNT(*)', 'DESC')
			.limit(TWO_HOP_AUTHOR_LIMIT)
			.getRawMany();

		const socialProof = new Map(twoHopRows.map(row => [row.userId, Number(row.socialProof)]));
		const discoveryIds = twoHopRows.map(row => row.userId);
		const authorIds = [...new Set([...(includeFollowing ? directIds : []), ...discoveryIds])];
		if (authorIds.length === 0) return [];
		if (candidateIds.length === 0 && (!includeFollowing || directIds.length === 0)) return [];

		const [reactionAffinityRows, favoriteAffinityRows, renoteAffinityRows] = await Promise.all([
			this.noteReactionsRepository.createQueryBuilder('reaction')
				.innerJoin('reaction.note', 'target')
				.select('target.userId', 'userId')
				.addSelect('COUNT(*)', 'count')
				.where('reaction.userId = :meId', { meId: me.id })
				.andWhere('target.userId IN (:...authorIds)', { authorIds })
				.groupBy('target.userId')
				.getRawMany<{ userId: string; count: string }>(),
			this.noteFavoritesRepository.createQueryBuilder('favorite')
				.innerJoin('favorite.note', 'target')
				.select('target.userId', 'userId')
				.addSelect('COUNT(*)', 'count')
				.where('favorite.userId = :meId', { meId: me.id })
				.andWhere('target.userId IN (:...authorIds)', { authorIds })
				.groupBy('target.userId')
				.getRawMany<{ userId: string; count: string }>(),
			this.notesRepository.createQueryBuilder('ownRenote')
				.innerJoin('ownRenote.renote', 'target')
				.select('target.userId', 'userId')
				.addSelect('COUNT(*)', 'count')
				.where('ownRenote.userId = :meId', { meId: me.id })
				.andWhere('ownRenote.id >= :oldestAffinityId', { oldestAffinityId: this.idService.gen(Date.now() - 90 * 24 * 60 * 60 * 1000) })
				.andWhere('target.userId IN (:...authorIds)', { authorIds })
				.groupBy('target.userId')
				.getRawMany<{ userId: string; count: string }>(),
		]);
		const reactionAffinity = new Map(reactionAffinityRows.map(row => [row.userId, Number(row.count)]));
		const favoriteAffinity = new Map(favoriteAffinityRows.map(row => [row.userId, Number(row.count)]));
		const renoteAffinity = new Map(renoteAffinityRows.map(row => [row.userId, Number(row.count)]));

		const query = this.notesRepository.createQueryBuilder('note')
			.innerJoinAndSelect('note.user', 'user')
			.leftJoinAndSelect('note.reply', 'reply')
			.leftJoinAndSelect('reply.user', 'replyUser')
			.leftJoinAndSelect('note.renote', 'renote')
			.leftJoinAndSelect('renote.user', 'renoteUser')
			.where(new Brackets(qb => {
				if (candidateIds.length > 0) qb.where('note.id IN (:...candidateIds)', { candidateIds });
				if (includeFollowing && directIds.length > 0) {
					const params = { directIds, oldestId: this.idService.gen(Date.now() - CANDIDATE_AGE_MS) };
					if (candidateIds.length > 0) qb.orWhere('note.userId IN (:...directIds) AND note.id >= :oldestId', params);
					else qb.where('note.userId IN (:...directIds) AND note.id >= :oldestId', params);
				}
			}))
			.andWhere('note.userId IN (:...authorIds)', { authorIds })
			.andWhere('note.channelId IS NULL')
			.andWhere('note.visibility != :specified', { specified: 'specified' })
			.andWhere(new Brackets(qb => {
				qb.where('note.userId IN (:...discoveryIds) AND (note.visibility = :public OR (note.visibility = :home AND note.tags != \'{}\'))', {
					discoveryIds: discoveryIds.length > 0 ? discoveryIds : [''],
					public: 'public',
					home: 'home',
				});
				if (includeFollowing && directIds.length > 0) qb.orWhere('note.userId IN (:...directIds)', { directIds });
			}))
			.orderBy('note.id', 'DESC')
			.take(CANDIDATE_LIMIT);

		if (withFiles) query.andWhere('note.fileIds != \'{}\'');
		this.queryService.generateVisibilityQuery(query, me);
		this.queryService.generateBaseNoteFilteringQuery(query, me);
		this.queryService.generateMutedUserRenotesQueryForNotes(query, me);

		const notes = await query.getMany();
		const fileIds = [...new Set(notes.flatMap(note => note.fileIds))];
		const sensitiveFileIds = fileIds.length === 0 ? new Set<string>() : new Set((await this.driveFilesRepository.find({
			select: { id: true },
			where: { id: In(fileIds), isSensitive: true },
		})).map(file => file.id));
		const seen = new Set(await this.redisClient.zrangebyscore(`torikago:recommended:seen:${me.id}`, Date.now() - SEEN_TTL_SECONDS * 1000, '+inf'));
		const now = Date.now();
		const forcedWords = this.serverSettings.recommendedTimelineForcedWords.map(word => word.toLocaleLowerCase());
		const scored = notes
			.filter(note => !seen.has(note.renoteId ?? note.id))
			.map(note => {
				const reactions = Object.values(note.reactions).reduce((sum, count) => sum + count, 0);
				const ageHours = Math.max(0, (now - this.idService.parse(note.id).date.getTime()) / 3_600_000);
				const recency = 4 * Math.pow(0.5, ageHours / 6);
				const discovery = 4 * Math.log1p(socialProof.get(note.userId) ?? 0);
				const engagement = Math.log1p(reactions) + 1.5 * Math.log1p(note.renoteCount);
				const affinity = 5 * Math.log1p(reactionAffinity.get(note.userId) ?? 0)
					+ 6 * Math.log1p(renoteAffinity.get(note.userId) ?? 0)
					+ 4 * Math.log1p(favoriteAffinity.get(note.userId) ?? 0);
				const sensitivePenalty = note.fileIds.some(id => sensitiveFileIds.has(id)) ? -6 : 0;
				const searchableText = `${note.cw ?? ''}\n${note.text ?? ''}`.toLocaleLowerCase();
				const forcedBonus = forcedWords.some(word => searchableText.includes(word)) ? 1000 : 0;
				return { id: note.id, targetId: note.renoteId ?? note.id, authorId: note.userId, score: forcedBonus + discovery + affinity + engagement + recency + sensitivePenalty };
			})
			.sort((a, b) => b.score - a.score || (a.id < b.id ? 1 : -1));

		const followingSet = new Set(directIds);
		const followingNotes = scored.filter(item => followingSet.has(item.authorId)).sort((a, b) => a.id < b.id ? 1 : -1);
		const discoveryNotes = scored.filter(item => !followingSet.has(item.authorId));
		const diverseDiscovery: typeof discoveryNotes = [];
		const authorCounts = new Map<string, number>();
		for (const item of discoveryNotes) {
			const authorCount = authorCounts.get(item.authorId) ?? 0;
			if (diverseDiscovery.length < 20 && authorCount >= 2) continue;
			diverseDiscovery.push(item);
			authorCounts.set(item.authorId, authorCount + 1);
		}

		const selected: string[] = [];
		const selectedTargets = new Set<string>();
		let followingIndex = 0;
		let discoveryIndex = 0;
		while (selected.length < RESULT_LIMIT && (followingIndex < followingNotes.length || discoveryIndex < diverseDiscovery.length)) {
			// Seven followed-account posts and three discovery posts per ten slots.
			const preferFollowing = includeFollowing && selected.length % 10 < 7;
			const primary = preferFollowing ? followingNotes : diverseDiscovery;
			const secondary = preferFollowing ? diverseDiscovery : followingNotes;
			const primaryIndex = preferFollowing ? followingIndex : discoveryIndex;
			const secondaryIndex = preferFollowing ? discoveryIndex : followingIndex;
			const item = primary[primaryIndex] ?? secondary[secondaryIndex];
			if (item == null) break;
			if (followingSet.has(item.authorId)) followingIndex++;
			else discoveryIndex++;
			if (selectedTargets.has(item.targetId)) continue;
			selected.push(item.id);
			selectedTargets.add(item.targetId);
		}
		return selected;
	}

	private async markSeen(userId: string, noteIds: string[]): Promise<void> {
		if (noteIds.length === 0) return;
		const key = `torikago:recommended:seen:${userId}`;
		const now = Date.now();
		const pipeline = this.redisClient.pipeline();
		for (const id of noteIds) pipeline.zadd(key, now, id);
		pipeline.zremrangebyscore(key, 0, now - SEEN_TTL_SECONDS * 1000);
		pipeline.expire(key, SEEN_TTL_SECONDS);
		await pipeline.exec();
		const count = await this.redisClient.zcard(key);
		if (count > SEEN_LIMIT) await this.redisClient.zremrangebyrank(key, 0, count - SEEN_LIMIT - 1);
	}
}
