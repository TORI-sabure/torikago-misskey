/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// Kept as a fallback for existing instances until an administrator saves the
// configurable list for the first time.
export const DEFAULT_ABUSE_REPORT_REASONS = [
	'権利を侵害する行為、また侵害する恐れがある財産、信用、名誉、プライバシー、肖像権を侵害している',
	'身体、生命、自由、名誉、財産などに対して害悪を加えると公開している',
	'他者に不利益を与えている',
	'誹謗中傷または侮辱行為',
	'公序良俗に反する',
	'他者になりすましている',
	'面識のない未成年と出会うことを主目的としてサービスを利用している',
	'人の死体、裸体、児童ポルノ、人を殺傷する現場もしくは児童虐待に相当するファイルの投稿',
	'管理権限を持たないユーザーによる他のユーザーに対しての規約違反の断定・処罰要求・排除行為（自治行為など）',
	'13歳未満のユーザーにも関わらず顔写真など個人を特定できる情報を公開している',
	'その他',
] as const;

export function getAbuseReportReasons(reasons: string[] | null | undefined): string[] {
	return reasons && reasons.length > 0 ? reasons : [...DEFAULT_ABUSE_REPORT_REASONS];
}
