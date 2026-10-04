/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import type Redis from 'ioredis';
import { RecommendedSeenLookup, findSetMembers } from '@/misc/recommended-seen-lookup.js';

type Call = { command: string; args: string[] };

// ZMSCORE / SMISMEMBER だけを実装した最小の Redis モック
function createFakeRedis(data: { zsets?: Record<string, Record<string, number>>; sets?: Record<string, string[]> }) {
	const calls: Call[] = [];
	const run = (command: string, args: string[]): unknown => {
		calls.push({ command, args });
		const [key, ...members] = args as [string, ...string[]];
		if (command === 'ZMSCORE') return members.map(member => data.zsets?.[key]?.[member]?.toString() ?? null);
		if (command === 'SMISMEMBER') return members.map(member => (data.sets?.[key]?.includes(member) ? 1 : 0));
		throw new Error(`unexpected command: ${command}`);
	};
	const redis = {
		call: async (command: string, ...args: string[]) => run(command, args),
		pipeline: () => {
			const queued: Array<() => unknown> = [];
			const pipeline = {
				call: (command: string, ...args: string[]) => {
					queued.push(() => run(command, args));
					return pipeline;
				},
				exec: async () => queued.map(fn => [null, fn()] as [null, unknown]),
			};
			return pipeline;
		},
	} as unknown as Redis.Redis;
	return { redis, calls };
}

describe('misc:RecommendedSeenLookup', () => {
	const oldest = 1000;

	test('prime したIDだけ既読として判定される', async () => {
		const { redis } = createFakeRedis({ zsets: { seen: { a: 2000, b: 3000 } } });
		const lookup = new RecommendedSeenLookup(redis, ['seen'], oldest);
		await lookup.prime(['a', 'c']);
		expect(lookup.has('a')).toBe(true);
		expect(lookup.has('c')).toBe(false);
		// prime していない ID は未読扱い
		expect(lookup.has('b')).toBe(false);
	});

	test('oldest より古い既読は無効、ちょうど oldest は有効 (旧 zrangebyscore と同じ境界)', async () => {
		const { redis } = createFakeRedis({ zsets: { seen: { old: 999, edge: 1000, fresh: 1001 } } });
		const lookup = new RecommendedSeenLookup(redis, ['seen'], oldest);
		await lookup.prime(['old', 'edge', 'fresh']);
		expect(lookup.has('old')).toBe(false);
		expect(lookup.has('edge')).toBe(true);
		expect(lookup.has('fresh')).toBe(true);
	});

	test('複数のキーのどれかに既読があれば既読 (旧バージョンのキーとの併用)', async () => {
		const { redis } = createFakeRedis({ zsets: { current: { a: 2000 }, legacy: { b: 2000 } } });
		const lookup = new RecommendedSeenLookup(redis, ['current', 'legacy'], oldest);
		await lookup.prime(['a', 'b', 'c']);
		expect(lookup.has('a')).toBe(true);
		expect(lookup.has('b')).toBe(true);
		expect(lookup.has('c')).toBe(false);
	});

	test('判定済みのIDは再度問い合わせない', async () => {
		const { redis, calls } = createFakeRedis({ zsets: { seen: { a: 2000 } } });
		const lookup = new RecommendedSeenLookup(redis, ['seen'], oldest);
		await lookup.prime(['a', 'b']);
		expect(calls).toHaveLength(1);
		await lookup.prime(['a', 'b']);
		expect(calls).toHaveLength(1);
		// 新しい ID だけが追加で問い合わせられる
		await lookup.prime(['a', 'c']);
		expect(calls).toHaveLength(2);
		expect(calls[1]!.args).toEqual(['seen', 'c']);
	});

	test('重複したIDは1回だけ問い合わせる', async () => {
		const { redis, calls } = createFakeRedis({});
		const lookup = new RecommendedSeenLookup(redis, ['seen'], oldest);
		await lookup.prime(['a', 'a', 'a']);
		expect(calls[0]!.args).toEqual(['seen', 'a']);
	});

	test('IDが多いときは分割して問い合わせ、結果は全体で正しい', async () => {
		const ids = Array.from({ length: 1200 }, (_, i) => `id${i}`);
		const { redis, calls } = createFakeRedis({ zsets: { seen: { id0: 2000, id600: 2000, id1199: 2000 } } });
		const lookup = new RecommendedSeenLookup(redis, ['seen'], oldest);
		await lookup.prime(ids);
		expect(calls).toHaveLength(3);
		expect(ids.filter(id => lookup.has(id))).toEqual(['id0', 'id600', 'id1199']);
	});

	test('キーが空なら何も問い合わせず、すべて未読', async () => {
		const { redis, calls } = createFakeRedis({});
		const lookup = new RecommendedSeenLookup(redis, [], oldest);
		await lookup.prime(['a']);
		expect(calls).toHaveLength(0);
		expect(lookup.has('a')).toBe(false);
	});

	test('Redis のエラーは握りつぶさず投げる', async () => {
		const redis = {
			pipeline: () => ({
				call() { return this; },
				exec: async () => [[new Error('boom'), null]],
			}),
		} as unknown as Redis.Redis;
		const lookup = new RecommendedSeenLookup(redis, ['seen'], oldest);
		await expect(lookup.prime(['a'])).rejects.toThrow('boom');
	});
});

describe('misc:findSetMembers', () => {
	test('指定したIDのうちメンバーであるものだけ返す', async () => {
		const { redis } = createFakeRedis({ sets: { snap: ['a', 'x'] } });
		const found = await findSetMembers(redis, 'snap', ['a', 'b', 'a']);
		expect([...found]).toEqual(['a']);
	});

	test('IDが空なら問い合わせない', async () => {
		const { redis, calls } = createFakeRedis({});
		const found = await findSetMembers(redis, 'snap', []);
		expect(found.size).toBe(0);
		expect(calls).toHaveLength(0);
	});
});
