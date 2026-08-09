/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { misskeyApi } from '@/utility/misskey-api.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';

const createReactionApi = misskeyApi as unknown as (
	endpoint: 'notes/reactions/create',
	data: { noteId: string; reaction: string; overrideDislikedEmoji?: boolean },
) => Promise<void>;

export async function createReaction(noteId: string, reaction: string): Promise<boolean> {
	try {
		await createReactionApi('notes/reactions/create', { noteId, reaction });
		return true;
	} catch (err) {
		if (typeof err !== 'object' || err == null || !('code' in err) || err.code !== 'REACTION_IS_DISLIKED') throw err;
		const { canceled } = await os.confirm({
			type: 'warning',
			text: i18n.ts.dislikedEmojiWarning,
		});
		if (canceled) return false;
		await createReactionApi('notes/reactions/create', {
			noteId,
			reaction,
			overrideDislikedEmoji: true,
		});
		return true;
	}
}
