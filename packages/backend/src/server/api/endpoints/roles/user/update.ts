/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { DriveFilesRepository, RolesRepository } from '@/models/_.js';
import type { MiMeta } from '@/models/Meta.js';
import type { MiRole } from '@/models/Role.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { RoleService } from '@/core/RoleService.js';
import { RoleEntityService } from '@/core/entities/RoleEntityService.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
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
			id: '5a1b2c3d-4e5f-4607-8a9b-0c1d2e3f4a66',
		},
		noSuchRole: {
			message: 'No such role.',
			code: 'NO_SUCH_ROLE',
			id: '6b2c3d4e-5f60-4718-9bac-1d2e3f4a5b77',
		},
		nameDuplicated: {
			message: 'A role with the same name already exists.',
			code: 'ROLE_NAME_DUPLICATED',
			id: '7c3d4e5f-6071-4829-abcd-2e3f4a5b6c88',
		},
		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: '8d4e5f60-7182-493a-bcde-3f4a5b6c7d99',
		},
		fileNotAnImage: {
			message: 'The file is not an image.',
			code: 'FILE_NOT_AN_IMAGE',
			id: '9e5f6071-8293-4a4b-cdef-4a5b6c7d8eaa',
		},
	},

	res: {
		type: 'object',
		optional: false, nullable: false,
		ref: 'Role',
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		roleId: { type: 'string', format: 'misskey:id' },
		name: { type: 'string', minLength: 1, maxLength: 256 },
		description: { type: 'string', maxLength: 1024 },
		color: { type: 'string', nullable: true, pattern: '^#[0-9a-fA-F]{6}$' },
		iconFileId: { type: 'string', format: 'misskey:id', nullable: true },
		asBadge: { type: 'boolean' },
		isPersonal: { type: 'boolean' },
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

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		private roleService: RoleService,
		private roleEntityService: RoleEntityService,
		private driveFileEntityService: DriveFileEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!this.serverSettings.enableUserRoleEditor) throw new ApiError(meta.errors.featureDisabled);

			const role = await this.rolesRepository.findOneBy({ id: ps.roleId, createdByUserId: me.id });
			if (role == null) throw new ApiError(meta.errors.noSuchRole);

			const params: Partial<MiRole> = {};

			if (ps.name !== undefined) {
				const name = ps.name.trim();
				if (name.length === 0) throw new ApiError(meta.errors.nameDuplicated);
				const lowerName = name.toLowerCase();
				const roles = await this.roleService.getRoles();
				if (roles.some(r => r.id !== role.id && r.name.trim().toLowerCase() === lowerName)) {
					throw new ApiError(meta.errors.nameDuplicated);
				}
				params.name = name;
			}
			if (ps.description !== undefined) params.description = ps.description;
			if (ps.color !== undefined) params.color = ps.color;
			if (ps.asBadge !== undefined) params.asBadge = ps.asBadge;
			if (ps.isPersonal !== undefined) params.isPersonal = ps.isPersonal;

			if (ps.iconFileId === null) {
				params.iconUrl = null;
			} else if (ps.iconFileId !== undefined) {
				const file = await this.driveFilesRepository.findOneBy({ id: ps.iconFileId, userId: me.id });
				if (file == null) throw new ApiError(meta.errors.noSuchFile);
				if (!file.type.startsWith('image/')) throw new ApiError(meta.errors.fileNotAnImage);
				params.iconUrl = this.driveFileEntityService.getPublicUrl(file);
			}

			await this.roleService.update(role, params);

			const updated = await this.rolesRepository.findOneByOrFail({ id: role.id });
			return await this.roleEntityService.pack(updated, me);
		});
	}
}
