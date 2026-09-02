<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_gaps">
	<div v-if="fetchingTrends || trends.length > 0" :class="$style.trends">
		<span :class="$style.trendsLabel"><i class="ti ti-trending-up"></i> {{ i18n.ts._widgets.trends }}</span>
		<MkLoading v-if="fetchingTrends" :inline="true"/>
		<template v-else>
			<MkA v-for="trend in trends" :key="trend.tag" :to="`/tags/${encodeURIComponent(trend.tag)}`" :class="$style.trend">#{{ trend.tag }}</MkA>
		</template>
	</div>

	<div class="_gaps">
		<MkInput v-model="searchQuery" large autofocus type="search" @enter.prevent="searchNow">
			<template #prefix><i class="ti ti-hash"></i></template>
			<template #caption>{{ hashtagSearchPrefixOnlyLabel }}</template>
		</MkInput>
		<MkButton large primary gradate rounded :disabled="normalizedQuery === '' || fetching" @click="searchNow">
			{{ i18n.ts.search }}
		</MkButton>
	</div>

	<MkFoldableSection v-if="hasSearched" expanded>
		<template #header>{{ i18n.ts.searchResult }}</template>
		<MkLoading v-if="fetching"/>
		<MkError v-else-if="error" @retry="searchNow"/>
		<MkResult v-else-if="hashtags.length === 0" type="empty"/>
		<div v-else class="_gaps_s">
			<MkA
				v-for="hashtag in hashtags"
				:key="hashtag"
				:to="`/tags/${encodeURIComponent(hashtag)}`"
				:class="$style.hashtag"
				class="_panel"
			>
				<i class="ti ti-hash" aria-hidden="true"></i>
				<span>{{ hashtag }}</span>
			</MkA>
		</div>
	</MkFoldableSection>
</div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue';
import { debounce } from 'throttle-debounce';
import * as Misskey from 'misskey-js';
import { i18n } from '@/i18n.js';
import { lang } from '@@/js/config.js';
import { misskeyApi, misskeyApiGet } from '@/utility/misskey-api.js';
import MkButton from '@/components/MkButton.vue';
import MkError from '@/components/global/MkError.vue';
import MkFoldableSection from '@/components/MkFoldableSection.vue';
import MkInput from '@/components/MkInput.vue';
import MkResult from '@/components/global/MkResult.vue';

const props = withDefaults(defineProps<{
	query?: string;
}>(), {
	query: '',
});

const hashtagSearchPrefixOnlyLabels: Record<string, string> = {
	'en-US': 'Only hashtags that start with your query are shown.',
	'ja-JP': '入力した語と最初が一致しているものだけを表示します。',
	'ja-KS': '打った言葉で最初が一緒のやつだけ出すで。',
	'ko-KR': '입력한 단어로 시작하는 해시태그만 표시합니다.',
	'ko-GS': '입력한 단어로 시작하는 해시태그만 표시합니다.',
	'zh-CN': '仅显示以输入内容开头的标签。',
	'zh-TW': '僅顯示以輸入內容開頭的雜湊標籤。',
	'de-DE': 'Es werden nur Hashtags angezeigt, die mit deiner Eingabe beginnen.',
	'fr-FR': 'Seuls les hashtags commençant par votre saisie sont affichés.',
	'es-ES': 'Solo se muestran los hashtags que comienzan con lo introducido.',
	'pt-PT': 'São apresentadas apenas as hashtags que começam pelo que introduziu.',
};
const hashtagSearchPrefixOnlyLabel = hashtagSearchPrefixOnlyLabels[lang] ?? hashtagSearchPrefixOnlyLabels['en-US']!;

const searchQuery = ref(toRef(props, 'query').value);
const normalizedQuery = computed(() => searchQuery.value.trim().replace(/^#/, ''));
const hashtags = ref<string[]>([]);
const fetching = ref(false);
const error = ref(false);
const hasSearched = ref(false);
const trends = ref<Misskey.entities.HashtagsTrendResponse>([]);
const fetchingTrends = ref(true);
const trendsError = ref(false);
let latestRequest = 0;

async function fetchTrends() {
	fetchingTrends.value = true;
	trendsError.value = false;

	try {
		trends.value = (await misskeyApiGet('hashtags/trend')).slice(0, 5);
	} catch {
		trendsError.value = true;
	} finally {
		fetchingTrends.value = false;
	}
}

async function search() {
	const query = normalizedQuery.value;
	const request = ++latestRequest;

	if (query === '') {
		hashtags.value = [];
		fetching.value = false;
		error.value = false;
		hasSearched.value = false;
		return;
	}

	fetching.value = true;
	error.value = false;
	hasSearched.value = true;

	try {
		const result = await misskeyApi('hashtags/search', {
			query,
			limit: 30,
		});
		if (request === latestRequest) hashtags.value = result;
	} catch {
		if (request === latestRequest) error.value = true;
	} finally {
		if (request === latestRequest) fetching.value = false;
	}
}

const debouncedSearch = debounce(300, search);

function searchNow() {
	debouncedSearch.cancel();
	void search();
}

watch(searchQuery, () => {
	latestRequest++;
	hashtags.value = [];
	fetching.value = false;
	error.value = false;
	if (normalizedQuery.value === '') hasSearched.value = false;
	debouncedSearch();
});

if (normalizedQuery.value !== '') searchNow();

onMounted(() => {
	void fetchTrends();
});

onBeforeUnmount(() => {
	debouncedSearch.cancel();
});
</script>

<style lang="scss" module>
.hashtag {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 14px 16px;
	color: var(--MI_THEME-hashtag);
	font-weight: bold;

	&:hover {
		background: var(--MI_THEME-panelHighlight);
		text-decoration: none;
	}
}

.trends {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 6px 10px;
	padding: 2px 4px;
	font-size: 0.85em;
	color: var(--MI_THEME-fgTransparentWeak);
}

.trendsLabel {
	display: inline-flex;
	align-items: center;
	gap: 4px;
}

.trend {
	color: var(--MI_THEME-accentLighten);

	&:hover {
		text-decoration: underline;
	}
}
</style>

