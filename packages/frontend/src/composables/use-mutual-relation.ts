/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { computed, onScopeDispose, reactive } from 'vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { useStream } from '@/stream.js';
import { $i } from '@/i.js';

const relations = reactive(new Map<string, boolean>());
const queued = new Set<string>();
const active = new Map<string, number>();
let flushScheduled = false;
let listening = false;
const maxCacheSize = 500;

function queueRefresh(userId: string): void {
	if ($i == null || userId === $i.id) return;
	queued.add(userId);
	if (flushScheduled) return;
	flushScheduled = true;
	queueMicrotask(() => void flush());
}

async function flush(): Promise<void> {
	flushScheduled = false;
	const userIds = [...queued].slice(0, 100);
	for (const userId of userIds) queued.delete(userId);
	if (userIds.length === 0) return;

	try {
		const result = await misskeyApi('users/relation', { userId: userIds });
		const relationResults = Array.isArray(result) ? result : [result];
		for (const relation of relationResults) {
			relations.delete(relation.id);
			relations.set(relation.id, relation.isFollowing && relation.isFollowed);
		}
		for (const userId of relations.keys()) {
			if (relations.size <= maxCacheSize) break;
			if (!active.has(userId)) relations.delete(userId);
		}
	} catch {
		for (const userId of userIds) {
			if (active.has(userId)) queued.add(userId);
		}
	} finally {
		if (queued.size > 0) {
			flushScheduled = true;
			window.setTimeout(() => void flush(), 5000);
		}
	}
}

function startListening(): void {
	if (listening || $i == null) return;
	listening = true;
	const connection = useStream().useChannel('main');
	const onRelationChange = (user: { id: string }) => queueRefresh(user.id);
	connection.on('follow', onRelationChange);
	connection.on('followed', onRelationChange);
	connection.on('unfollow', onRelationChange);

	window.setInterval(() => {
		for (const userId of active.keys()) queueRefresh(userId);
	}, 30_000);
}

export function useMutualRelation(userId: string) {
	startListening();
	active.set(userId, (active.get(userId) ?? 0) + 1);
	if (!relations.has(userId)) queueRefresh(userId);
	onScopeDispose(() => {
		const count = (active.get(userId) ?? 1) - 1;
		if (count <= 0) active.delete(userId);
		else active.set(userId, count);
	});
	return computed(() => relations.get(userId) === true);
}

