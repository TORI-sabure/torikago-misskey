/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { UserProfilesRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { normalizeDislikedEmoji } from '@/misc/normalize-disliked-emoji.js';
import { CacheService } from '@/core/CacheService.js';

export const meta = {
	tags: ['account'],
	requireCredential: true,
	kind: 'write:account',
} as const;

export const paramDef = {
	type: 'object',
	properties: { emoji: { type: 'string', minLength: 1, maxLength: 255 } },
	required: ['emoji'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,
		private cacheService: CacheService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const emoji = normalizeDislikedEmoji(ps.emoji);
			await this.userProfilesRepository.createQueryBuilder()
				.update()
				.set({ dislikedEmojis: () => 'array_append("dislikedEmojis", :emoji)' })
				.where('"userId" = :userId', { userId: me.id })
				.andWhere('NOT (:emoji = ANY("dislikedEmojis"))')
				.andWhere('cardinality("dislikedEmojis") < 100')
				.setParameter('emoji', emoji)
				.execute();
			await this.cacheService.userProfileCache.delete(me.id);
		});
	}
}
