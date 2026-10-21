/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type Redis from 'ioredis';

// 1 回のコマンドに渡すメンバー数の上限 (巨大な引数列を避ける)
const CHUNK_SIZE = 500;

function chunked<T>(items: readonly T[]): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += CHUNK_SIZE) chunks.push(items.slice(i, i + CHUNK_SIZE));
	return chunks;
}

/**
 * おすすめタイムラインの既読 (seen) 判定。
 *
 * 以前は seenLimit 件 (最大 10 万件) の既読 ID を毎リクエスト全件取得して Set にしていたが、
 * 実際に判定したいのは今回の候補 (数百件) だけなので、必要な ID だけを ZMSCORE で問い合わせる。
 * 判定済みの ID は記憶し、同じ ID を二度は問い合わせない。
 *
 * 使い方: `has()` の前に、判定したい ID を `prime()` で渡しておくこと。
 * `prime()` していない ID は未読として扱われる。
 *
 * ZMSCORE は Redis 6.2 以上が必要。
 */
export class RecommendedSeenLookup {
	private readonly redis: Redis.Redis;
	// 既読を記録している sorted set のキー (score = 既読にした時刻 ms)
	private readonly keys: readonly string[];
	// この時刻 (ms) より古い既読は無効として扱う
	private readonly oldestScore: number;
	private readonly seen = new Set<string>();
	private readonly checked = new Set<string>();

	constructor(redis: Redis.Redis, keys: readonly string[], oldestScore: number) {
		this.redis = redis;
		this.keys = keys;
		this.oldestScore = oldestScore;
	}

	public async prime(ids: Iterable<string>): Promise<void> {
		const unknown = [...new Set(ids)].filter(id => !this.checked.has(id));
		if (unknown.length === 0) return;

		if (this.keys.length > 0) {
			for (const chunk of chunked(unknown)) {
				const pipeline = this.redis.pipeline();
				for (const key of this.keys) pipeline.call('ZMSCORE', key, ...chunk);
				const results = await pipeline.exec();
				if (results == null) throw new Error('Failed to look up recommended timeline seen history');
				for (const [error, scores] of results) {
					if (error != null) throw error;
					(scores as Array<string | null>).forEach((score, index) => {
						// 旧実装の zrangebyscore(key, oldest, '+inf') と同じく oldest 以上を既読とする
						if (score != null && Number(score) >= this.oldestScore) this.seen.add(chunk[index]!);
					});
				}
			}
		}

		for (const id of unknown) this.checked.add(id);
	}

	public has(id: string): boolean {
		return this.seen.has(id);
	}
}

/**
 * Redis の set のうち、指定した ID のうち実際にメンバーであるものだけを返す。
 * set 全体を取得せずに済む (SMISMEMBER、Redis 6.2 以上)。
 */
export async function findSetMembers(redis: Redis.Redis, key: string, ids: readonly string[]): Promise<Set<string>> {
	const found = new Set<string>();
	const uniqueIds = [...new Set(ids)];
	for (const chunk of chunked(uniqueIds)) {
		const flags = await redis.call('SMISMEMBER', key, ...chunk) as number[];
		flags.forEach((flag, index) => {
			if (flag === 1) found.add(chunk[index]!);
		});
	}
	return found;
}
