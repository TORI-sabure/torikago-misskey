/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { GetterService } from '@/server/api/GetterService.js';
import { RoleService } from '@/core/RoleService.js';
import { AbuseReportService } from '@/core/AbuseReportService.js';
import { ApiError } from '../../error.js';

const abuseReportReasons = [
	'権利を侵害する行為、また侵害する恐れがある財産、信用、名誉、プライバシー、肖像権を侵害している',
	'身体、生命、自由、名誉、財産などに対して害悪を加えると公開している',
	'他者に不利益を与えている',
	'誹謗中傷または侮辱行為',
	'公序良俗に反する',
	'他者になりすましている',
	'面識のない未成年と出会うことを主目的としてサービスを利用している',
	'人の死体、裸体、児童ポルノ、人を殺傷する現場もしくは児童虐待に相当するファイルの投稿',
	'管理権限を持たないユーザーによる他のユーザーに対しての規約違反の断定・処罰要求・排除行為（自治行為など）',
	'13歳未満のユーザーにも関わらず顔写真など個人を特定できる情報を公開している',
	'その他',
] as const;

export const meta = {
	tags: ['users'],

	requireCredential: true,
	kind: 'write:report-abuse',

	description: 'File a report.',

	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '1acefcb5-0959-43fd-9685-b48305736cb5',
		},

		cannotReportYourself: {
			message: 'Cannot report yourself.',
			code: 'CANNOT_REPORT_YOURSELF',
			id: '1e13149e-b1e8-43cf-902e-c01dbfcb202f',
		},

		cannotReportAdmin: {
			message: 'Cannot report the admin.',
			code: 'CANNOT_REPORT_THE_ADMIN',
			id: '35e166f5-05fb-4f87-a2d5-adb42676d48f',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'misskey:id' },
		comment: { type: 'string', minLength: 1, maxLength: 2048 },
		reasons: { type: 'array', minItems: 1, maxItems: abuseReportReasons.length, uniqueItems: true, items: { type: 'string', enum: abuseReportReasons } },
	},
	required: ['userId', 'comment', 'reasons'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private getterService: GetterService,
		private roleService: RoleService,
		private abuseReportService: AbuseReportService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Lookup user
			const targetUser = await this.getterService.getUser(ps.userId).catch(err => {
				if (err.id === '15348ddd-432d-49c2-8a5a-8069753becff') throw new ApiError(meta.errors.noSuchUser);
				throw err;
			});

			if (targetUser.id === me.id) {
				throw new ApiError(meta.errors.cannotReportYourself);
			}

			if (await this.roleService.isAdministrator(targetUser)) {
				throw new ApiError(meta.errors.cannotReportAdmin);
			}

			await this.abuseReportService.report([{
				targetUserId: targetUser.id,
				targetUserHost: targetUser.host,
				reporterId: me.id,
				reporterHost: null,
				comment: ps.comment,
				reasons: ps.reasons,
			}]);
		});
	}
}
