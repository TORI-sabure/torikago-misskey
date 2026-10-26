/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * おすすめタイムラインの「サーバー (ホスト)」単位のスコアリングと分散ロジック。
 *
 * 目的は、ノート数の多い巨大サーバーだけでタイムラインが埋まるのを和らげること。
 * 表示数を減らさないよう、上限はすべて「できる範囲で守る」緩い制約にしている:
 *   - 好きなサーバー・候補に少ないサーバーへ加点して、流動的に順位を動かす
 *   - 選定時と並び順 (表示ページ内) の両方で同一サーバーの数を抑えるが、
 *     代わりになる候補が無ければ上限を超えて埋める
 *
 * ホストが null のノートはローカルサーバーのもの。ローカルは localUserBonus で別に扱うため、
 * ここでの加点・上限の対象にしない。
 */

/** 「よくリアクションする」を数える期間 (日)。リアクションした時刻で数える */
export const REACTION_WINDOW_DAYS = 90;
/** この期間 (日) 内のリアクションは重く数える */
export const REACTION_RECENT_DAYS = 14;
/** 直近のリアクション 1 件を、全期間の件数に加えて何件ぶん上乗せするか */
export const RECENT_REACTION_WEIGHT = 3;
/** リアクション集計で DB から受け取る (作者 × サーバー) の最大行数 */
export const REACTION_ROW_LIMIT = 20000;
/** コンテキストに保存する好きなサーバーの最大数 */
export const SERVER_AFFINITY_KEEP = 100;

/** サーバー親和度: 少ない反応だけで「好き」と判定しないための擬似カウント */
const SERVER_AFFINITY_PRIOR = 5;
/** サーバー親和度が満点になる、期待値に対する倍率の log2 (3 = 8 倍) */
const SERVER_AFFINITY_SATURATION_LOG2 = 3;

/** 同一サーバーの上限を並び順で守る窓の大きさ。クライアントの 1 ページ (既定 10 件) に合わせる */
export const SERVER_WINDOW_SIZE = 10;

export type ReactionAuthorRow = {
	userId: string;
	userHost: string | null;
	/** 期間内のリアクション数 */
	total: number;
	/** そのうち直近のリアクション数 */
	recent: number;
};

export type ReactionAggregate = {
	/** 作者ごとの重み (降順) */
	authors: Array<[string, number]>;
	/** リモートサーバーごとの重み (降順、上位のみ) */
	hosts: Array<[string, number]>;
	/** すべてのリモートサーバーの重みの合計 (上位に入らなかった分も含む) */
	hostTotal: number;
};

export function reactionWeight(total: number, recent: number): number {
	return total + RECENT_REACTION_WEIGHT * recent;
}

const byWeightDesc = (a: [string, number], b: [string, number]): number => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

/**
 * 1 回のスキャンで得た (作者 × サーバー) ごとの件数から、作者別とサーバー別の重みを作る。
 * 作者とサーバーは 1 対 1 に対応するので、サーバー別は作者別の行を足し合わせるだけで求まる
 * (サーバー別のために DB を再スキャンしない)。
 */
export function aggregateReactionRows(rows: readonly ReactionAuthorRow[], hostLimit = SERVER_AFFINITY_KEEP): ReactionAggregate {
	const authors: Array<[string, number]> = [];
	const hostWeights = new Map<string, number>();
	let hostTotal = 0;
	for (const row of rows) {
		const weight = reactionWeight(row.total, row.recent);
		authors.push([row.userId, weight]);
		if (row.userHost != null) {
			hostWeights.set(row.userHost, (hostWeights.get(row.userHost) ?? 0) + weight);
			hostTotal += weight;
		}
	}
	return {
		authors: authors.sort(byWeightDesc),
		hosts: [...hostWeights].sort(byWeightDesc).slice(0, hostLimit),
		hostTotal,
	};
}

export type ServerAffinity = {
	hosts: ReadonlyArray<readonly [string, number]>;
	/** すべてのリモートサーバーへのリアクションの重みの合計 */
	total: number;
};

export type ServerBonusSettings = {
	/** 好きなサーバーへの加点の最大値 */
	serverAffinityBonus: number;
	/** 候補に少ないサーバーへの加点の最大値 */
	serverDiversityBonus: number;
};

/**
 * 候補ノートのサーバー分布から、サーバーごとの加点を決める。
 *
 * - 多様性の加点: 候補に占める割合が小さいサーバーほど大きい (割合 0 → 最大、割合 1 → 0)。
 *   1 回の生成で多く候補に挙がったサーバーが自然に埋もれ、他のサーバーが上がる。
 * - 親和度の加点: 「リアクションの割合」が「候補に占める割合」を大きく上回るサーバーほど大きい。
 *   単純な割合ではなく候補の割合との比で見るので、誰もが多く反応する巨大サーバーは加点されない。
 *   反応が少ないサーバーは擬似カウントで 0 に近づけ、偶然の 1 件で好きと判定しない。
 *
 * 戻り値はリモートサーバーのみ。ローカル (null) と候補に無いサーバーは含まない。
 */
export function computeServerBonuses(
	candidateHosts: ReadonlyArray<string | null | undefined>,
	affinity: ServerAffinity,
	settings: ServerBonusSettings,
): Map<string, number> {
	const poolCounts = new Map<string, number>();
	let remoteTotal = 0;
	for (const host of candidateHosts) {
		if (host == null) continue;
		poolCounts.set(host, (poolCounts.get(host) ?? 0) + 1);
		remoteTotal++;
	}

	const bonuses = new Map<string, number>();
	if (remoteTotal === 0) return bonuses;

	const affinityWeights = new Map(affinity.hosts);
	for (const [host, count] of poolCounts) {
		const poolShare = count / remoteTotal;
		const diversity = settings.serverDiversityBonus * (1 - poolShare);
		const ratio = ((affinityWeights.get(host) ?? 0) + SERVER_AFFINITY_PRIOR) / (affinity.total * poolShare + SERVER_AFFINITY_PRIOR);
		const affinityScore = Math.min(1, Math.max(0, Math.log2(ratio) / SERVER_AFFINITY_SATURATION_LOG2));
		bonuses.set(host, diversity + settings.serverAffinityBonus * affinityScore);
	}
	return bonuses;
}

/**
 * 1 回の選定で同一サーバーから選べる件数の上限。percent が 100 以上なら無制限。
 */
export function serverCapFor(limit: number, percent: number): number {
	if (percent >= 100) return Infinity;
	return Math.max(2, Math.ceil(limit * percent / 100));
}

/** そのサーバーの選定数が上限に達しているか。ローカル (null) は対象外 */
export function isServerFull(counts: ReadonlyMap<string, number>, host: string | null | undefined, cap: number): boolean {
	return host != null && (counts.get(host) ?? 0) >= cap;
}

/**
 * 並び順で、連続する SERVER_WINDOW_SIZE 件の中に同一サーバーを何件まで置くか。percent が 100 以上なら無制限。
 */
export function serverWindowMax(percent: number): number {
	if (percent >= 100) return Infinity;
	return Math.max(1, Math.ceil(SERVER_WINDOW_SIZE * percent / 100));
}

/**
 * 直前に並べた (窓内の) ホストに照らして、置いても上限を超えない候補だけに絞る。
 * 絞った結果が空になる (代わりが無い) ときは、並べられなくなるのを避けるため絞らずに返す。
 */
export function filterByServerWindow<T extends { host?: string | null }>(
	items: readonly T[],
	recentHosts: ReadonlyArray<string | null | undefined>,
	max: number,
): T[] {
	if (!Number.isFinite(max)) return [...items];
	const allowed = items.filter(item => item.host == null || recentHosts.filter(host => host === item.host).length < max);
	return allowed.length > 0 ? allowed : [...items];
}

export type SelectableItem = {
	id: string;
	source: string;
	authorId: string;
	host: string | null;
	targetId: string;
	quality: number;
};

export type SourceSelectionSettings = {
	resultLimit: number;
	maxNotesPerAuthor: number;
	maxServerPercent: number;
	reactionAffinityPercent: number;
	followingPercent: number;
	unknownPercent: number;
	/**
	 * 自分のアンテナ由来の枠の割合 (結果全体に対する %、他の 3 つの割合とは別枠)。0 または未指定なら使わない。
	 * 残りの枠 (100 - antennaPercent) を、上の 3 つの割合で分ける。
	 */
	antennaPercent?: number;
};

/**
 * 候補を「フォロー中 / よくリアクションする人 / それ以外」の割合に従って選ぶ。
 *
 * 1 つのサーバーが全枠を埋めないよう、同一サーバーの選定数に上限 (maxServerPercent) を設ける。
 * ただし上限で打ち切ると結果が短くなって UX が悪化するので、2 パス構成にしている:
 *   1 パス目: 上限を守って選ぶ。
 *   2 パス目: 他に選べる候補が尽きたら、上限を外して残りの枠を埋める。
 * そのため結果の件数は、上限が無い場合と変わらない。
 *
 * フォロー中のアカウントは上限の対象外 (読者自身が選んだもので、割合は followingPercent で別に抑えられている)。
 * ローカルサーバー (host が null) も対象外。
 */
export function selectBySource<T extends SelectableItem>(
	items: readonly T[],
	settings: SourceSelectionSettings,
	seed: string,
	random: (key: string) => number,
	existingAuthorCounts: ReadonlyMap<string, number> = new Map(),
): T[] {
	const bySource = new Map(['antenna', 'following', 'reactionAffinity', 'unknown'].map(source => [source, items.filter(item => item.source === source).sort((a, b) => b.quality - a.quality)]));
	const percentages: Array<[string, number]> = [['reactionAffinity', settings.reactionAffinityPercent], ['following', settings.followingPercent], ['unknown', settings.unknownPercent]];
	if (percentages.every(([, percent]) => percent === 0)) percentages[0]![1] = 100;
	const antennaPercent = Math.min(100, Math.max(0, settings.antennaPercent ?? 0));
	if (antennaPercent > 0) {
		// アンテナ枠を別枠として先に確保し、残りを従来の割合 (合計 100) で分ける。
		const total = percentages.reduce((sum, [, percent]) => sum + percent, 0) || 1;
		for (const entry of percentages) entry[1] = entry[1] / total * (100 - antennaPercent);
		percentages.push(['antenna', antennaPercent]);
	}
	const out: T[] = []; const counts = new Map(existingAuthorCounts); const targets = new Set<string>();
	const serverCap = serverCapFor(settings.resultLimit, settings.maxServerPercent);
	const serverCounts = new Map<string, number>();
	for (const enforceServerCap of [true, false]) {
		for (let i = out.length; i < settings.resultLimit; i++) {
			const wanted = [...percentages].sort((a, b) => ((out.filter(item => item.source === a[0]).length + 1) / Math.max(a[1], 1)) - ((out.filter(item => item.source === b[0]).length + 1) / Math.max(b[1], 1)))[0]![0];
			const sources = [wanted, ...percentages.map(x => x[0]).filter(source => source !== wanted)];
			let picked: T | undefined;
			for (const source of sources) {
				const list = bySource.get(source) ?? [];
				const eligible = list.filter(item => !targets.has(item.targetId) && (counts.get(item.authorId) ?? 0) < settings.maxNotesPerAuthor && !(enforceServerCap && item.source !== 'following' && isServerFull(serverCounts, item.host, serverCap)));
				if (eligible.length > 0) {
					// Sampling from the stronger portion rather than always taking rank 1
					// prevents every snapshot from having the same score-heavy head.
					const windowSize = Math.max(1, Math.ceil(eligible.length * 0.6));
					picked = eligible[Math.floor(random(`${seed}:source:${source}:${i}`) * windowSize)]!;
					list.splice(list.indexOf(picked), 1);
					break;
				}
			}
			if (picked == null) break;
			out.push(picked); targets.add(picked.targetId); counts.set(picked.authorId, (counts.get(picked.authorId) ?? 0) + 1);
			if (picked.host != null) serverCounts.set(picked.host, (serverCounts.get(picked.host) ?? 0) + 1);
		}
	}
	return out;
}

export type ServerWindow = {
	max: number;
	/** この並びの直前に置かれているノートのホスト (古い順)。ページ追加時に窓を途切れさせないために使う */
	recentHosts?: ReadonlyArray<string | null | undefined>;
};

/**
 * 並び順の調整。同じ投稿者が続かないようにし、serverWindow があれば、同一サーバーが
 * 連続する SERVER_WINDOW_SIZE 件の中で max 件を超えないようにもする (どちらも代わりが無ければ諦める)。
 * 元の並び (スコア・カテゴリ順) は、先頭の数件から選ぶことでおおむね保つ。
 */
export function spreadAuthors<T extends { id: string; authorId: string; host?: string | null }>(
	items: readonly T[],
	seed: string,
	random: (key: string) => number,
	initialPreviousAuthorId: string | null = null,
	serverWindow?: ServerWindow,
): T[] {
	const remaining = [...items];
	const output: T[] = [];
	const emittedHosts: Array<string | null | undefined> = [...(serverWindow?.recentHosts ?? [])];
	let previousAuthorId: string | null = initialPreviousAuthorId;
	while (remaining.length > 0) {
		let candidates = remaining.filter(item => item.authorId !== previousAuthorId);
		if (candidates.length === 0) candidates = remaining;
		if (serverWindow != null) {
			candidates = filterByServerWindow(candidates, emittedHosts.slice(-(SERVER_WINDOW_SIZE - 1)), serverWindow.max);
		}
		// Keep the score/category order mostly intact while choosing among the first
		// few alternatives. This separates repeated authors without flattening the
		// recommendation ranking into a fully random list.
		const window = candidates.slice(0, Math.min(4, candidates.length));
		const picked = window[Math.floor(random(`${seed}:author:${output.length}`) * window.length)]!;
		output.push(picked);
		emittedHosts.push(picked.host);
		remaining.splice(remaining.indexOf(picked), 1);
		previousAuthorId = picked.authorId;
	}
	return output;
}

// Per-user recommendation context is served stale-while-revalidate: within the soft TTL it is used as is,
// after it the stale value is still returned and one request rebuilds it in the background.
export const CONTEXT_SOFT_TTL_MS = 5 * 60 * 1000;

export function isContextStale(builtAt: number | undefined, now: number, softTtlMs = CONTEXT_SOFT_TTL_MS): boolean {
	// An entry without a timestamp predates this logic; treat it as stale so it gets refreshed.
	return typeof builtAt !== 'number' || now - builtAt >= softTtlMs;
}
