/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type * as Misskey from 'misskey-js';

// おすすめTLは取得のたびに順位付けが走るため、タイムラインの切り替えやブラウザバックで
// コンポーネントが作り直されても再取得しないよう、表示中の内容を保持する。
// メモリ上のみで保持するので、ページの再読み込みや明示的なリロード操作で更新される。
export type RecommendedTimelineCache = {
	snapshotId: string;
	items: Misskey.entities.Note[];
	canFetchOlder: boolean;
};

const cache = new Map<string, RecommendedTimelineCache>();

export function recommendedTimelineCacheKey(parts: { userId: string | undefined; withRenotes: boolean; onlyFiles: boolean; withSensitive: boolean }): string {
	return [parts.userId ?? '', parts.withRenotes, parts.onlyFiles, parts.withSensitive].join(':');
}

export function getRecommendedTimelineCache(key: string): RecommendedTimelineCache | null {
	return cache.get(key) ?? null;
}

export function setRecommendedTimelineCache(key: string, value: RecommendedTimelineCache): void {
	// 空の結果は復元しても意味がないので保持せず、次回は通常どおり取得する
	if (value.items.length === 0) {
		cache.delete(key);
		return;
	}
	cache.set(key, { snapshotId: value.snapshotId, items: value.items.slice(), canFetchOlder: value.canFetchOlder });
}

export function clearRecommendedTimelineCache(key: string): void {
	cache.delete(key);
}
