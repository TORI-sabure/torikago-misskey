/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { lang } from '@@/js/config.js';

const forkTranslations = {
	mutualTimeline: {
		'en-US': 'Mutual',
		'ja-JP': '相互',
		'ja-KS': '相互',
		'ko-KR': '맞팔',
		'ko-GS': '맞팔',
		'zh-CN': '互关',
		'zh-TW': '互相追蹤',
	},
	mutualTimelineDescription: {
		'en-US': 'The mutual timeline shows posts from accounts that you follow and that also follow you back (mutual accounts).',
		'ja-JP': '相互タイムラインでは、あなたがフォローしており、かつあなたをフォローしているアカウント（相互アカウント）の投稿を見られます。',
		'ja-KS': '相互タイムラインでは、あなたがフォローしており、かつあなたをフォローしているアカウント（相互アカウント）の投稿を見られます。',
		'ko-KR': '상호 타임라인에서는 내가 팔로우하고 있으며 나를 다시 팔로우하는 계정(맞팔 계정)의 게시물을 볼 수 있습니다.',
		'ko-GS': '상호 타임라인에서는 내가 팔로우하고 있으며 나를 다시 팔로우하는 계정(맞팔 계정)의 게시물을 볼 수 있습니다.',
		'zh-CN': '相互时间线会显示你已关注且也关注了你的账号（互相关注账号）的帖子。',
		'zh-TW': '相互時間軸會顯示你已追蹤且也追蹤你的帳號（互相追蹤帳號）的貼文。',
	},
} as const;

export type ForkTranslationKey = keyof typeof forkTranslations;

export function forkT(key: ForkTranslationKey): string {
	const translations = forkTranslations[key] as Partial<Record<string, string>>;
	return translations[lang] ?? translations['en-US']!;
}

