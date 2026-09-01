/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { MiMeta } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { Endpoint } from '@/server/api/endpoint-base.js';

export const meta = {
	tags: ['notes'],
	requireCredential: true,
	kind: 'read:account',
	res: {
		type: 'object', optional: false, nullable: false,
		properties: { available: { type: 'boolean', optional: false, nullable: false } },
	},
} as const;

export const paramDef = { type: 'object', properties: {}, required: [] } as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(@Inject(DI.meta) private serverSettings: MiMeta) {
		super(meta, paramDef, async (ps, me) => {
			const allowedUserIds = this.serverSettings.recommendedTimelineAllowedUserIds ?? [];
			return {
				available: this.serverSettings.enableRecommendedTimeline && (allowedUserIds.length === 0 || allowedUserIds.includes(me.id)),
			};
		});
	}
}
