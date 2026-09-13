/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { UserMemoRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { Endpoint } from '@/server/api/endpoint-base.js';

export const meta = { tags: ['account'], requireCredential: true, kind: 'read:account', res: { type: 'boolean' } } as const;
export const paramDef = { type: 'object', properties: { userId: { type: 'string', format: 'misskey:id' } }, required: ['userId'] } as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(@Inject(DI.userMemosRepository) private userMemosRepository: UserMemoRepository) {
		super(meta, paramDef, async (ps, me) => (await this.userMemosRepository.findOne({ where: { userId: me.id, targetUserId: ps.userId }, select: { reduceRecommendations: true } }))?.reduceRecommendations ?? false);
	}
}
