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
				<div :class="$style.reasons">
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
				<MkButton primary full :disabled="comment.length === 0 || reasons.length === 0" @click="send">{{ i18n.ts.send }}</MkButton>
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
const defaultAbuseReportReasons = [
	'権利を侵害する行為、また侵害する恐れがある財産、信用、名誉、プライバシー、肖像権を侵害している',
	'身体、生命、自由、名誉、財産などに対して害悪を加えると公開している',
	'他者に不利益を与えている',
	'誹謗中傷または侮辱行為',
	'公序良俗に反する',
	'他者になりすましている',
	'面識のない未成年と出会うことを主目的としてサービスを利用している',
	'人の死体、裸体、児童ポルノ、人を殺傷する現場もしくは児童虐待に相当するファイルの投稿',
	'管理権限を持たないユーザーによる他のユーザーに対しての規約違反の断定・処罰要求・排除行為（自治行為など）',
	'13歳未満のユーザーにも関わらず顔写真など個人を特定できる情報を公開している',
	'その他',
] as const;
const abuseReportReasons = ref<string[]>([...defaultAbuseReportReasons]);

onMounted(async () => {
	try {
		const configuredReasons = await os.api('users/report-abuse-reasons' as never);
		if (Array.isArray(configuredReasons) && configuredReasons.length > 0) {
			abuseReportReasons.value = configuredReasons as string[];
		}
	} catch {
		// Keep the built-in defaults while upgrading a server that has not yet
		// applied the migration.
	}
});

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
