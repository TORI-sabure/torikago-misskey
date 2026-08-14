/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { UserProfilesRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '../../../error.js';
import { normalizeDislikedEmoji } from '@/misc/normalize-disliked-emoji.js';
import { CacheService } from '@/core/CacheService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	kind: 'write:admin:disliked-emojis',
	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: 'd8c2dc04-9d74-47fd-91ec-263943d0cab1',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'misskey:id' },
		emoji: { type: 'string', minLength: 1, maxLength: 255 },
	},
	required: ['userId', 'emoji'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,
		private cacheService: CacheService,
	) {
		super(meta, paramDef, async (ps) => {
			const profile = await this.userProfilesRepository.findOne({
				where: { userId: ps.userId },
				select: { dislikedEmojis: true },
			});
			if (profile == null) throw new ApiError(meta.errors.noSuchUser);
			const emoji = normalizeDislikedEmoji(ps.emoji);
			await this.userProfilesRepository.createQueryBuilder()
				.update()
				.set({ dislikedEmojis: () => 'array_append("dislikedEmojis", :emoji)' })
				.where('"userId" = :userId', { userId: ps.userId })
				.andWhere('NOT (:emoji = ANY("dislikedEmojis"))')
				.andWhere('cardinality("dislikedEmojis") < 100')
				.setParameter('emoji', emoji)
				.execute();
			await this.cacheService.userProfileCache.delete(ps.userId);
		});
	}
}
