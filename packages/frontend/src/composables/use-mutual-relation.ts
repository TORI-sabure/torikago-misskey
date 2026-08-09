/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { computed, reactive } from 'vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { useStream } from '@/stream.js';
import { $i } from '@/i.js';

const relations = reactive(new Map<string, boolean>());
const queued = new Set<string>();
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

	const result = await misskeyApi('users/relation', { userId: userIds });
	for (const relation of result) {
		relations.delete(relation.id);
		relations.set(relation.id, relation.isFollowing && relation.isFollowed);
	}
	while (relations.size > maxCacheSize) {
		const oldest = relations.keys().next().value;
		if (oldest == null) break;
		relations.delete(oldest);
	}
	if (queued.size > 0) {
		flushScheduled = true;
		queueMicrotask(() => void flush());
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
		for (const userId of relations.keys()) queueRefresh(userId);
	}, 30_000);
}

export function useMutualRelation(userId: string) {
	startListening();
	if (!relations.has(userId)) queueRefresh(userId);
	return computed(() => relations.get(userId) === true);
}

