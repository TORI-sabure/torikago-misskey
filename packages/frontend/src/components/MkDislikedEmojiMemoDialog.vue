<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<MkModalWindow ref="dialog" :withOkButton="false" :width="500" :height="420" @click="close" @close="close" @closed="emit('closed')">
	<template #header>{{ labels.title }}</template>
	<div class="_gaps_m" :class="$style.body">
		<div :class="$style.description">{{ labels.description }}</div>
		<div :class="$style.emojis">
			<button v-for="emoji in emojis" :key="emoji" class="_button" :class="$style.emoji" @click="onEmojiClick($event, emoji)">
				<MkCustomEmoji v-if="emoji.startsWith(':')" :name="extractCustomEmojiName(emoji)" :host="extractCustomEmojiHost(emoji)" :normal="true" :menu="false" :menuReaction="false" :ignoreMuted="true"/>
				<MkEmoji v-else :emoji="emoji" :menu="false" :menuReaction="false" :ignoreMuted="true"/>
			</button>
		</div>
		<MkButton primary inline :disabled="emojis.length >= 100" @click="add"><i class="ti ti-plus"></i> {{ i18n.ts.add }}</MkButton>
	</div>
</MkModalWindow>
</template>
<script lang="ts" setup>
import { computed, onMounted, ref, useTemplateRef } from 'vue';
import { lang } from '@@/js/config.js';
import MkModalWindow from '@/components/MkModalWindow.vue';
import MkButton from '@/components/MkButton.vue';
import type { MenuItem } from '@/types/menu.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { extractCustomEmojiName, extractCustomEmojiHost } from '@/utility/emoji-mute.js';
const props = defineProps<{ userId: string }>();
const emit = defineEmits<{ (ev: 'closed'): void }>();
const dialog = useTemplateRef('dialog');
const emojis = ref<string[]>([]);
const api = misskeyApi as unknown as (endpoint: string, data: Record<string, unknown>) => Promise<unknown>;
const apiWithDialog = os.apiWithDialog as unknown as (endpoint: string, data: Record<string, unknown>) => Promise<unknown>;
const translations: Record<string, { title: string; description: string }> = {
	'en-US': { title: 'Memo disliked emojis', description: 'Only you will see this memo. A warning will appear if you try to react to this account with an emoji registered here.' },
	'ja-JP': { title: '苦手な絵文字をメモ', description: 'このメモはあなただけに適用されます。ここに登録した絵文字をこのアカウントに対してつけようとした場合、警告文を表示します。' },
	'ja-KS': { title: '苦手なツッコミをメモ', description: 'このメモはあんただけに効くで。ここに登録したツッコミをこのアカウントにつけようとしたら、警告を出すで。' },
	'ko-KR': { title: '싫어하는 이모지 메모', description: '이 메모는 나에게만 적용됩니다. 이 계정에 등록한 이모지로 반응하기 전에 경고합니다.' },
	'zh-CN': { title: '记录不喜欢的表情', description: '此记录仅对你生效。使用已记录的表情回应此账号前会显示警告。' },
	'zh-TW': { title: '記錄不喜歡的表情', description: '此記錄僅對你生效。使用已記錄的表情回應此帳號前會顯示警告。' },
	'de-DE': { title: 'Unerwünschte Emojis notieren', description: 'Diese Notiz gilt nur für dich. Vor einer Reaktion mit einem dieser Emojis wird eine Warnung angezeigt.' },
	'fr-FR': { title: 'Mémoriser les émojis indésirables', description: 'Cette note ne s’applique qu’à vous. Un avertissement apparaîtra avant de réagir avec l’un de ces émojis.' },
	'es-ES': { title: 'Anotar emojis no deseados', description: 'Esta nota solo se aplica a ti. Se mostrará un aviso antes de reaccionar con uno de estos emojis.' },
	'pt-PT': { title: 'Memorizar emojis indesejados', description: 'Esta nota só se aplica a si. Será apresentado um aviso antes de reagir com um destes emojis.' },
};
const labels = computed(() => translations[lang] ?? translations['en-US']!);

onMounted(reload);

async function reload() { emojis.value = await api('users/disliked-emoji-memo', { userId: props.userId }) as string[]; }

async function add(ev: PointerEvent) {
	const emoji = await os.pickEmoji((ev.currentTarget ?? ev.target) as HTMLElement, { showPinned: false });
	if (emoji == null || emojis.value.includes(emoji)) return;
	await apiWithDialog('users/disliked-emoji-memo-add', { userId: props.userId, emoji });
	await reload();
}

function onEmojiClick(ev: PointerEvent, emoji: string) {
	const menu: MenuItem[] = [{ type: 'label', text: emoji }, { text: i18n.ts.delete, icon: 'ti ti-trash', danger: true, action: () => remove(emoji) }];
	os.popupMenu(menu, ev.currentTarget ?? ev.target);
}

async function remove(emoji: string) {
	const { canceled } = await os.confirm({ type: 'warning', title: i18n.ts.deleteConfirm });
	if (canceled) return;
	await apiWithDialog('users/disliked-emoji-memo-delete', { userId: props.userId, emoji });
	emojis.value = emojis.value.filter(value => value !== emoji);
}

function close() { dialog.value?.close(); }
</script>
<style module>
.body { padding: 24px; }
.description { opacity: 0.75; }
.emojis { display: flex; flex-wrap: wrap; gap: 4px; }
.emoji { display: inline-flex; height: 42px; padding: 0 6px; font-size: 1.5em; border-radius: 6px; align-items: center; justify-content: center; background: var(--MI_THEME-buttonBg); }
</style>
