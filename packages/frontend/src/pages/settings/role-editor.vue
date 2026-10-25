<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker path="/settings/role-editor" :label="t.title" :keywords="['role', 'editor']" icon="ti ti-badge">
	<div class="_gaps_m">
		<MkInfo>{{ t.info }}</MkInfo>

		<div v-if="!instance.enableUserRoleEditor">
			<MkInfo warn>{{ t.disabled }}</MkInfo>
		</div>
		<template v-else>
			<MkFolder :key="editingId ?? 'new'" :defaultOpen="editingId != null">
				<template #icon><i class="ti ti-plus"></i></template>
				<template #label>{{ editingId == null ? t.create : t.edit }}</template>

				<div class="_gaps_m">
					<MkInput v-model="name">
						<template #label>{{ t.name }}</template>
					</MkInput>

					<MkTextarea v-model="description">
						<template #label>{{ t.description }}</template>
					</MkTextarea>

					<div class="_gaps_s">
						<div>{{ t.color }}</div>
						<div :class="$style.row">
							<MkSwitch v-model="useColor">{{ t.useColor }}</MkSwitch>
							<input v-if="useColor" v-model="color" type="color" :aria-label="t.color" :class="$style.colorInput"/>
						</div>
					</div>

					<div class="_gaps_s">
						<div>{{ t.icon }}</div>
						<div :class="$style.row">
							<img v-if="previewUrl" :src="previewUrl" :class="$style.preview" alt=""/>
							<MkButton inline @click="pickFile">{{ t.chooseImage }}</MkButton>
							<MkButton v-if="previewUrl" inline danger @click="clearIcon">{{ t.removeImage }}</MkButton>
						</div>
						<div :class="$style.hint">{{ t.iconHint }}</div>
						<input ref="fileInput" type="file" accept="image/*" style="display: none;" @change="onFileChange"/>
					</div>

					<MkSwitch v-model="asBadge">{{ t.asBadge }}</MkSwitch>
					<MkSwitch v-model="isPersonal">
						{{ t.isPersonal }}
						<template #caption>{{ t.isPersonalCaption }}</template>
					</MkSwitch>

					<div class="_buttons">
						<MkButton primary inline :disabled="saving || name.trim() === ''" @click="save"><i class="ti ti-check"></i> {{ editingId == null ? t.create : t.save }}</MkButton>
						<MkButton v-if="editingId != null" inline @click="resetForm">{{ t.cancel }}</MkButton>
					</div>
				</div>
			</MkFolder>

			<div v-if="loading" class="_gaps_s">...</div>
			<MkResult v-else-if="roles.length === 0" type="empty" :text="t.noRoles"/>
			<div v-else class="_gaps_s">
				<div v-for="role in roles" :key="role.id" v-panel :class="$style.item">
					<div :class="$style.itemHead">
						<MkRolePreview :role="role" :forModeration="false"/>
						<span v-if="role.isPersonal" :class="$style.badge">{{ t.personalBadge }}</span>
					</div>
					<div class="_buttons">
						<MkButton inline small :primary="!hasRole(role)" @click="toggleAssign(role)">{{ hasRole(role) ? t.detach : t.attach }}</MkButton>
						<MkButton inline small @click="startEdit(role)"><i class="ti ti-pencil"></i> {{ t.edit }}</MkButton>
						<MkButton inline small danger @click="remove(role)"><i class="ti ti-trash"></i> {{ t.delete }}</MkButton>
					</div>
				</div>
			</div>
		</template>
	</div>
</SearchMarker>
</template>

<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import * as Misskey from 'misskey-js';
import MkInfo from '@/components/MkInfo.vue';
import MkInput from '@/components/MkInput.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkButton from '@/components/MkButton.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkResult from '@/components/MkResult.vue';
import MkRolePreview from '@/components/MkRolePreview.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { uploadFile } from '@/utility/drive.js';
import { instance } from '@/instance.js';
import { $i } from '@/i.js';
import { refreshCurrentAccount } from '@/accounts.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';

const allTexts: Record<string, Record<string, string>> = {
	'ja-JP': {
		title: 'ロールエディター',
		info: '見た目だけのロールを作成できます。ロールに権限はありません。ロール画像は作成時にあなたのドライブへアップロードされます。',
		disabled: 'ロールエディターは現在無効です。',
		create: 'ロールを作成',
		edit: '編集',
		save: '保存',
		cancel: 'キャンセル',
		delete: '削除',
		name: 'ロール名',
		description: '説明',
		color: '色',
		useColor: '色を指定する',
		icon: 'ロール画像',
		chooseImage: '画像を選択',
		removeImage: '画像を外す',
		iconHint: '選んだ画像は仮表示です。保存した時にドライブへアップロードされます (容量が足りない場合は保存できません)。',
		asBadge: 'バッジとして表示する',
		isPersonal: '自分専用にする',
		isPersonalCaption: 'オンにすると、あなた以外はこのロールをつけられません。',
		noRoles: '作成したロールはありません。',
		personalBadge: '自分専用',
		attach: 'つける',
		detach: 'はずす',
		confirmDelete: 'このロールを削除しますか？',
	},
	'en-US': {
		title: 'Role editor',
		info: 'You can create cosmetic roles. Roles made here have no permissions. The role image is uploaded to your drive when the role is saved.',
		disabled: 'The role editor is currently disabled.',
		create: 'Create role',
		edit: 'Edit',
		save: 'Save',
		cancel: 'Cancel',
		delete: 'Delete',
		name: 'Role name',
		description: 'Description',
		color: 'Color',
		useColor: 'Set a color',
		icon: 'Role image',
		chooseImage: 'Choose image',
		removeImage: 'Remove image',
		iconHint: 'The chosen image is only a preview. It is uploaded to your drive on save (saving fails if your drive is full).',
		asBadge: 'Show as badge',
		isPersonal: 'Make it personal',
		isPersonalCaption: 'When on, nobody but you can attach this role.',
		noRoles: 'You have not created any roles.',
		personalBadge: 'Personal',
		attach: 'Attach',
		detach: 'Remove',
		confirmDelete: 'Delete this role?',
	},
};
const t = allTexts[window.document.documentElement.lang] ?? allTexts['en-US']!;

const roles = ref<Misskey.entities.Role[]>([]);
const loading = ref(true);
const saving = ref(false);

const editingId = ref<string | null>(null);
const name = ref('');
const description = ref('');
const useColor = ref(false);
const color = ref('#3b82f6');
const asBadge = ref(false);
const isPersonal = ref(false);
const previewUrl = ref<string | null>(null);
const pickedFile = ref<File | null>(null);
const iconRemoved = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
let objectUrl: string | null = null;

function revokePreview() {
	if (objectUrl != null) {
		URL.revokeObjectURL(objectUrl);
		objectUrl = null;
	}
}

function resetForm() {
	editingId.value = null;
	name.value = '';
	description.value = '';
	useColor.value = false;
	color.value = '#3b82f6';
	asBadge.value = false;
	isPersonal.value = false;
	revokePreview();
	previewUrl.value = null;
	pickedFile.value = null;
	iconRemoved.value = false;
}

function startEdit(role: Misskey.entities.Role) {
	resetForm();
	editingId.value = role.id;
	name.value = role.name;
	description.value = role.description;
	useColor.value = role.color != null;
	if (role.color != null) color.value = role.color;
	asBadge.value = role.asBadge;
	isPersonal.value = role.isPersonal;
	previewUrl.value = role.iconUrl;
	window.scrollTo({ top: 0, behavior: 'smooth' });
}

function pickFile() {
	fileInput.value?.click();
}

function onFileChange(ev: Event) {
	const input = ev.target as HTMLInputElement;
	const file = input.files?.[0];
	input.value = '';
	if (file == null) return;
	revokePreview();
	objectUrl = URL.createObjectURL(file);
	previewUrl.value = objectUrl;
	pickedFile.value = file;
	iconRemoved.value = false;
}

function clearIcon() {
	revokePreview();
	previewUrl.value = null;
	pickedFile.value = null;
	iconRemoved.value = true;
}

function hasRole(role: Misskey.entities.Role) {
	return $i != null && $i.roles.some(r => r.id === role.id);
}

async function load() {
	loading.value = true;
	try {
		roles.value = await misskeyApi('roles/user/list', {});
	} finally {
		loading.value = false;
	}
}

async function save() {
	if (saving.value) return;
	saving.value = true;
	let uploaded: Misskey.entities.DriveFile | null = null;
	try {
		// 画像はここで初めてドライブへアップロードする (容量不足ならここで失敗する)
		if (pickedFile.value != null) {
			try {
				uploaded = await uploadFile(pickedFile.value, { name: pickedFile.value.name }).filePromise;
			} catch {
				// uploadFile 側でエラーダイアログが表示される
				return;
			}
		}

		const common = {
			name: name.value.trim(),
			description: description.value,
			color: useColor.value ? color.value : null,
			asBadge: asBadge.value,
			isPersonal: isPersonal.value,
		};

		try {
			if (editingId.value == null) {
				await os.apiWithDialog('roles/user/create', {
					...common,
					iconFileId: uploaded?.id ?? null,
				});
			} else {
				await os.apiWithDialog('roles/user/update', {
					roleId: editingId.value,
					...common,
					...(uploaded != null ? { iconFileId: uploaded.id } : iconRemoved.value ? { iconFileId: null } : {}),
				});
			}
		} catch {
			// 失敗した場合はアップロード済みの画像を消す
			if (uploaded != null) {
				await misskeyApi('drive/files/delete', { fileId: uploaded.id }).catch(() => {});
			}
			return;
		}

		resetForm();
		await load();
	} finally {
		saving.value = false;
	}
}

async function remove(role: Misskey.entities.Role) {
	const { canceled } = await os.confirm({ type: 'warning', text: t.confirmDelete, caption: role.name });
	if (canceled) return;
	try {
		await os.apiWithDialog('roles/user/delete', { roleId: role.id });
	} catch {
		return;
	}
	if (editingId.value === role.id) resetForm();
	await load();
	await refreshCurrentAccount();
}

async function toggleAssign(role: Misskey.entities.Role) {
	await os.apiWithDialog('roles/user/assign', { roleId: role.id, assigned: !hasRole(role) }).catch(() => {});
	await refreshCurrentAccount();
}

onMounted(() => {
	if (instance.enableUserRoleEditor) load();
	else loading.value = false;
});

onBeforeUnmount(revokePreview);

definePage(() => ({
	title: t.title,
	icon: 'ti ti-badge',
}));
</script>

<style lang="scss" module>
.row {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
}

.colorInput {
	width: 48px;
	height: 32px;
	padding: 0;
	border: none;
	background: none;
}

.preview {
	width: 48px;
	height: 48px;
	object-fit: contain;
	border-radius: 6px;
}

.hint {
	font-size: 0.85em;
	opacity: 0.7;
}

.item {
	padding: 12px;
	border-radius: 8px;
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.itemHead {
	display: flex;
	align-items: center;
	gap: 8px;
}

.badge {
	font-size: 0.8em;
	padding: 2px 8px;
	border-radius: 99px;
	background: var(--MI_THEME-accentedBg);
	color: var(--MI_THEME-accent);
}
</style>
