/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { UserMemoRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { normalizeDislikedEmoji } from '@/misc/normalize-disliked-emoji.js';

export const meta = { tags: ['account'], requireCredential: true, kind: 'write:account' } as const;
export const paramDef = {
	type: 'object',
	properties: { userId: { type: 'string', format: 'misskey:id' }, emoji: { type: 'string', minLength: 1, maxLength: 255 } },
	required: ['userId', 'emoji'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(@Inject(DI.userMemosRepository) private userMemosRepository: UserMemoRepository) {
		super(meta, paramDef, async (ps, me) => {
			await this.userMemosRepository.createQueryBuilder().update()
				.set({ dislikedEmojis: () => 'array_remove("dislikedEmojis", :emoji)' })
				.where('"userId" = :userId AND "targetUserId" = :targetUserId', { userId: me.id, targetUserId: ps.userId })
				.setParameter('emoji', normalizeDislikedEmoji(ps.emoji)).execute();
			await this.userMemosRepository.createQueryBuilder().delete()
				.where('"userId" = :userId AND "targetUserId" = :targetUserId', { userId: me.id, targetUserId: ps.userId })
				.andWhere('memo = :memo', { memo: '' })
				.andWhere('cardinality("dislikedEmojis") = 0').execute();
		});
	}
}
