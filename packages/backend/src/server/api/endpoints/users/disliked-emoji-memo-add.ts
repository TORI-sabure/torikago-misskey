/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { UserMemoRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { GetterService } from '@/server/api/GetterService.js';
import { IdService } from '@/core/IdService.js';
import { normalizeDislikedEmoji } from '@/misc/normalize-disliked-emoji.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['account'], requireCredential: true, kind: 'write:account',
	errors: { noSuchUser: { message: 'No such user.', code: 'NO_SUCH_USER', id: 'e127f532-5125-4831-a64a-83cb8ac35162' } },
} as const;
export const paramDef = {
	type: 'object',
	properties: { userId: { type: 'string', format: 'misskey:id' }, emoji: { type: 'string', minLength: 1, maxLength: 255 } },
	required: ['userId', 'emoji'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.userMemosRepository) private userMemosRepository: UserMemoRepository,
		private getterService: GetterService,
		private idService: IdService,
	) {
		super(meta, paramDef, async (ps, me) => {
			await this.getterService.getUser(ps.userId).catch(err => {
				if (err.id === '15348ddd-432d-49c2-8a5a-8069753becff') throw new ApiError(meta.errors.noSuchUser);
				throw err;
			});
			await this.userMemosRepository.createQueryBuilder().insert().values({
				id: this.idService.gen(), userId: me.id, targetUserId: ps.userId, memo: '', dislikedEmojis: [],
			}).orIgnore().execute();
			const emoji = normalizeDislikedEmoji(ps.emoji);
			await this.userMemosRepository.createQueryBuilder().update()
				.set({ dislikedEmojis: () => 'array_append("dislikedEmojis", :emoji)' })
				.where('"userId" = :userId AND "targetUserId" = :targetUserId', { userId: me.id, targetUserId: ps.userId })
				.andWhere('NOT (:emoji = ANY("dislikedEmojis"))')
				.andWhere('cardinality("dislikedEmojis") < 100')
				.setParameter('emoji', emoji).execute();
		});
	}
}
