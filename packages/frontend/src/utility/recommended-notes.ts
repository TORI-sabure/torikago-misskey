/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

type RecommendationNoteContent = {
	createdAt: string;
	reactionCount: number;
	renoteCount: number;
	tags?: string[];
	files?: { isSensitive: boolean }[];
};

type RecommendationNote = RecommendationNoteContent & {
	renote?: RecommendationNoteContent | null;
};

type SortableRecommendationNote = RecommendationNote & {
	id: string;
	text?: string | null;
	poll?: unknown | null;
	renote?: (RecommendationNoteContent & { id: string }) | null;
};

export function getRecommendationScore(note: RecommendationNote): number {
	const content = note.renote ?? note;
	const hasSensitiveMedia = (note.files?.some(file => file.isSensitive) ?? false) ||
		(content.files?.some(file => file.isSensitive) ?? false);
	const hasHashtag = (note.tags?.length ?? 0) > 0 || (content.tags?.length ?? 0) > 0;

	return (content.reactionCount * 10) +
		(content.renoteCount * 5) +
		(hasHashtag ? 3 : 0) -
		(hasSensitiveMedia ? 20 : 0);
}

export function sortRecommendedNotes<T extends SortableRecommendationNote>(notes: T[]): T[] {
	const seenNoteIds = new Set<string>();
	const uniqueNotes = notes.filter(note => {
		const isPureRenote = note.renote != null &&
			note.text == null &&
			(note.files?.length ?? 0) === 0 &&
			note.poll == null;
		const contentId = isPureRenote ? note.renote!.id : note.id;
		if (seenNoteIds.has(contentId)) return false;
		seenNoteIds.add(contentId);
		return true;
	});
	notes.splice(0, notes.length, ...uniqueNotes);

	return notes.sort((a, b) => {
		const scoreDiff = getRecommendationScore(b) - getRecommendationScore(a);
		if (scoreDiff !== 0) return scoreDiff;
		return b.createdAt.localeCompare(a.createdAt);
	});
}
