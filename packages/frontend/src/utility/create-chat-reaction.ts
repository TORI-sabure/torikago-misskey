/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { misskeyApi } from '@/utility/misskey-api.js';
import { confirmDislikedEmojiReaction } from '@/utility/create-reaction.js';

const createChatReactionApi = misskeyApi as unknown as (
	endpoint: 'chat/messages/react',
	data: { messageId: string; reaction: string; overrideDislikedEmoji?: boolean },
) => Promise<void>;

export async function createChatReaction(messageId: string, reaction: string): Promise<boolean> {
	try {
		await createChatReactionApi('chat/messages/react', { messageId, reaction });
		return true;
	} catch (err) {
		if (typeof err !== 'object' || err == null || !('code' in err) || err.code !== 'REACTION_IS_DISLIKED') throw err;
		if (!await confirmDislikedEmojiReaction()) return false;
		await createChatReactionApi('chat/messages/react', {
			messageId,
			reaction,
			overrideDislikedEmoji: true,
		});
		return true;
	}
}
