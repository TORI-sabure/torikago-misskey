/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { DriveFilesRepository, RolesRepository } from '@/models/_.js';
import type { MiMeta } from '@/models/Meta.js';
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
		max: 30,
	},

	errors: {
		featureDisabled: {
			message: 'User role editor is disabled.',
			code: 'USER_ROLE_EDITOR_DISABLED',
			id: '3b0c3a9e-6a4d-4f0e-9a52-0f6a1b0c7d11',
		},
		limitExceeded: {
			message: 'You cannot create more roles.',
			code: 'USER_ROLE_CREATE_LIMIT_EXCEEDED',
			id: '8d2a6f64-2b1c-4f43-bb0e-5d0e4a5b7c22',
		},
		nameDuplicated: {
			message: 'A role with the same name already exists.',
			code: 'ROLE_NAME_DUPLICATED',
			id: 'c4e5f1d0-7a38-4b2e-8f35-1a6c9d2e3b33',
		},
		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: 'e1f7a9b2-3c4d-4e5f-a6b7-8c9d0e1f2a44',
		},
		fileNotAnImage: {
			message: 'The file is not an image.',
			code: 'FILE_NOT_AN_IMAGE',
			id: 'f2a8b0c3-4d5e-4f60-b7c8-9d0e1f2a3b55',
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
		name: { type: 'string', minLength: 1, maxLength: 256 },
		description: { type: 'string', maxLength: 1024 },
		color: { type: 'string', nullable: true, pattern: '^#[0-9a-fA-F]{6}$' },
		iconFileId: { type: 'string', format: 'misskey:id', nullable: true },
		asBadge: { type: 'boolean' },
		isPersonal: { type: 'boolean' },
	},
	required: ['name'],
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

			const name = ps.name.trim();
			if (name.length === 0) throw new ApiError(meta.errors.nameDuplicated);

			const roles = await this.roleService.getRoles();
			const lowerName = name.toLowerCase();
			if (roles.some(r => r.name.trim().toLowerCase() === lowerName)) {
				throw new ApiError(meta.errors.nameDuplicated);
			}

			const createdCount = await this.rolesRepository.countBy({ createdByUserId: me.id });
			if (createdCount >= this.serverSettings.userRoleCreateLimit) {
				throw new ApiError(meta.errors.limitExceeded);
			}

			let iconUrl: string | null = null;
			if (ps.iconFileId != null) {
				const file = await this.driveFilesRepository.findOneBy({ id: ps.iconFileId, userId: me.id });
				if (file == null) throw new ApiError(meta.errors.noSuchFile);
				if (!file.type.startsWith('image/')) throw new ApiError(meta.errors.fileNotAnImage);
				iconUrl = this.driveFileEntityService.getPublicUrl(file);
			}

			// ユーザー作成ロールは見た目だけのロールとして作る (権限・管理者/モデレーター権限・条件は付与しない)
			const role = await this.roleService.create({
				name,
				description: ps.description ?? '',
				color: ps.color ?? null,
				iconUrl,
				target: 'manual',
				condFormula: { id: 'e1a3b4c5-0000-4000-8000-000000000000', type: 'and', values: [] },
				isPublic: true,
				isAdministrator: false,
				isModerator: false,
				isExplorable: false,
				asBadge: ps.asBadge ?? false,
				preserveAssignmentOnMoveAccount: false,
				canEditMembersByModerator: false,
				displayOrder: 0,
				policies: {},
				createdByUserId: me.id,
				isPersonal: ps.isPersonal ?? false,
			});

			return await this.roleEntityService.pack(role, me);
		});
	}
}
