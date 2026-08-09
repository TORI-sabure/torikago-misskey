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
			id: 'fe19a93c-317b-4094-b867-8f18132c7cff',
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
			await this.userProfilesRepository.createQueryBuilder()
				.update()
				.set({ dislikedEmojis: () => 'array_remove("dislikedEmojis", :emoji)' })
				.where('"userId" = :userId', { userId: ps.userId })
				.setParameter('emoji', normalizeDislikedEmoji(ps.emoji))
				.execute();
			await this.cacheService.userProfileCache.delete(ps.userId);
		});
	}
}
