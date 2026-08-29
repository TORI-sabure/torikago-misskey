/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { UserMemoRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { GetterService } from '@/server/api/GetterService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['account'],
	requireCredential: true,
	kind: 'write:account',
	res: { type: 'array', items: { type: 'string' } },
	errors: { noSuchUser: { message: 'No such user.', code: 'NO_SUCH_USER', id: 'dc2284a6-3ebd-4a88-9063-a40d569a35e8' } },
} as const;

export const paramDef = {
	type: 'object',
	properties: { userId: { type: 'string', format: 'misskey:id' } },
	required: ['userId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.userMemosRepository) private userMemosRepository: UserMemoRepository,
		private getterService: GetterService,
	) {
		super(meta, paramDef, async (ps, me) => {
			await this.getterService.getUser(ps.userId).catch(err => {
				if (err.id === '15348ddd-432d-49c2-8a5a-8069753becff') throw new ApiError(meta.errors.noSuchUser);
				throw err;
			});
			const memo = await this.userMemosRepository.findOne({
				where: { userId: me.id, targetUserId: ps.userId },
				select: { dislikedEmojis: true },
			});
			return memo?.dislikedEmojis ?? [];
		});
	}
}
