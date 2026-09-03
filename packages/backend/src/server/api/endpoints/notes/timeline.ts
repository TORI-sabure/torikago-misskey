/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Brackets } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type { NotesRepository, MiMeta } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { QueryService } from '@/core/QueryService.js';
import ActiveUsersChart from '@/core/chart/charts/active-users.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { DI } from '@/di-symbols.js';
import { IdService } from '@/core/IdService.js';
import { CacheService } from '@/core/CacheService.js';
import { UserFollowingService } from '@/core/UserFollowingService.js';
import { MiLocalUser } from '@/models/User.js';
import { FanoutTimelineEndpointService } from '@/core/FanoutTimelineEndpointService.js';
import { ChannelMutingService } from '@/core/ChannelMutingService.js';
import { ChannelFollowingService } from '@/core/ChannelFollowingService.js';

export const meta = {
	tags: ['notes'],

	requireCredential: true,
	kind: 'read:account',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'Note',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
		sinceDate: { type: 'integer' },
		untilDate: { type: 'integer' },
		allowPartial: { type: 'boolean', default: false }, // true is recommended but for compatibility false by default
		includeMyRenotes: { type: 'boolean', default: true },
		includeRenotedMyNotes: { type: 'boolean', default: true },
		includeLocalRenotes: { type: 'boolean', default: true },
		withFiles: { type: 'boolean', default: false },
		withRenotes: { type: 'boolean', default: true },
		mutualOnly: { type: 'boolean', default: false },
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

		private noteEntityService: NoteEntityService,
		private activeUsersChart: ActiveUsersChart,
		private idService: IdService,
		private cacheService: CacheService,
		private fanoutTimelineEndpointService: FanoutTimelineEndpointService,
		private userFollowingService: UserFollowingService,
		private channelMutingService: ChannelMutingService,
		private channelFollowingService: ChannelFollowingService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const untilId = ps.untilId ?? (ps.untilDate ? this.idService.gen(ps.untilDate!) : null);
			const sinceId = ps.sinceId ?? (ps.sinceDate ? this.idService.gen(ps.sinceDate!) : null);

			if (ps.mutualOnly) {
				// HTL縺ｨ蜷後§繝輔か繝ｭ繝ｼ繧ｭ繝｣繝・す繝･縺ｧ縲瑚・蛻・竊・謚慕ｨｿ閠・阪ｒ蜈医↓邨槭ｊ縲・				// 蛟呵｣懊↓蟇ｾ縺吶ｋ縲梧兜遞ｿ閠・竊・閾ｪ蛻・阪□縺代ｒDB縺ｧ荳諡ｬ遒ｺ隱阪☆繧九・				const followings = await this.cacheService.userFollowingsCache.fetch(me.id);
				const mutualFolloweeIds = await this.userFollowingService.getMutualFolloweeIds(me.id, Object.keys(followings));
				const mutualUserIds = [me.id, ...mutualFolloweeIds];
				const mutualUserIdSet = new Set(mutualUserIds);

				const getMutualFromDb = async (untilId: string | null, sinceId: string | null, limit: number) => await this.getFromDb({
					untilId,
					sinceId,
					limit,
					includeMyRenotes: ps.includeMyRenotes,
					includeRenotedMyNotes: ps.includeRenotedMyNotes,
					includeLocalRenotes: ps.includeLocalRenotes,
					withFiles: ps.withFiles,
					withRenotes: ps.withRenotes,
					mutualOnly: true,
					mutualUserIds,
				}, me);

				// 逶ｸ莠偵Θ繝ｼ繧ｶ繝ｼ縺後＞縺ｪ縺・ｴ蜷医・縲？TL蜈ｨ菴薙ｒ襍ｰ譟ｻ縺帙★閾ｪ蛻・・繝弱・繝医□縺代ｒDB縺九ｉ蜿門ｾ励☆繧九・				if (!this.serverSettings.enableFanoutTimeline || mutualFolloweeIds.length === 0) {
					const timeline = await getMutualFromDb(untilId, sinceId, ps.limit);

					process.nextTick(() => {
						this.activeUsersChart.read(me);
					});

					return await this.noteEntityService.packMany(timeline, me);
				}

				const timeline = await this.fanoutTimelineEndpointService.timeline({
					untilId,
					sinceId,
					limit: ps.limit,
					allowPartial: ps.allowPartial,
					me,
					useDbFallback: this.serverSettings.enableFanoutTimelineDbFallback,
					redisTimelines: ps.withFiles ? [`homeTimelineWithFiles:${me.id}`] : [`homeTimeline:${me.id}`],
					alwaysIncludeMyNotes: true,
					excludePureRenotes: !ps.withRenotes,
					noteFilter: note => {
						if (!mutualUserIdSet.has(note.userId)) return false;
						if (note.reply && note.reply.visibility === 'followers') {
							if (!Object.hasOwn(followings, note.reply.userId) && note.reply.userId !== me.id) return false;
						}

						return true;
					},
					dbFallback: getMutualFromDb,
				});

				process.nextTick(() => {
					this.activeUsersChart.read(me);
				});

				return timeline;
			}

			if (!this.serverSettings.enableFanoutTimeline) {
				const timeline = await this.getFromDb({
					untilId,
					sinceId,
					limit: ps.limit,
					includeMyRenotes: ps.includeMyRenotes,
					includeRenotedMyNotes: ps.includeRenotedMyNotes,
					includeLocalRenotes: ps.includeLocalRenotes,
					withFiles: ps.withFiles,
					withRenotes: ps.withRenotes,
					mutualOnly: false,
				}, me);

				process.nextTick(() => {
					this.activeUsersChart.read(me);
				});

				return await this.noteEntityService.packMany(timeline, me);
			}
			const [
				followings,
			] = await Promise.all([
				this.cacheService.userFollowingsCache.fetch(me.id),
			]);

			const timeline = this.fanoutTimelineEndpointService.timeline({
				untilId,
				sinceId,
				limit: ps.limit,
				allowPartial: ps.allowPartial,
				me,
				useDbFallback: this.serverSettings.enableFanoutTimelineDbFallback,
				redisTimelines: ps.withFiles ? [`homeTimelineWithFiles:${me.id}`] : [`homeTimeline:${me.id}`],
				alwaysIncludeMyNotes: true,
				excludePureRenotes: !ps.withRenotes,
				noteFilter: note => {
					if (note.reply && note.reply.visibility === 'followers') {
						if (!Object.hasOwn(followings, note.reply.userId) && note.reply.userId !== me.id) return false;
					}

					return true;
				},
				dbFallback: async (untilId, sinceId, limit) => await this.getFromDb({
					untilId,
					sinceId,
					limit,
					includeMyRenotes: ps.includeMyRenotes,
					includeRenotedMyNotes: ps.includeRenotedMyNotes,
					includeLocalRenotes: ps.includeLocalRenotes,
					withFiles: ps.withFiles,
					withRenotes: ps.withRenotes,
					mutualOnly: false,
				}, me),
			});

			process.nextTick(() => {
				this.activeUsersChart.read(me);
			});

			return timeline;
		});
	}

	private async getFromDb(ps: { untilId: string | null; sinceId: string | null; limit: number; includeMyRenotes: boolean; includeRenotedMyNotes: boolean; includeLocalRenotes: boolean; withFiles: boolean; withRenotes: boolean; mutualOnly: boolean; mutualUserIds?: string[]; }, me: MiLocalUser) {
		// 逶ｸ莠探L縺ｯ蜈医↓蟇ｾ雎｡繝ｦ繝ｼ繧ｶ繝ｼ繧堤ｵ槭ｋ縲ゅヮ繝ｼ繝郁｡ｨ繧貞ｺ・￥襍ｰ譟ｻ縺励※繝輔か繝ｭ繝ｼ髢｢菫ゅｒ邨仙粋縺吶ｋ繧医ｊ縲・		// 繝帙・繝TL縺ｨ蜷梧ｧ倥↓謚慕ｨｿ閠・D縺ｧ邨槭ｋ縺ｻ縺・′縲∝ｯｾ雎｡謚慕ｨｿ縺悟商縺・・蟄伜惠縺励↑縺・ｴ蜷医〒繧るｫ倬溘↓縺ｪ繧九・		const mutualUserIds = ps.mutualOnly
			? (ps.mutualUserIds ?? [me.id, ...await this.userFollowingService.getMutualFolloweeIds(me.id)])
			: [];
		const followees = ps.mutualOnly ? [] : await this.userFollowingService.getFollowees(me.id);

		const mutingChannelIds = ps.mutualOnly ? [] : await this.channelMutingService
			.list({ requestUserId: me.id }, { idOnly: true })
			.then(x => x.map(x => x.id));
		const followingChannelIds = ps.mutualOnly ? [] : await this.channelFollowingService
			.list({ requestUserId: me.id }, { idOnly: true })
			.then(x => x.map(x => x.id).filter(x => !mutingChannelIds.includes(x)));

		//#region Construct query
		const query = this.queryService.makePaginationQuery(this.notesRepository.createQueryBuilder('note'), ps.sinceId, ps.untilId)
			.innerJoinAndSelect('note.user', 'user')
			.leftJoinAndSelect('note.reply', 'reply')
			.leftJoinAndSelect('note.renote', 'renote')
			.leftJoinAndSelect('reply.user', 'replyUser')
			.leftJoinAndSelect('renote.user', 'renoteUser');

		if (ps.mutualOnly) {
			query
				.andWhere('note.channelId IS NULL')
				.andWhere('note.userId IN (:...mutualUserIds)', { mutualUserIds });
		} else {
		if (followees.length > 0 && followingChannelIds.length > 0) {
			// 繝ｦ繝ｼ繧ｶ繝ｼ繝ｻ繝√Ε繝ｳ繝阪Ν縺ｨ繧ゅ↓繝輔か繝ｭ繝ｼ縺ゅｊ
			const meOrFolloweeIds = [me.id, ...followees.map(f => f.followeeId)];
			query.andWhere(new Brackets(qb => {
				qb
					.where(new Brackets(qb2 => {
						qb2
							.andWhere('note.userId IN (:...meOrFolloweeIds)', { meOrFolloweeIds: meOrFolloweeIds })
							.andWhere('note.channelId IS NULL');
					}))
					.orWhere('note.channelId IN (:...followingChannelIds)', { followingChannelIds });
			}));
		} else if (followees.length > 0) {
			// 繝ｦ繝ｼ繧ｶ繝ｼ繝輔か繝ｭ繝ｼ縺ｮ縺ｿ・医メ繝｣繝ｳ繝阪Ν繝輔か繝ｭ繝ｼ縺ｪ縺暦ｼ・			const meOrFolloweeIds = [me.id, ...followees.map(f => f.followeeId)];
			query.andWhere(new Brackets(qb => {
				qb
					.andWhere('note.channelId IS NULL')
					.andWhere('note.userId IN (:...meOrFolloweeIds)', { meOrFolloweeIds: meOrFolloweeIds });
				if (mutingChannelIds.length > 0) {
					qb.andWhere(new Brackets(qb2 => {
						qb2.orWhere('note.renoteChannelId IS NULL');
						qb2.orWhere('note.renoteChannelId NOT IN (:...mutingChannelIds)', { mutingChannelIds });
					}));
				}
			}));
		} else if (followingChannelIds.length > 0) {
			// 繝√Ε繝ｳ繝阪Ν繝輔か繝ｭ繝ｼ縺ｮ縺ｿ・医Θ繝ｼ繧ｶ繝ｼ繝輔か繝ｭ繝ｼ縺ｪ縺暦ｼ・			query.andWhere(new Brackets(qb => {
				qb
					// renoteChannelId縺ｯ隕九ｋ蠢・ｦ√′辟｡縺・					// 繝ｻHTL縺ｫ豬√ｌ縺ｦ縺上ｋ繝√Ε繝ｳ繝阪Ν・昴ヵ繧ｩ繝ｭ繝ｼ縺励※縺・ｋ繝√Ε繝ｳ繝阪Ν
					// 繝ｻHTL縺ｫ繝輔か繝ｭ繝ｼ螟悶・繝√Ε繝ｳ繝阪Ν縺梧ｵ√ｌ繧九・縺ｯ縲√ヵ繧ｩ繝ｭ繝ｼ縺励※縺・ｋ繝ｦ繝ｼ繧ｶ縺後◎縺ｮ繝√Ε繝ｳ繝阪Ν謚慕ｨｿ繧偵Μ繝弱・繝医＠縺溷ｴ蜷医・縺ｿ
					// 縺､縺ｾ繧翫√Θ繝ｼ繧ｶ繝輔か繝ｭ繝ｼ縺励※縺ｪ縺・燕謠舌・縺薙・繝悶Ο繝・け縺ｧ縺ｯ隕九ｋ蠢・ｦ√′辟｡縺・					.where('note.channelId IN (:...followingChannelIds)', { followingChannelIds })
					.orWhere('note.userId = :meId', { meId: me.id });
			}));
		} else {
			// 繝輔か繝ｭ繝ｼ縺ｪ縺・			query.andWhere(new Brackets(qb => {
				qb
					.andWhere('note.channelId IS NULL')
					.andWhere('note.userId = :meId', { meId: me.id });
			}));
		}
		}

		query.andWhere(new Brackets(qb => {
			qb
				.where('note.replyId IS NULL') // 霑比ｿ｡縺ｧ縺ｯ縺ｪ縺・				.orWhere(new Brackets(qb => {
					qb // 霑比ｿ｡縺縺代←謚慕ｨｿ閠・・霄ｫ縺ｸ縺ｮ霑比ｿ｡
						.where('note.replyId IS NOT NULL')
						.andWhere('note.replyUserId = note.userId');
				}));
		}));

		this.queryService.generateVisibilityQuery(query, me);
		this.queryService.generateBaseNoteFilteringQuery(query, me);
		this.queryService.generateMutedUserRenotesQueryForNotes(query, me);

		if (ps.includeMyRenotes === false) {
			query.andWhere(new Brackets(qb => {
				qb.orWhere('note.userId != :meId', { meId: me.id });
				qb.orWhere('note.renoteId IS NULL');
				qb.orWhere('note.text IS NOT NULL');
				qb.orWhere('note.fileIds != \'{}\'');
				qb.orWhere('0 < (SELECT COUNT(*) FROM poll WHERE poll."noteId" = note.id)');
			}));
		}

		if (ps.includeRenotedMyNotes === false) {
			query.andWhere(new Brackets(qb => {
				qb.orWhere('note.renoteUserId != :meId', { meId: me.id });
				qb.orWhere('note.renoteId IS NULL');
				qb.orWhere('note.text IS NOT NULL');
				qb.orWhere('note.fileIds != \'{}\'');
				qb.orWhere('0 < (SELECT COUNT(*) FROM poll WHERE poll."noteId" = note.id)');
			}));
		}

		if (ps.includeLocalRenotes === false) {
			query.andWhere(new Brackets(qb => {
				qb.orWhere('note.renoteUserHost IS NOT NULL');
				qb.orWhere('note.renoteId IS NULL');
				qb.orWhere('note.text IS NOT NULL');
				qb.orWhere('note.fileIds != \'{}\'');
				qb.orWhere('0 < (SELECT COUNT(*) FROM poll WHERE poll."noteId" = note.id)');
			}));
		}

		if (ps.withFiles) {
			query.andWhere('note.fileIds != \'{}\'');
		}

		if (ps.withRenotes === false) {
			query.andWhere(new Brackets(qb => {
				qb.orWhere('note.renoteId IS NULL');
				qb.orWhere(new Brackets(qb => {
					qb.orWhere('note.text IS NOT NULL');
					qb.orWhere('note.fileIds != \'{}\'');
					qb.orWhere('0 < (SELECT COUNT(*) FROM poll WHERE poll."noteId" = note.id)');
				}));
			}));
		}
		//#endregion

		return await query.limit(ps.limit).getMany();
	}
}


