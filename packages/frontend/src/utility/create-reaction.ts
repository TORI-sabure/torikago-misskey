/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { misskeyApi } from '@/utility/misskey-api.js';
import * as os from '@/os.js';
import { lang } from '@@/js/config.js';

const createReactionApi = misskeyApi as unknown as (
	endpoint: 'notes/reactions/create',
	data: { noteId: string; reaction: string; overrideDislikedEmoji?: boolean },
) => Promise<void>;

const dislikedEmojiWarnings: Record<string, string> = {
	'en-US': 'This emoji appears to be set as a disliked emoji.\nDo you want to continue?',
	'ja-JP': 'この絵文字は苦手な絵文字に設定されているようです。\n続行しますか？',
	'ja-KS': 'このツッコミはなんか苦手なツッコミに設定されとるみたいやわ。\n続けるん？',
	'ko-KR': '이 이모지는 싫어하는 이모지로 설정되어 있는 것 같습니다.\n계속하시겠습니까?',
	'ko-GS': '이 이모지는 싫어하는 이모지로 설정되어 있는 것 같습니다.\n계속하시겠습니까?',
	'zh-CN': '此表情符号似乎已被设为不喜欢的表情符号。\n要继续吗？',
	'zh-TW': '此表情符號似乎已被設為不喜歡的表情符號。\n要繼續嗎？',
	'de-DE': 'Dieses Emoji scheint als unerwünschtes Emoji festgelegt zu sein.\nMöchtest du fortfahren?',
	'fr-FR': 'Cet émoji semble être défini comme un émoji indésirable.\nVoulez-vous continuer ?',
	'es-ES': 'Parece que este emoji está marcado como no deseado.\n¿Quieres continuar?',
	'pt-PT': 'Este emoji parece estar definido como indesejado.\nDeseja continuar?',
};
const dislikedEmojiWarning = dislikedEmojiWarnings[lang] ?? dislikedEmojiWarnings['en-US']!;

export async function confirmDislikedEmojiReaction(): Promise<boolean> {
	const { canceled } = await os.confirm({
		type: 'warning',
		text: dislikedEmojiWarning,
	});
	return !canceled;
}

export async function createReaction(noteId: string, reaction: string): Promise<boolean> {
	try {
		await createReactionApi('notes/reactions/create', { noteId, reaction });
		return true;
	} catch (err) {
		if (typeof err !== 'object' || err == null || !('code' in err) || err.code !== 'REACTION_IS_DISLIKED') throw err;
		if (!await confirmDislikedEmojiReaction()) return false;
		await createReactionApi('notes/reactions/create', {
			noteId,
			reaction,
			overrideDislikedEmoji: true,
		});
		return true;
	}
}
