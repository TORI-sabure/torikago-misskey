/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { getRecommendationScore, sortRecommendedNotes } from '@/utility/recommended-notes.js';

describe('recommended notes', () => {
	test('reactions are the strongest signal, followed by renotes and hashtags', () => {
		expect(getRecommendationScore({
			createdAt: '2026-01-01T00:00:00.000Z',
			reactionCount: 2,
			renoteCount: 1,
			tags: ['misskey'],
		})).toBe(28);
	});

	test('sorts by score and uses recency as a tie breaker', () => {
		const notes = [{
			id: 'tagged',
			createdAt: '2026-01-01T00:00:00.000Z',
			reactionCount: 1,
			renoteCount: 0,
			tags: ['misskey'],
		}, {
			id: 'reacted',
			createdAt: '2025-01-01T00:00:00.000Z',
			reactionCount: 2,
			renoteCount: 0,
			tags: [],
		}, {
			id: 'newer-tie',
			createdAt: '2026-02-01T00:00:00.000Z',
			reactionCount: 1,
			renoteCount: 0,
			tags: ['misskey'],
		}];

		expect(sortRecommendedNotes(notes).map(note => note.id)).toEqual([
			'reacted',
			'newer-tie',
			'tagged',
		]);
	});
});
