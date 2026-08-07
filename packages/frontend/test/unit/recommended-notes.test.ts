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

	test('uses the original note signals when evaluating a renote', () => {
		expect(getRecommendationScore({
			createdAt: '2026-01-02T00:00:00.000Z',
			reactionCount: 0,
			renoteCount: 0,
			renote: {
				createdAt: '2026-01-01T00:00:00.000Z',
				reactionCount: 2,
				renoteCount: 1,
				tags: ['misskey'],
			},
		})).toBe(28);
	});

	test('lowers the priority of notes with sensitive files without excluding them', () => {
		expect(getRecommendationScore({
			createdAt: '2026-01-01T00:00:00.000Z',
			reactionCount: 2,
			renoteCount: 0,
			tags: [],
			files: [{ isSensitive: true }],
		})).toBe(0);
	});

	test('checks sensitive files attached to a quote renote as well', () => {
		expect(getRecommendationScore({
			createdAt: '2026-01-02T00:00:00.000Z',
			reactionCount: 0,
			renoteCount: 0,
			files: [{ isSensitive: true }],
			renote: {
				createdAt: '2026-01-01T00:00:00.000Z',
				reactionCount: 2,
				renoteCount: 0,
			},
		})).toBe(0);
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

	test('keeps only the newest occurrence of the same renoted note', () => {
		const sharedRenote = {
			id: 'original',
			createdAt: '2026-01-01T00:00:00.000Z',
			reactionCount: 10,
			renoteCount: 5,
		};
		const notes = [{
			id: 'newer-renote',
			createdAt: '2026-02-02T00:00:00.000Z',
			reactionCount: 0,
			renoteCount: 0,
			renote: sharedRenote,
		}, {
			id: 'older-renote',
			createdAt: '2026-02-01T00:00:00.000Z',
			reactionCount: 0,
			renoteCount: 0,
			renote: sharedRenote,
		}];

		expect(sortRecommendedNotes(notes).map(note => note.id)).toEqual(['newer-renote']);
	});

	test('keeps distinct quote renotes of the same note', () => {
		const sharedRenote = {
			id: 'original',
			createdAt: '2026-01-01T00:00:00.000Z',
			reactionCount: 10,
			renoteCount: 5,
		};
		const notes = [{
			id: 'quote-one',
			createdAt: '2026-02-02T00:00:00.000Z',
			text: 'first quote',
			reactionCount: 0,
			renoteCount: 0,
			renote: sharedRenote,
		}, {
			id: 'quote-two',
			createdAt: '2026-02-01T00:00:00.000Z',
			text: 'second quote',
			reactionCount: 0,
			renoteCount: 0,
			renote: sharedRenote,
		}];

		expect(sortRecommendedNotes(notes).map(note => note.id)).toEqual(['quote-one', 'quote-two']);
	});
});
