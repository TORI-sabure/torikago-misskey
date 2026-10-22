/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import {
	REACTION_WINDOW_DAYS,
	RECENT_REACTION_WEIGHT,
	SERVER_WINDOW_SIZE,
	aggregateReactionRows,
	computeServerBonuses,
	filterByServerWindow,
	isServerFull,
	reactionWeight,
	selectBySource,
	serverCapFor,
	serverWindowMax,
	spreadAuthors,
} from '@/misc/recommended-server-scoring.js';
import { isContextStale, wrapCandidateCursor } from '@/misc/recommended-server-scoring.js';
import type { SelectableItem } from '@/misc/recommended-server-scoring.js';

// recommended-timeline.ts の seededRandom と同じ (FNV-1a)。テストでは同じ乱数を使い、結果を決定的にする
function seededRandom(value: string): number {
	let hash = 2166136261;
	for (let i = 0; i < value.length; i++) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0) / 0x100000000;
}

describe('misc:recommended-server-scoring reaction aggregation', () => {
	test('直近のリアクションは RECENT_REACTION_WEIGHT 倍の重みが上乗せされる', () => {
		expect(reactionWeight(10, 0)).toBe(10);
		expect(reactionWeight(10, 4)).toBe(10 + RECENT_REACTION_WEIGHT * 4);
		expect(REACTION_WINDOW_DAYS).toBe(90);
	});

	test('作者別は重みの降順、同点は ID 順で決定的に並ぶ', () => {
		const result = aggregateReactionRows([
			{ userId: 'b', userHost: null, total: 5, recent: 0 },
			{ userId: 'a', userHost: null, total: 5, recent: 0 },
			{ userId: 'c', userHost: null, total: 2, recent: 2 },
			{ userId: 'd', userHost: null, total: 1, recent: 0 },
		]);
		expect(result.authors).toEqual([['c', 8], ['a', 5], ['b', 5], ['d', 1]]);
	});

	test('サーバー別は作者別の行を足し合わせ、ローカル (null) は含めない', () => {
		const result = aggregateReactionRows([
			{ userId: 'a', userHost: 'misskey.io', total: 10, recent: 0 },
			{ userId: 'b', userHost: 'misskey.io', total: 5, recent: 1 },
			{ userId: 'c', userHost: 'small.example', total: 4, recent: 0 },
			{ userId: 'd', userHost: null, total: 100, recent: 0 },
		]);
		expect(result.hosts).toEqual([['misskey.io', 18], ['small.example', 4]]);
		expect(result.hostTotal).toBe(22);
	});

	test('保存するサーバー数を超えても、合計 (hostTotal) には上位に入らなかった分も含む', () => {
		const rows = Array.from({ length: 5 }, (_, i) => ({ userId: `u${i}`, userHost: `h${i}.example`, total: 10 - i, recent: 0 }));
		const result = aggregateReactionRows(rows, 2);
		expect(result.hosts).toHaveLength(2);
		expect(result.hosts.map(([host]) => host)).toEqual(['h0.example', 'h1.example']);
		expect(result.hostTotal).toBe(10 + 9 + 8 + 7 + 6);
	});

	test('行が空でも壊れない', () => {
		expect(aggregateReactionRows([])).toEqual({ authors: [], hosts: [], hostTotal: 0 });
	});
});

describe('misc:recommended-server-scoring computeServerBonuses', () => {
	const settings = { serverAffinityBonus: 4, serverDiversityBonus: 2 };
	const noAffinity = { hosts: [] as Array<[string, number]>, total: 0 };

	test('候補にリモートが無ければ空 (ローカルだけの候補は加点しない)', () => {
		expect(computeServerBonuses([null, null], noAffinity, settings).size).toBe(0);
		expect(computeServerBonuses([], noAffinity, settings).size).toBe(0);
	});

	test('ローカル (null) は結果に含まれない', () => {
		const bonuses = computeServerBonuses([null, 'a.example'], noAffinity, settings);
		expect([...bonuses.keys()]).toEqual(['a.example']);
	});

	test('候補に多いサーバーほど多様性の加点が小さい (流動的なスコア)', () => {
		const hosts = [...Array(80).fill('misskey.io'), ...Array(15).fill('mid.example'), 'rare.example', 'rare.example'] as string[];
		const bonuses = computeServerBonuses(hosts, noAffinity, settings);
		expect(bonuses.get('misskey.io')!).toBeLessThan(bonuses.get('mid.example')!);
		expect(bonuses.get('mid.example')!).toBeLessThan(bonuses.get('rare.example')!);
		// 多様性だけなら最大値を超えない
		for (const bonus of bonuses.values()) expect(bonus).toBeLessThanOrEqual(settings.serverDiversityBonus);
	});

	test('同じ候補でも、偏りが変われば加点も変わる', () => {
		const skewed = computeServerBonuses([...Array(90).fill('a.example'), ...Array(10).fill('b.example')] as string[], noAffinity, settings);
		const even = computeServerBonuses([...Array(50).fill('a.example'), ...Array(50).fill('b.example')] as string[], noAffinity, settings);
		expect(skewed.get('b.example')!).toBeGreaterThan(even.get('b.example')!);
		expect(skewed.get('a.example')!).toBeLessThan(even.get('a.example')!);
	});

	test('候補の割合を大きく上回ってリアクションしているサーバーは親和度の加点が付く', () => {
		// b は候補の 10% だが、リアクションの 61% が b (約 6 倍)。a は候補の 90% でリアクションは 39%
		const hosts = [...Array(90).fill('a.example'), ...Array(10).fill('b.example')] as string[];
		const liked = { hosts: [['b.example', 250], ['a.example', 160]] as Array<[string, number]>, total: 410 };
		const withAffinity = computeServerBonuses(hosts, liked, settings);
		const without = computeServerBonuses(hosts, noAffinity, settings);
		// 多様性の加点を除いた、親和度だけの加点
		expect(withAffinity.get('b.example')! - without.get('b.example')!).toBeGreaterThan(settings.serverAffinityBonus * 0.6);
		expect(withAffinity.get('b.example')! - without.get('b.example')!).toBeLessThanOrEqual(settings.serverAffinityBonus);
		// 候補の割合以下しかリアクションしていない a には、親和度の加点は付かない
		expect(withAffinity.get('a.example')!).toBeCloseTo(without.get('a.example')!, 5);
	});

	test('候補の半分を占める巨大サーバーは、倍率が最大 2 倍までなので親和度の加点は小さい', () => {
		const hosts = [...Array(50).fill('a.example'), ...Array(50).fill('b.example')] as string[];
		// リアクションがほぼすべて b でも、候補の割合が 50% なので倍率は 2 倍が上限
		const liked = { hosts: [['b.example', 400], ['a.example', 10]] as Array<[string, number]>, total: 410 };
		const withAffinity = computeServerBonuses(hosts, liked, settings).get('b.example')!;
		const without = computeServerBonuses(hosts, noAffinity, settings).get('b.example')!;
		expect(withAffinity - without).toBeGreaterThan(0);
		expect(withAffinity - without).toBeLessThan(settings.serverAffinityBonus * 0.4);
	});

	test('誰もが多く反応する巨大サーバーは、候補の割合どおりなら親和度で加点されない', () => {
		const hosts = [...Array(80).fill('misskey.io'), ...Array(20).fill('small.example')] as string[];
		// リアクションの割合 = 候補の割合 (80% / 20%)
		const proportional = { hosts: [['misskey.io', 800], ['small.example', 200]] as Array<[string, number]>, total: 1000 };
		const withAffinity = computeServerBonuses(hosts, proportional, settings);
		const without = computeServerBonuses(hosts, noAffinity, settings);
		expect(withAffinity.get('misskey.io')!).toBeCloseTo(without.get('misskey.io')!, 5);
		expect(withAffinity.get('small.example')!).toBeCloseTo(without.get('small.example')!, 5);
	});

	test('偶然の 1 件のリアクションでは「好き」と判定されない', () => {
		const hosts = [...Array(99).fill('a.example'), 'b.example'] as string[];
		const oneOff = { hosts: [['b.example', 1]] as Array<[string, number]>, total: 1 };
		const withOne = computeServerBonuses(hosts, oneOff, settings).get('b.example')!;
		const without = computeServerBonuses(hosts, noAffinity, settings).get('b.example')!;
		expect(withOne - without).toBeLessThan(settings.serverAffinityBonus * 0.35);
	});

	test('加点は 0 以上、最大でも多様性 + 親和度の上限まで', () => {
		const hosts = [...Array(30).fill('a.example'), ...Array(5).fill('b.example'), 'c.example'] as string[];
		const affinity = { hosts: [['c.example', 5000], ['b.example', 3]] as Array<[string, number]>, total: 6000 };
		for (const bonus of computeServerBonuses(hosts, affinity, settings).values()) {
			expect(bonus).toBeGreaterThanOrEqual(0);
			expect(bonus).toBeLessThanOrEqual(settings.serverDiversityBonus + settings.serverAffinityBonus);
		}
	});

	test('設定が 0 ならすべて 0', () => {
		const affinity = { hosts: [['a.example', 100]] as Array<[string, number]>, total: 100 };
		const bonuses = computeServerBonuses(['a.example', 'b.example'], affinity, { serverAffinityBonus: 0, serverDiversityBonus: 0 });
		expect([...bonuses.values()]).toEqual([0, 0]);
	});
});

describe('misc:recommended-server-scoring caps', () => {
	test('serverCapFor: 100% 以上は無制限、それ以外は切り上げで最低 2', () => {
		expect(serverCapFor(40, 100)).toBe(Infinity);
		expect(serverCapFor(40, 40)).toBe(16);
		expect(serverCapFor(10, 25)).toBe(3);
		expect(serverCapFor(3, 10)).toBe(2);
	});

	test('isServerFull: ローカル (null) と未選定のサーバーは満杯にならない', () => {
		const counts = new Map([['a.example', 3]]);
		expect(isServerFull(counts, 'a.example', 3)).toBe(true);
		expect(isServerFull(counts, 'a.example', 4)).toBe(false);
		expect(isServerFull(counts, 'b.example', 1)).toBe(false);
		expect(isServerFull(counts, null, 0)).toBe(false);
		expect(isServerFull(counts, 'a.example', Infinity)).toBe(false);
	});

	test('serverWindowMax: 窓 (既定10件) に置ける同一サーバーの件数', () => {
		expect(serverWindowMax(100)).toBe(Infinity);
		expect(serverWindowMax(40)).toBe(Math.ceil(SERVER_WINDOW_SIZE * 0.4));
		expect(serverWindowMax(10)).toBe(1);
	});

	test('filterByServerWindow: 上限に達したサーバーを除く。代わりが無ければ絞らない', () => {
		const items = [{ host: 'a' }, { host: 'b' }, { host: null }];
		expect(filterByServerWindow(items, ['a', 'a'], 2)).toEqual([{ host: 'b' }, { host: null }]);
		expect(filterByServerWindow([{ host: 'a' }], ['a', 'a'], 2)).toEqual([{ host: 'a' }]);
		expect(filterByServerWindow(items, ['a', 'a'], Infinity)).toEqual(items);
	});
});

type Item = SelectableItem & { host: string | null };

function makeItems(spec: Array<{ source: string; host: string | null; count: number }>): Item[] {
	const items: Item[] = [];
	let n = 0;
	for (const { source, host, count } of spec) {
		for (let i = 0; i < count; i++, n++) {
			items.push({ id: `n${String(n).padStart(4, '0')}`, targetId: `n${String(n).padStart(4, '0')}`, authorId: `author${n}`, source, host, quality: 100 - n * 0.01 });
		}
	}
	return items;
}

const baseSettings = { resultLimit: 40, maxNotesPerAuthor: 2, maxServerPercent: 40, reactionAffinityPercent: 60, followingPercent: 20, unknownPercent: 20 };

// 上限導入前の selectSources (元のループ) をそのまま写したもの。上限なしで結果が変わらないことの回帰テスト用
function originalSelectSources(items: Item[], settings: typeof baseSettings, seed: string, existing = new Map<string, number>()): Item[] {
	const bySource = new Map(['following', 'reactionAffinity', 'unknown'].map(source => [source, items.filter(item => item.source === source).sort((a, b) => b.quality - a.quality)]));
	const percentages: Array<[string, number]> = [['reactionAffinity', settings.reactionAffinityPercent], ['following', settings.followingPercent], ['unknown', settings.unknownPercent]];
	if (percentages.every(([, percent]) => percent === 0)) percentages[0]![1] = 100;
	const out: Item[] = []; const counts = new Map(existing); const targets = new Set<string>();
	for (let i = 0; i < settings.resultLimit; i++) {
		const wanted = [...percentages].sort((a, b) => ((out.filter(item => item.source === a[0]).length + 1) / Math.max(a[1], 1)) - ((out.filter(item => item.source === b[0]).length + 1) / Math.max(b[1], 1)))[0]![0];
		const sources = [wanted, ...percentages.map(x => x[0]).filter(source => source !== wanted)];
		let picked: Item | undefined;
		for (const source of sources) {
			const list = bySource.get(source) ?? [];
			const eligible = list.filter(item => !targets.has(item.targetId) && (counts.get(item.authorId) ?? 0) < settings.maxNotesPerAuthor);
			if (eligible.length > 0) {
				const windowSize = Math.max(1, Math.ceil(eligible.length * 0.6));
				picked = eligible[Math.floor(seededRandom(`${seed}:source:${source}:${i}`) * windowSize)]!;
				list.splice(list.indexOf(picked), 1);
				break;
			}
		}
		if (picked == null) break;
		out.push(picked); targets.add(picked.targetId); counts.set(picked.authorId, (counts.get(picked.authorId) ?? 0) + 1);
	}
	return out;
}

describe('misc:recommended-server-scoring selectBySource', () => {
	test('上限を無効 (100%) にすると、導入前の選定結果と完全に一致する', () => {
		for (let trial = 0; trial < 20; trial++) {
			const items = makeItems([
				{ source: 'reactionAffinity', host: 'misskey.io', count: 30 + trial },
				{ source: 'reactionAffinity', host: 'a.example', count: 10 },
				{ source: 'following', host: 'misskey.io', count: 8 },
				{ source: 'unknown', host: 'misskey.io', count: 40 },
				{ source: 'unknown', host: null, count: 5 },
			]);
			const uncapped = { ...baseSettings, maxServerPercent: 100 };
			const expected = originalSelectSources(items, uncapped, `seed${trial}`);
			const actual = selectBySource(items, uncapped, `seed${trial}`, seededRandom);
			expect(actual.map(item => item.id)).toEqual(expected.map(item => item.id));
		}
	});

	test('misskey.io が候補の大半でも、他のサーバーの候補があれば上限までしか選ばれない', () => {
		const items = makeItems([
			{ source: 'unknown', host: 'misskey.io', count: 150 },
			{ source: 'unknown', host: 'a.example', count: 12 },
			{ source: 'unknown', host: 'b.example', count: 12 },
			{ source: 'unknown', host: 'c.example', count: 12 },
			{ source: 'unknown', host: 'd.example', count: 12 },
			{ source: 'unknown', host: 'e.example', count: 12 },
		]);
		const selected = selectBySource(items, baseSettings, 'seed', seededRandom);
		const cap = serverCapFor(baseSettings.resultLimit, baseSettings.maxServerPercent);
		expect(selected).toHaveLength(baseSettings.resultLimit);
		expect(selected.filter(item => item.host === 'misskey.io').length).toBeLessThanOrEqual(cap);
	});

	test('他に候補が無ければ上限を外して埋め、件数は上限なしの場合と変わらない (UX の悪化を防ぐ)', () => {
		const items = makeItems([
			{ source: 'unknown', host: 'misskey.io', count: 100 },
			{ source: 'unknown', host: 'a.example', count: 3 },
		]);
		const capped = selectBySource(items, baseSettings, 'seed', seededRandom);
		const uncapped = selectBySource(items, { ...baseSettings, maxServerPercent: 100 }, 'seed', seededRandom);
		expect(capped).toHaveLength(uncapped.length);
		expect(capped).toHaveLength(baseSettings.resultLimit);
		// 他のサーバーの 3 件は必ず入る
		expect(capped.filter(item => item.host === 'a.example')).toHaveLength(3);
	});

	test('上限を守れる範囲では、上限なしより多様なサーバーが選ばれる', () => {
		const items = makeItems([
			{ source: 'unknown', host: 'misskey.io', count: 120 },
			...Array.from({ length: 10 }, (_, i) => ({ source: 'unknown', host: `s${i}.example`, count: 6 })),
		]);
		const distinct = (selected: Item[]) => new Set(selected.map(item => item.host)).size;
		const capped = selectBySource(items, baseSettings, 'seed', seededRandom);
		const uncapped = selectBySource(items, { ...baseSettings, maxServerPercent: 100 }, 'seed', seededRandom);
		expect(distinct(capped)).toBeGreaterThan(distinct(uncapped));
	});

	test('フォロー中のアカウントは上限の対象外 (読者が選んだもの)', () => {
		const items = makeItems([{ source: 'following', host: 'misskey.io', count: 60 }]);
		const selected = selectBySource(items, { ...baseSettings, followingPercent: 100, reactionAffinityPercent: 0, unknownPercent: 0, maxNotesPerAuthor: 10 }, 'seed', seededRandom);
		expect(selected).toHaveLength(baseSettings.resultLimit);
	});

	test('ローカル (null) は上限の対象外', () => {
		const items = makeItems([{ source: 'unknown', host: null, count: 60 }]);
		expect(selectBySource(items, baseSettings, 'seed', seededRandom)).toHaveLength(baseSettings.resultLimit);
	});

	test('同じ作者・同じノートは重複せず、作者ごとの上限を守る', () => {
		const items = makeItems([{ source: 'unknown', host: 'a.example', count: 50 }]).map((item, index) => ({ ...item, authorId: `author${index % 5}` }));
		const selected = selectBySource(items, baseSettings, 'seed', seededRandom);
		expect(new Set(selected.map(item => item.id)).size).toBe(selected.length);
		for (let a = 0; a < 5; a++) expect(selected.filter(item => item.authorId === `author${a}`).length).toBeLessThanOrEqual(baseSettings.maxNotesPerAuthor);
		expect(selected).toHaveLength(5 * baseSettings.maxNotesPerAuthor);
	});
});

// 並び順の調整の、導入前のアルゴリズム (サーバーの窓なし)
function originalSpread<T extends { id: string; authorId: string }>(items: T[], seed: string, initialPreviousAuthorId: string | null = null): T[] {
	const remaining = [...items];
	const output: T[] = [];
	let previousAuthorId: string | null = initialPreviousAuthorId;
	while (remaining.length > 0) {
		let candidates = remaining.filter(item => item.authorId !== previousAuthorId);
		if (candidates.length === 0) candidates = remaining;
		const window = candidates.slice(0, Math.min(4, candidates.length));
		const picked = window[Math.floor(seededRandom(`${seed}:author:${output.length}`) * window.length)]!;
		output.push(picked);
		remaining.splice(remaining.indexOf(picked), 1);
		previousAuthorId = picked.authorId;
	}
	return output;
}

type SpreadItem = { id: string; authorId: string; host: string | null };

function maxHostInAnyWindow(items: SpreadItem[], host: string): number {
	let max = 0;
	for (let i = 0; i < items.length; i++) {
		max = Math.max(max, items.slice(i, i + SERVER_WINDOW_SIZE).filter(item => item.host === host).length);
	}
	return max;
}

describe('misc:recommended-server-scoring spreadAuthors', () => {
	test('サーバーの窓を指定しなければ、導入前の並び順と完全に一致する', () => {
		for (let trial = 0; trial < 20; trial++) {
			const items: SpreadItem[] = Array.from({ length: 60 }, (_, i) => ({ id: `n${i}`, authorId: `a${(i * 7 + trial) % 23}`, host: i % 3 === 0 ? 'misskey.io' : null }));
			const expected = originalSpread(items, `seed${trial}`, trial % 2 === 0 ? null : 'a3');
			const actual = spreadAuthors(items, `seed${trial}`, seededRandom, trial % 2 === 0 ? null : 'a3');
			expect(actual.map(item => item.id)).toEqual(expected.map(item => item.id));
		}
	});

	test('先頭が misskey.io だらけでも、最初の 1 ページ (10件) の同一サーバーは上限以内', () => {
		const items: SpreadItem[] = [
			...Array.from({ length: 30 }, (_, i) => ({ id: `io${i}`, authorId: `io-author${i}`, host: 'misskey.io' })),
			...Array.from({ length: 30 }, (_, i) => ({ id: `ot${i}`, authorId: `ot-author${i}`, host: `s${i % 6}.example` })),
		];
		const max = serverWindowMax(40);
		const spread = spreadAuthors(items, 'seed', seededRandom, null, { max });
		expect(spread.slice(0, SERVER_WINDOW_SIZE).filter(item => item.host === 'misskey.io').length).toBeLessThanOrEqual(max);
	});

	test('代わりが十分にあるとき、どの連続 10 件でも同一サーバーは上限以内', () => {
		// misskey.io は全体の 30% で、窓の上限 (40%) の範囲に収まる
		const items: SpreadItem[] = Array.from({ length: 100 }, (_, i) => ({ id: `n${i}`, authorId: `a${i}`, host: i % 10 < 3 ? 'misskey.io' : `s${i % 7}.example` }));
		const spread = spreadAuthors(items, 'seed', seededRandom, null, { max: serverWindowMax(40) });
		expect(maxHostInAnyWindow(spread, 'misskey.io')).toBeLessThanOrEqual(serverWindowMax(40));
	});

	test('代わりが無いときは諦めて並べる (件数は減らず、重複もしない)', () => {
		const items: SpreadItem[] = Array.from({ length: 25 }, (_, i) => ({ id: `n${i}`, authorId: `a${i}`, host: 'misskey.io' }));
		const spread = spreadAuthors(items, 'seed', seededRandom, null, { max: 2 });
		expect(spread).toHaveLength(25);
		expect(new Set(spread.map(item => item.id)).size).toBe(25);
	});

	test('並べ替えの前後で、ノートの集合は変わらない', () => {
		const items: SpreadItem[] = Array.from({ length: 80 }, (_, i) => ({ id: `n${i}`, authorId: `a${i % 30}`, host: i % 2 === 0 ? 'misskey.io' : `s${i % 5}.example` }));
		const spread = spreadAuthors(items, 'seed', seededRandom, null, { max: 3 });
		expect([...spread.map(item => item.id)].sort()).toEqual([...items.map(item => item.id)].sort());
	});

	test('追加ページでは、直前のページの末尾 (recentHosts) を窓に含めて上限を守る', () => {
		// 直前のページの末尾 9 件がすべて misskey.io のとき、新しい先頭に misskey.io は置かれない
		const recentHosts = Array(SERVER_WINDOW_SIZE - 1).fill('misskey.io') as string[];
		const items: SpreadItem[] = [
			{ id: 'io0', authorId: 'x0', host: 'misskey.io' },
			{ id: 'io1', authorId: 'x1', host: 'misskey.io' },
			{ id: 'ot0', authorId: 'y0', host: 'a.example' },
			{ id: 'ot1', authorId: 'y1', host: 'b.example' },
		];
		const spread = spreadAuthors(items, 'seed', seededRandom, null, { max: 4, recentHosts });
		expect(spread[0]!.host).not.toBe('misskey.io');
	});

	test('可能な範囲で、同じ作者が連続しない', () => {
		const items: SpreadItem[] = Array.from({ length: 60 }, (_, i) => ({ id: `n${i}`, authorId: `a${i % 20}`, host: i % 4 === 0 ? 'misskey.io' : `s${i % 5}.example` }));
		const spread = spreadAuthors(items, 'seed', seededRandom, null, { max: 4 });
		for (let i = 1; i < spread.length; i++) expect(spread[i]!.authorId).not.toBe(spread[i - 1]!.authorId);
	});
});

describe('misc:recommended-server-scoring isContextStale', () => {
	test('fresh within the soft TTL, stale after it', () => {
		expect(isContextStale(1000, 1000 + 299_999)).toBe(false);
		expect(isContextStale(1000, 1000 + 300_000)).toBe(true);
	});
	test('missing timestamp is stale', () => {
		expect(isContextStale(undefined, 1000)).toBe(true);
	});
});

describe('misc:recommended-server-scoring wrapCandidateCursor', () => {
	test('keeps a cursor that is still inside the pool', () => {
		expect(wrapCandidateCursor(3, 3000, 300, 1)).toBe(3);
		expect(wrapCandidateCursor(9, 3000, 300, 1)).toBe(9);
	});
	test('wraps once the window starts at or beyond the end of the pool', () => {
		expect(wrapCandidateCursor(10, 3000, 300, 1)).toBe(1);
		expect(wrapCandidateCursor(25, 3000, 300, 1)).toBe(1);
		expect(wrapCandidateCursor(10, 3000, 300)).toBe(0);
	});
	test('an empty pool and invalid cursors fall back to the minimum', () => {
		expect(wrapCandidateCursor(1, 0, 300, 1)).toBe(1);
		expect(wrapCandidateCursor(Number.NaN, 3000, 300, 1)).toBe(1);
		expect(wrapCandidateCursor(-2, 3000, 300)).toBe(0);
	});
});
