/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { RolesRepository } from '@/models/_.js';
import type { MiMeta } from '@/models/Meta.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { RoleService } from '@/core/RoleService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['role'],

	requireCredential: true,
	kind: 'write:account',

	limit: {
		duration: 60 * 60 * 1000,
		max: 60,
	},

	errors: {
		featureDisabled: {
			message: 'User role editor is disabled.',
			code: 'USER_ROLE_EDITOR_DISABLED',
			id: 'af607182-93a4-4b5c-8def-5b6c7d8e9fbb',
		},
		noSuchRole: {
			message: 'No such role.',
			code: 'NO_SUCH_ROLE',
			id: 'b0718293-a4b5-4c6d-9ef0-6c7d8e9fa0cc',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		roleId: { type: 'string', format: 'misskey:id' },
	},
	required: ['roleId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.meta)
		private serverSettings: MiMeta,

		@Inject(DI.rolesRepository)
		private rolesRepository: RolesRepository,

		private roleService: RoleService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!this.serverSettings.enableUserRoleEditor) throw new ApiError(meta.errors.featureDisabled);

			const role = await this.rolesRepository.findOneBy({ id: ps.roleId, createdByUserId: me.id });
			if (role == null) throw new ApiError(meta.errors.noSuchRole);

			await this.roleService.delete(role);
		});
	}
}
