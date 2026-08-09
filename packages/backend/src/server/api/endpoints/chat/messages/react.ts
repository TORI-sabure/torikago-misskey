/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ChatService } from '@/core/ChatService.js';
import { CacheService } from '@/core/CacheService.js';
import { ApiError } from '@/server/api/error.js';
import { normalizeDislikedEmoji } from '@/misc/normalize-disliked-emoji.js';

export const meta = {
	tags: ['chat'],

	requireCredential: true,

	kind: 'write:chat',

	errors: {
		noSuchMessage: {
			message: 'No such message.',
			code: 'NO_SUCH_MESSAGE',
			id: '9b5839b9-0ba0-4351-8c35-37082093d200',
		},
		reactionIsDisliked: {
			message: 'The message author has marked this emoji as disliked.',
			code: 'REACTION_IS_DISLIKED',
			id: 'b7fb7e2f-0b37-4f96-9b9b-e7bf79b1a4e8',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		messageId: { type: 'string', format: 'misskey:id' },
		reaction: { type: 'string' },
		overrideDislikedEmoji: { type: 'boolean', default: false },
	},
	required: ['messageId', 'reaction'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private chatService: ChatService,
		private cacheService: CacheService,
	) {
		super(meta, paramDef, async (ps, me) => {
			await this.chatService.checkChatAvailability(me.id, 'write');
			const message = await this.chatService.findMessageById(ps.messageId);
			if (message == null) throw new ApiError(meta.errors.noSuchMessage);

			// Only one-to-one direct messages have a recipient whose preference can
			// be checked. Room chat reactions intentionally keep their existing flow.
			if (!ps.overrideDislikedEmoji && message.toUserId === me.id) {
				const profile = await this.cacheService.userProfileCache.fetch(message.fromUserId);
				const reaction = normalizeDislikedEmoji(ps.reaction);
				if (profile.dislikedEmojis.some(emoji => normalizeDislikedEmoji(emoji) === reaction)) {
					throw new ApiError(meta.errors.reactionIsDisliked);
				}
			}

			await this.chatService.react(ps.messageId, me.id, ps.reaction);
		});
	}
}
