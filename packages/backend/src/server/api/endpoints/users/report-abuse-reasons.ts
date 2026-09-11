/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { getAbuseReportReasons } from '@/core/AbuseReportReasons.js';
import { MetaService } from '@/core/MetaService.js';
import { Endpoint } from '@/server/api/endpoint-base.js';

export const meta = {
	tags: ['users'],

	requireCredential: true,
	kind: 'read:account',

	description: 'Show the report reasons configured by the administrator.',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: { type: 'string', optional: false, nullable: false },
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private metaService: MetaService,
	) {
		super(meta, paramDef, async () => {
			const instanceMeta = await this.metaService.fetch(true);
			return getAbuseReportReasons(instanceMeta.abuseReportReasons);
		});
	}
}
