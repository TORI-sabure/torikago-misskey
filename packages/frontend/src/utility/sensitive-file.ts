/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as Misskey from 'misskey-js';
import { lang } from '@@/js/config.js';
import * as os from '@/os.js';
import { prefer } from '@/preferences.js';
import { i18n } from '@/i18n.js';

const moderatorSensitiveImageLabels: Record<string, string> = {
	'en-US': 'This image was marked as sensitive by an administrator or moderator for some reason.',
	'ja-JP': 'この画像は何らかの理由で管理人またはモデレーターにセンシティブに設定されました。',
	'ja-KS': 'この画像はなんかの理由で管理人かモデレーターにセンシティブ設定されたで。',
};

export function getSensitiveImageLabel(file: Misskey.entities.DriveFile): string {
	return file.isSensitiveByModerator
		? (moderatorSensitiveImageLabels[lang] ?? moderatorSensitiveImageLabels['en-US']!)
		: i18n.ts.sensitive;
}

export function shouldHideFileByDefault(file: Misskey.entities.DriveFile, ignoreDataSaver = false): boolean {
	if (prefer.s.nsfw === 'force' || (!ignoreDataSaver && prefer.s.dataSaver.media)) {
		return true;
	}

	if (file.isSensitive && prefer.s.nsfw !== 'ignore') {
		return true;
	}

	return false;
}

export async function canRevealFile(file: Misskey.entities.DriveFile): Promise<boolean> {
	if (file.isSensitive && prefer.s.confirmWhenRevealingSensitiveMedia) {
		const { canceled } = await os.confirm({
			type: 'question',
			text: i18n.ts.sensitiveMediaRevealConfirm,
		});
		if (canceled) return false;
	}

	return true;
}
