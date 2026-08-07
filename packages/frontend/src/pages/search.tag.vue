<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_gaps">
	<div class="_gaps">
		<MkInput v-model="searchQuery" large autofocus type="search" @enter.prevent="searchNow">
			<template #prefix><i class="ti ti-hash"></i></template>
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
import { computed, onBeforeUnmount, ref, toRef, watch } from 'vue';
import { debounce } from 'throttle-debounce';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';
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

const searchQuery = ref(toRef(props, 'query').value);
const normalizedQuery = computed(() => searchQuery.value.trim().replace(/^#/, ''));
const hashtags = ref<string[]>([]);
const fetching = ref(false);
const error = ref(false);
const hasSearched = ref(false);
let latestRequest = 0;

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
</style>
