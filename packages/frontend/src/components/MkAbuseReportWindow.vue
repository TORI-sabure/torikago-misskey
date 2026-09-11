<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkWindow ref="uiWindow" :initialWidth="400" :initialHeight="500" :canResize="true" @closed="emit('closed')">
	<template #header>
		<i class="ti ti-exclamation-circle" style="margin-right: 0.5em;"></i>
		<I18n :src="i18n.ts.reportAbuseOf" tag="span">
			<template #name>
				<b><MkAcct :user="user"/></b>
			</template>
		</I18n>
	</template>
	<div class="_spacer" style="--MI_SPACER-min: 20px; --MI_SPACER-max: 28px;">
		<div class="_gaps_m" :class="$style.root">
			<div>
				<div :class="$style.reasonLabel">通報理由 <span :class="$style.required">必須・複数選択可</span></div>
				<div v-if="!reasonsLoaded" :class="$style.reasonState">{{ reportReasonsText.loading }}</div>
				<div v-else-if="reasonsLoadFailed" :class="$style.reasonState">
					<span>{{ reportReasonsText.failed }}</span>
					<MkButton small @click="loadAbuseReportReasons">{{ reportReasonsText.retry }}</MkButton>
				</div>
				<div v-else :class="$style.reasons">
					<label v-for="reason in abuseReportReasons" :key="reason" :class="$style.reason">
						<input v-model="reasons" type="checkbox" :value="reason"/>
						<span>{{ reason }}</span>
					</label>
				</div>
			</div>
			<div class="">
				<MkTextarea v-model="comment">
					<template #label>{{ i18n.ts.details }}</template>
					<template #caption>{{ i18n.ts.fillAbuseReportDescription }}</template>
				</MkTextarea>
			</div>
			<div class="">
				<MkButton primary full :disabled="!reasonsLoaded || reasonsLoadFailed || comment.length === 0 || reasons.length === 0" @click="send">{{ i18n.ts.send }}</MkButton>
			</div>
		</div>
	</div>
</MkWindow>
</template>

<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue';
import * as Misskey from 'misskey-js';
import MkWindow from '@/components/MkWindow.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';

const props = defineProps<{
	user: Misskey.entities.UserLite;
	initialComment?: string;
}>();

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

const uiWindow = useTemplateRef('uiWindow');
const comment = ref(props.initialComment ?? '');
const reasons = ref<string[]>([]);
const abuseReportReasons = ref<string[]>([]);
const reasonsLoaded = ref(false);
const reasonsLoadFailed = ref(false);
const reportReasonsTexts: Record<string, { loading: string; failed: string; retry: string }> = {
	'en-US': { loading: 'Loading report reasons…', failed: 'Could not load report reasons.', retry: 'Retry' },
	'ja-JP': { loading: '通報理由を読み込んでいます…', failed: '通報理由を読み込めませんでした。', retry: '再試行' },
	'ja-KS': { loading: '通報理由を読み込んどるで…', failed: '通報理由を読み込めへんかったわ。', retry: 'もう一回やる' },
	'ko-KR': { loading: '신고 사유를 불러오는 중…', failed: '신고 사유를 불러오지 못했습니다.', retry: '다시 시도' },
	'zh-CN': { loading: '正在加载举报理由…', failed: '无法加载举报理由。', retry: '重试' },
	'zh-TW': { loading: '正在載入檢舉理由…', failed: '無法載入檢舉理由。', retry: '重試' },
};
const reportReasonsText = reportReasonsTexts[window.document.documentElement.lang] ?? reportReasonsTexts['en-US']!;

async function loadAbuseReportReasons() {
	reasonsLoaded.value = false;
	reasonsLoadFailed.value = false;
	try {
		let configuredReasons: unknown;
		try {
			configuredReasons = await os.api('users/report-abuse-reasons' as never);
		} catch {
			// Keep a fallback on the established report endpoint. This avoids making
			// the dialog depend on a separately registered endpoint during upgrades.
			const response = await os.api('users/report-abuse', { getReasons: true } as never) as { reasons?: unknown };
			configuredReasons = response.reasons;
		}
		if (Array.isArray(configuredReasons) && configuredReasons.length > 0) {
			abuseReportReasons.value = configuredReasons as string[];
			reasons.value = reasons.value.filter(reason => abuseReportReasons.value.includes(reason));
		} else {
			reasonsLoadFailed.value = true;
		}
	} catch {
		reasonsLoadFailed.value = true;
	} finally {
		reasonsLoaded.value = true;
	}
}

onMounted(() => void loadAbuseReportReasons());

function send() {
	os.apiWithDialog('users/report-abuse', {
		userId: props.user.id,
		comment: comment.value,
		reasons: reasons.value,
	} as never, undefined).then(res => {
		os.alert({
			type: 'success',
			text: i18n.ts.abuseReported,
		});
		uiWindow.value?.close();
		emit('closed');
	});
}
</script>

<style lang="scss" module>
.root {
	--root-margin: 16px;
}

.reasonLabel {
	font-weight: 700;
	margin-bottom: 8px;
}

.required {
	font-size: 0.85em;
	font-weight: normal;
	color: var(--MI_THEME-warn);
}

.reasons {
	display: grid;
	gap: 8px;
}

.reasonState {
	display: flex;
	gap: 8px;
	align-items: center;
}

.reason {
	display: flex;
	gap: 8px;
	align-items: flex-start;
	line-height: 1.35;
	cursor: pointer;
}

.reason input {
	margin-top: 0.2em;
}
</style>
