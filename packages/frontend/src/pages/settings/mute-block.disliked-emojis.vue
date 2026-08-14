<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_gaps_m">
	<div :class="$style.emojis">
		<div v-for="emoji in emojis" :key="emoji" :class="$style.emoji" @click="onEmojiClick($event, emoji)">
			<MkCustomEmoji
				v-if="emoji.startsWith(':')"
				:name="extractCustomEmojiName(emoji)"
				:host="extractCustomEmojiHost(emoji)"
				:normal="true"
				:menu="false"
				:menuReaction="false"
				:ignoreMuted="true"
			/>
			<MkEmoji
				v-else
				:emoji="emoji"
				:menu="false"
				:menuReaction="false"
				:ignoreMuted="true"
			/>
		</div>
	</div>

	<MkButton primary inline :disabled="emojis.length >= 100" @click="add"><i class="ti ti-plus"></i> {{ i18n.ts.add }}</MkButton>
</div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import type { MenuItem } from '@/types/menu';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { extractCustomEmojiName, extractCustomEmojiHost } from '@/utility/emoji-mute.js';

const emojis = ref<string[]>([]);
const api = misskeyApi as unknown as (endpoint: string, data: Record<string, unknown>) => Promise<unknown>;
const apiWithDialog = os.apiWithDialog as unknown as (endpoint: string, data: Record<string, unknown>) => Promise<unknown>;

onMounted(async () => {
	emojis.value = await api('i/disliked-emojis', {}) as string[];
});

function getHTMLElement(ev: PointerEvent): HTMLElement {
	return (ev.currentTarget ?? ev.target) as HTMLElement;
}

async function add(ev: PointerEvent) {
	const emoji = await os.pickEmoji(getHTMLElement(ev), { showPinned: false });
	if (emoji == null || emojis.value.includes(emoji)) return;
	await apiWithDialog('i/disliked-emojis-add', { emoji });
	emojis.value = await api('i/disliked-emojis', {}) as string[];
}

function onEmojiClick(ev: PointerEvent, emoji: string) {
	const menuItems: MenuItem[] = [{
		type: 'label',
		text: emoji,
	}, {
		text: i18n.ts.delete,
		icon: 'ti ti-trash',
		danger: true,
		action: () => remove(emoji),
	}];
	os.popupMenu(menuItems, ev.currentTarget ?? ev.target);
}

async function remove(emoji: string) {
	const { canceled } = await os.confirm({
		type: 'warning',
		title: i18n.ts.deleteConfirm,
	});
	if (canceled) return;
	await apiWithDialog('i/disliked-emojis-delete', { emoji });
	emojis.value = emojis.value.filter(value => value !== emoji);
}
</script>

<style module>
.emojis {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 4px;

	&:empty {
		display: none;
	}
}

.emoji {
	display: inline-flex;
	height: 42px;
	padding: 0 6px;
	font-size: 1.5em;
	border-radius: 6px;
	align-items: center;
	justify-content: center;
	background: var(--MI_THEME-buttonBg);
}
</style>
