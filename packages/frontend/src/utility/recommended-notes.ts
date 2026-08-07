/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type * as Misskey from 'misskey-js';

type RecommendationNote = Pick<Misskey.entities.Note, 'createdAt' | 'reactionCount' | 'renoteCount' | 'tags'>;

export function getRecommendationScore(note: RecommendationNote): number {
	return (note.reactionCount * 10) + (note.renoteCount * 5) + (note.tags.length > 0 ? 3 : 0);
}

export function sortRecommendedNotes<T extends RecommendationNote>(notes: T[]): T[] {
	return notes.sort((a, b) => {
		const scoreDiff = getRecommendationScore(b) - getRecommendationScore(a);
		if (scoreDiff !== 0) return scoreDiff;
		return b.createdAt.localeCompare(a.createdAt);
	});
}
