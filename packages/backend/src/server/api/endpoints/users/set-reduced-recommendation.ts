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
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['account'], requireCredential: true, kind: 'write:account',
	errors: { noSuchUser: { message: 'No such user.', code: 'NO_SUCH_USER', id: '9c1df9d8-b4ba-4cc4-975d-6490f14dfdc9' } },
} as const;
export const paramDef = {
	type: 'object',
	properties: { userId: { type: 'string', format: 'misskey:id' }, reduce: { type: 'boolean' } },
	required: ['userId', 'reduce'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(@Inject(DI.userMemosRepository) private userMemosRepository: UserMemoRepository, private getterService: GetterService, private idService: IdService) {
		super(meta, paramDef, async (ps, me) => {
			if (ps.userId === me.id) return;
			await this.getterService.getUser(ps.userId).catch(err => {
				if (err.id === '15348ddd-432d-49c2-8a5a-8069753becff') throw new ApiError(meta.errors.noSuchUser);
				throw err;
			});
			await this.userMemosRepository.createQueryBuilder().insert().values({
				id: this.idService.gen(), userId: me.id, targetUserId: ps.userId, memo: '', dislikedEmojis: [], reduceRecommendations: false,
			}).orIgnore().execute();
			await this.userMemosRepository.update({ userId: me.id, targetUserId: ps.userId }, { reduceRecommendations: ps.reduce });
		});
	}
}
