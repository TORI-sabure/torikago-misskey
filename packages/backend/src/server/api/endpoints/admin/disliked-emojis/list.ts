/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { UserProfilesRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	kind: 'write:admin:disliked-emojis',
	res: {
		type: 'array',
		optional: false, nullable: false,
		items: { type: 'string' },
	},
	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: 'fc4a9511-0535-4c47-b0b6-959937a883f9',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: { userId: { type: 'string', format: 'misskey:id' } },
	required: ['userId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,
	) {
		super(meta, paramDef, async (ps) => {
			const profile = await this.userProfilesRepository.findOne({
				where: { userId: ps.userId },
				select: { dislikedEmojis: true },
			});
			if (profile == null) throw new ApiError(meta.errors.noSuchUser);
			return profile.dislikedEmojis;
		});
	}
}
