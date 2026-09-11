/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { MiMeta } from '@/models/Meta.js';
import { getAbuseReportReasons } from '@/core/AbuseReportReasons.js';
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
		@Inject(DI.meta)
		private metaService: MiMeta,
	) {
		super(meta, paramDef, async () => getAbuseReportReasons(this.metaService.abuseReportReasons));
	}
}
