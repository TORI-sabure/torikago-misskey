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

// 1ユーザーが自分でつけられる (ユーザー作成) ロールの上限数
export const USER_ROLE_SELF_ASSIGN_MAX = 10;

export const meta = {
	tags: ['role'],

	requireCredential: true,
	kind: 'write:account',

	limit: {
		duration: 60 * 60 * 1000,
		max: 120,
	},

	errors: {
		featureDisabled: {
			message: 'User role editor is disabled.',
			code: 'USER_ROLE_EDITOR_DISABLED',
			id: 'c1829304-b5c6-4d7e-8f01-7d8e9fa0b1dd',
		},
		noSuchRole: {
			message: 'No such role.',
			code: 'NO_SUCH_ROLE',
			id: 'd2930415-c6d7-4e8f-9012-8e9fa0b1c2ee',
		},
		personalRole: {
			message: 'This role can only be assigned by its creator.',
			code: 'ROLE_IS_PERSONAL',
			id: 'e3a41526-d7e8-4f90-a123-9fa0b1c2d3ff',
		},
		assignLimitExceeded: {
			message: 'You cannot attach more roles.',
			code: 'USER_ROLE_ASSIGN_LIMIT_EXCEEDED',
			id: 'f4b52637-e8f9-4a01-b234-a0b1c2d3e400',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		roleId: { type: 'string', format: 'misskey:id' },
		assigned: { type: 'boolean' },
	},
	required: ['roleId', 'assigned'],
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

			// ユーザー作成ロールだけが対象 (管理者作成のロールは自分で付け外しできない)
			const role = await this.rolesRepository.findOneBy({ id: ps.roleId, isPublic: true });
			if (role == null || role.createdByUserId == null) throw new ApiError(meta.errors.noSuchRole);

			if (ps.assigned) {
				if (role.isPersonal && role.createdByUserId !== me.id) {
					throw new ApiError(meta.errors.personalRole);
				}

				const userRoleIds = new Set((await this.roleService.getRoles()).filter(r => r.createdByUserId != null).map(r => r.id));
				const assigns = await this.roleService.getUserAssigns(me.id);
				if (assigns.filter(a => userRoleIds.has(a.roleId)).length >= USER_ROLE_SELF_ASSIGN_MAX) {
					throw new ApiError(meta.errors.assignLimitExceeded);
				}

				await this.roleService.assign(me.id, role.id).catch(err => {
					// すでについている場合は何もしない
					if (!(err instanceof RoleService.AlreadyAssignedError)) throw err;
				});
			} else {
				await this.roleService.unassign(me.id, role.id).catch(err => {
					if (!(err instanceof RoleService.NotAssignedError)) throw err;
				});
			}
		});
	}
}
