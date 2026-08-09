/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { emojiRegex } from '@/misc/emoji-regex.js';

export function normalizeDislikedEmoji(value: string): string {
	if (value.startsWith(':') && value.endsWith(':')) return value.replace('@.:', ':');
	emojiRegex.lastIndex = 0;
	const match = emojiRegex.exec(value);
	if (match == null) return value;
	return match[0].includes('\u200d') ? match[0] : match[0].replace(/\ufe0f/g, '');
}
