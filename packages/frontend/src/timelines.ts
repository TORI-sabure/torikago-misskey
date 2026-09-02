/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { $i } from '@/i.js';
import { instance } from '@/instance.js';
import { ref, watch } from 'vue';
import { lang } from '@@/js/config.js';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';

export const basicTimelineTypes = [
	'mutual',
	'home',
	'recommended',
	'local',
	'social',
	'global',
] as const;

export type BasicTimelineType = typeof basicTimelineTypes[number];

const customTimelineLabels: Record<string, Partial<Record<BasicTimelineType, string>>> = {
	'en-US': { mutual: 'Mutual', recommended: 'Recommended' },
	'ja-JP': { mutual: '相互', recommended: 'おすすめ' },
	'ja-KS': { mutual: '相互', recommended: 'おすすめ' },
};

export function basicTimelineLabel(timeline: BasicTimelineType): string {
	return customTimelineLabels[lang]?.[timeline] ?? customTimelineLabels['en-US']?.[timeline] ?? i18n.ts._timelines[timeline];
}

// Test-user access is account-specific, so it must not be exposed in public
// instance metadata. Start hidden and ask the authenticated API once per page.
const recommendedTimelineAvailable = ref(false);
export const recommendedTimelineAccessChecked = ref(false);

async function refreshRecommendedTimelineAvailability(): Promise<void> {
	if ($i == null || (instance.features as typeof instance.features & { recommendedTimeline?: boolean } | undefined)?.recommendedTimeline !== true) return;
	try {
		const result = await misskeyApi('notes/recommended-timeline-available');
		recommendedTimelineAvailable.value = result.available;
	} catch {
		recommendedTimelineAvailable.value = false;
	} finally {
		recommendedTimelineAccessChecked.value = true;
	}
}

watch(() => (instance.features as typeof instance.features & { recommendedTimeline?: boolean } | undefined)?.recommendedTimeline, (enabled) => {
	if (enabled === true) void refreshRecommendedTimelineAvailability();
	else {
		recommendedTimelineAvailable.value = false;
		recommendedTimelineAccessChecked.value = true;
	}
}, { immediate: true });

export function isBasicTimeline(timeline: string): timeline is BasicTimelineType {
	return basicTimelineTypes.includes(timeline as BasicTimelineType);
}

export function basicTimelineIconClass(timeline: BasicTimelineType): string {
	switch (timeline) {
		case 'home':
			return 'ti ti-home';
		case 'mutual':
			return 'ti ti-users';
		case 'recommended':
			return 'ti ti-sparkles';
		case 'local':
			return 'ti ti-planet';
		case 'social':
			return 'ti ti-universe';
		case 'global':
			return 'ti ti-whirl';
	}
}

export function isAvailableBasicTimeline(timeline: BasicTimelineType | undefined | null): boolean {
	switch (timeline) {
		case 'home':
			return $i != null;
		case 'mutual':
			return $i != null;
		case 'recommended':
			return $i != null && recommendedTimelineAvailable.value;
		case 'local':
			return ($i == null && instance.policies.ltlAvailable) || ($i != null && $i.policies.ltlAvailable);
		case 'social':
			return $i != null && $i.policies.ltlAvailable;
		case 'global':
			return ($i == null && instance.policies.gtlAvailable) || ($i != null && $i.policies.gtlAvailable);
		default:
			return false;
	}
}

export function availableBasicTimelines(): BasicTimelineType[] {
	return basicTimelineTypes.filter(isAvailableBasicTimeline);
}

export function hasWithReplies(timeline: BasicTimelineType | undefined | null): boolean {
	return timeline === 'local' || timeline === 'social';
}
