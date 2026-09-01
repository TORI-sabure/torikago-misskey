<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 32px;">
		<SearchMarker path="/admin/moderation" :label="i18n.ts.moderation" :keywords="['moderation']" icon="ti ti-shield" :inlining="['serverRules']">
			<div class="_gaps_m">
				<SearchMarker :keywords="['recommended', 'timeline', 'おすすめ', 'タイムライン']">
					<MkSwitch v-model="enableRecommendedTimeline" @change="onChange_enableRecommendedTimeline">
						<template #label><SearchLabel>{{ recommendedTimelineAdminText.label }}</SearchLabel></template>
						<template #caption><SearchText>{{ recommendedTimelineAdminText.caption }}</SearchText></template>
					</MkSwitch>
					<MkSwitch v-model="collectRecommendedTimelineNotes" style="margin-top: 12px;" @change="onChange_collectRecommendedTimelineNotes">
						<template #label><SearchLabel>{{ recommendedTimelineAdminText.collectLabel }}</SearchLabel></template>
						<template #caption><SearchText>{{ recommendedTimelineAdminText.collectCaption }}</SearchText></template>
					</MkSwitch>
					<MkFolder v-if="enableRecommendedTimeline || collectRecommendedTimelineNotes" style="margin-top: 12px;">
						<template #label>{{ recommendedTimelineAdminText.forcedWords }}</template>
						<div class="_gaps_s">
							<MkTextarea v-model="recommendedTimelineForcedWords">
								<template #caption>{{ recommendedTimelineAdminText.forcedWordsCaption }}</template>
							</MkTextarea>
							<MkButton primary @click="save_recommendedTimelineForcedWords">{{ i18n.ts.save }}</MkButton>
						</div>
					</MkFolder>
					<MkFolder v-if="enableRecommendedTimeline || collectRecommendedTimelineNotes" style="margin-top: 12px;">
						<template #label>{{ recommendedTimelineAdminText.advanced }}</template>
						<div class="_gaps_s">
							<div class="_gaps_s">
								<MkInput v-model.number="recommendedSettings.candidatePoolLimit" type="number"><template #label>{{ recommendedTimelineAdminText.candidatePoolLimit }}</template></MkInput>
								<MkInput v-model.number="recommendedSettings.candidateScanLimit" type="number"><template #label>{{ recommendedTimelineAdminText.candidateScanLimit }}</template></MkInput>
								<MkInput v-model.number="recommendedSettings.snapshotHours" type="number"><template #label>{{ recommendedTimelineAdminText.snapshotHours }}</template></MkInput>
								<MkInput v-model.number="recommendedSettings.maxNotesPerAuthor" type="number"><template #label>{{ recommendedTimelineAdminText.maxNotesPerAuthor }}</template></MkInput>
							</div>
							<div class="_gaps_s">
								<MkInput v-model.number="recommendedSettings.twoHopPercent" type="number"><template #label>{{ recommendedTimelineAdminText.twoHopPercent }}</template></MkInput>
								<MkInput v-model.number="recommendedSettings.followingPercent" type="number"><template #label>{{ recommendedTimelineAdminText.followingPercent }}</template></MkInput>
								<MkInput v-model.number="recommendedSettings.unknownPercent" type="number"><template #label>{{ recommendedTimelineAdminText.unknownPercent }}</template></MkInput>
							</div>
							<div class="_gaps_s">
								<MkInput v-model.number="recommendedSettings.qualityPercent" type="number"><template #label>{{ recommendedTimelineAdminText.qualityPercent }}</template></MkInput>
								<MkInput v-model.number="recommendedSettings.balancedPercent" type="number"><template #label>{{ recommendedTimelineAdminText.balancedPercent }}</template></MkInput>
								<MkInput v-model.number="recommendedSettings.freshPercent" type="number"><template #label>{{ recommendedTimelineAdminText.freshPercent }}</template></MkInput>
								<MkInput v-model.number="recommendedSettings.forcedLimit" type="number"><template #label>{{ recommendedTimelineAdminText.forcedLimit }}</template></MkInput>
							</div>
							<div class="_gaps_s">
								<MkInput v-model.number="recommendedSettings.publicBonus" type="number"><template #label>{{ recommendedTimelineAdminText.publicBonus }}</template></MkInput>
								<MkInput v-model.number="recommendedSettings.twoHopRenoteBonus" type="number"><template #label>{{ recommendedTimelineAdminText.twoHopRenoteBonus }}</template></MkInput>
								<MkInput v-model.number="recommendedSettings.sensitivePenalty" type="number"><template #label>{{ recommendedTimelineAdminText.sensitivePenalty }}</template></MkInput>
								<MkInput v-model.number="recommendedSettings.negativePenalty" type="number"><template #label>{{ recommendedTimelineAdminText.negativePenalty }}</template></MkInput>
							</div>
							<MkTextarea v-model="recommendedForcedAccounts"><template #label>{{ recommendedTimelineAdminText.forcedAccounts }}</template><template #caption>{{ recommendedTimelineAdminText.accountCaption }}</template></MkTextarea>
							<MkTextarea v-model="recommendedNegativeWords"><template #label>{{ recommendedTimelineAdminText.negativeWords }}</template></MkTextarea>
							<MkTextarea v-model="recommendedNegativeAccounts"><template #label>{{ recommendedTimelineAdminText.negativeAccounts }}</template><template #caption>{{ recommendedTimelineAdminText.accountCaption }}</template></MkTextarea>
							<MkButton primary @click="save_recommendedSettings">{{ i18n.ts.save }}</MkButton>
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker :keywords="['open', 'registration']">
					<MkSwitch :modelValue="enableRegistration" @update:modelValue="onChange_enableRegistration">
						<template #label><SearchLabel>{{ i18n.ts._serverSettings.openRegistration }}</SearchLabel></template>
						<template #caption>
							<div><SearchText>{{ i18n.ts._serverSettings.thisSettingWillAutomaticallyOffWhenModeratorsInactive }}</SearchText></div>
							<div><i class="ti ti-alert-triangle" style="color: var(--MI_THEME-warn);"></i> <SearchText>{{ i18n.ts._serverSettings.openRegistrationWarning }}</SearchText></div>
						</template>
					</MkSwitch>
				</SearchMarker>

				<SearchMarker :keywords="['email', 'required', 'signup']">
					<MkSwitch v-model="emailRequiredForSignup" @change="onChange_emailRequiredForSignup">
						<template #label><SearchLabel>{{ i18n.ts.emailRequiredForSignup }}</SearchLabel> ({{ i18n.ts.recommended }})</template>
					</MkSwitch>
				</SearchMarker>

				<SearchMarker :keywords="['ugc', 'content', 'visibility', 'visitor', 'guest']">
					<MkSelect v-model="ugcVisibilityForVisitor" :items="ugcVisibilityForVisitorDef" @update:modelValue="onChange_ugcVisibilityForVisitor">
						<template #label><SearchLabel>{{ i18n.ts._serverSettings.userGeneratedContentsVisibilityForVisitor }}</SearchLabel></template>
						<template #caption>
							<div><SearchText>{{ i18n.ts._serverSettings.userGeneratedContentsVisibilityForVisitor_description }}</SearchText></div>
							<div><i class="ti ti-alert-triangle" style="color: var(--MI_THEME-warn);"></i> <SearchText>{{ i18n.ts._serverSettings.userGeneratedContentsVisibilityForVisitor_description2 }}</SearchText></div>
						</template>
					</MkSelect>
				</SearchMarker>

				<XServerRules/>

				<SearchMarker :keywords="['preserved', 'usernames']">
					<MkFolder>
						<template #icon><SearchIcon><i class="ti ti-lock-star"></i></SearchIcon></template>
						<template #label><SearchLabel>{{ i18n.ts.preservedUsernames }}</SearchLabel></template>

						<div class="_gaps">
							<MkTextarea v-model="preservedUsernames">
								<template #caption>{{ i18n.ts.preservedUsernamesDescription }}</template>
							</MkTextarea>
							<MkButton primary @click="save_preservedUsernames">{{ i18n.ts.save }}</MkButton>
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker :keywords="['sensitive', 'words']">
					<MkFolder>
						<template #icon><SearchIcon><i class="ti ti-message-exclamation"></i></SearchIcon></template>
						<template #label><SearchLabel>{{ i18n.ts.sensitiveWords }}</SearchLabel></template>

						<div class="_gaps">
							<MkTextarea v-model="sensitiveWords">
								<template #caption>{{ i18n.ts.sensitiveWordsDescription }}<br>{{ i18n.ts.sensitiveWordsDescription2 }}</template>
							</MkTextarea>
							<MkButton primary @click="save_sensitiveWords">{{ i18n.ts.save }}</MkButton>
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker :keywords="['prohibited', 'words']">
					<MkFolder>
						<template #icon><SearchIcon><i class="ti ti-message-x"></i></SearchIcon></template>
						<template #label><SearchLabel>{{ i18n.ts.prohibitedWords }}</SearchLabel></template>

						<div class="_gaps">
							<MkTextarea v-model="prohibitedWords">
								<template #caption>{{ i18n.ts.prohibitedWordsDescription }}<br>{{ i18n.ts.prohibitedWordsDescription2 }}</template>
							</MkTextarea>
							<MkButton primary @click="save_prohibitedWords">{{ i18n.ts.save }}</MkButton>
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker :keywords="['prohibited', 'name', 'user']">
					<MkFolder>
						<template #icon><SearchIcon><i class="ti ti-user-x"></i></SearchIcon></template>
						<template #label><SearchLabel>{{ i18n.ts.prohibitedWordsForNameOfUser }}</SearchLabel></template>

						<div class="_gaps">
							<MkTextarea v-model="prohibitedWordsForNameOfUser">
								<template #caption>{{ i18n.ts.prohibitedWordsForNameOfUserDescription }}<br>{{ i18n.ts.prohibitedWordsDescription2 }}</template>
							</MkTextarea>
							<MkButton primary @click="save_prohibitedWordsForNameOfUser">{{ i18n.ts.save }}</MkButton>
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker :keywords="['hidden', 'tags', 'hashtags']">
					<MkFolder>
						<template #icon><SearchIcon><i class="ti ti-eye-off"></i></SearchIcon></template>
						<template #label><SearchLabel>{{ i18n.ts.hiddenTags }}</SearchLabel></template>

						<div class="_gaps">
							<MkTextarea v-model="hiddenTags">
								<template #caption>{{ i18n.ts.hiddenTagsDescription }}</template>
							</MkTextarea>
							<MkButton primary @click="save_hiddenTags">{{ i18n.ts.save }}</MkButton>
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker :keywords="['silenced', 'servers', 'hosts']">
					<MkFolder>
						<template #icon><SearchIcon><i class="ti ti-eye-off"></i></SearchIcon></template>
						<template #label><SearchLabel>{{ i18n.ts.silencedInstances }}</SearchLabel></template>

						<div class="_gaps">
							<MkTextarea v-model="silencedHosts">
								<template #caption>{{ i18n.ts.silencedInstancesDescription }}</template>
							</MkTextarea>
							<MkButton primary @click="save_silencedHosts">{{ i18n.ts.save }}</MkButton>
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker :keywords="['media', 'silenced', 'servers', 'hosts']">
					<MkFolder>
						<template #icon><SearchIcon><i class="ti ti-eye-off"></i></SearchIcon></template>
						<template #label><SearchLabel>{{ i18n.ts.mediaSilencedInstances }}</SearchLabel></template>

						<div class="_gaps">
							<MkTextarea v-model="mediaSilencedHosts">
								<template #caption>{{ i18n.ts.mediaSilencedInstancesDescription }}</template>
							</MkTextarea>
							<MkButton primary @click="save_mediaSilencedHosts">{{ i18n.ts.save }}</MkButton>
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker :keywords="['blocked', 'servers', 'hosts']">
					<MkFolder>
						<template #icon><SearchIcon><i class="ti ti-ban"></i></SearchIcon></template>
						<template #label><SearchLabel>{{ i18n.ts.blockedInstances }}</SearchLabel></template>

						<div class="_gaps">
							<MkTextarea v-model="blockedHosts">
								<template #caption>{{ i18n.ts.blockedInstancesDescription }}</template>
							</MkTextarea>
							<MkButton primary @click="save_blockedHosts">{{ i18n.ts.save }}</MkButton>
						</div>
					</MkFolder>
				</SearchMarker>
			</div>
		</SearchMarker>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import * as Misskey from 'misskey-js';
import XServerRules from './server-rules.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkInput from '@/components/MkInput.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { fetchInstance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { useMkSelect } from '@/composables/use-mkselect.js';
import MkButton from '@/components/MkButton.vue';
import FormLink from '@/components/form/link.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkSelect from '@/components/MkSelect.vue';

const meta = await misskeyApi('admin/meta');

const enableRegistration = ref(!meta.disableRegistration);
const emailRequiredForSignup = ref(meta.emailRequiredForSignup);
const {
	model: ugcVisibilityForVisitor,
	def: ugcVisibilityForVisitorDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts._serverSettings._userGeneratedContentsVisibilityForVisitor.all, value: 'all' },
		{ label: i18n.ts._serverSettings._userGeneratedContentsVisibilityForVisitor.localOnly, value: 'local' },
		{ label: i18n.ts._serverSettings._userGeneratedContentsVisibilityForVisitor.none, value: 'none' },
	],
	initialValue: meta.ugcVisibilityForVisitor,
});
const sensitiveWords = ref(meta.sensitiveWords.join('\n'));
const prohibitedWords = ref(meta.prohibitedWords.join('\n'));
const prohibitedWordsForNameOfUser = ref(meta.prohibitedWordsForNameOfUser.join('\n'));
const hiddenTags = ref(meta.hiddenTags.join('\n'));
const preservedUsernames = ref(meta.preservedUsernames.join('\n'));
const blockedHosts = ref(meta.blockedHosts.join('\n'));
const silencedHosts = ref(meta.silencedHosts?.join('\n') ?? '');
const mediaSilencedHosts = ref(meta.mediaSilencedHosts.join('\n'));
const enableRecommendedTimeline = ref((meta as typeof meta & { enableRecommendedTimeline?: boolean }).enableRecommendedTimeline ?? false);
const collectRecommendedTimelineNotes = ref((meta as typeof meta & { collectRecommendedTimelineNotes?: boolean }).collectRecommendedTimelineNotes ?? false);
const recommendedTimelineForcedWords = ref(((meta as typeof meta & { recommendedTimelineForcedWords?: string[] }).recommendedTimelineForcedWords ?? []).join('\n'));
const recommendedRawSettings = (meta as typeof meta & { recommendedTimelineSettings?: Record<string, unknown> }).recommendedTimelineSettings ?? {};
const recommendedSettings = ref({
	candidatePoolLimit: typeof recommendedRawSettings.candidatePoolLimit === 'number' ? recommendedRawSettings.candidatePoolLimit : 3000,
	candidateScanLimit: typeof recommendedRawSettings.candidateScanLimit === 'number' ? recommendedRawSettings.candidateScanLimit : 300,
	snapshotHours: typeof recommendedRawSettings.snapshotHours === 'number' ? recommendedRawSettings.snapshotHours : 24,
	maxNotesPerAuthor: typeof recommendedRawSettings.maxNotesPerAuthor === 'number' ? recommendedRawSettings.maxNotesPerAuthor : 2,
	twoHopPercent: typeof recommendedRawSettings.twoHopPercent === 'number' ? recommendedRawSettings.twoHopPercent : 60,
	followingPercent: typeof recommendedRawSettings.followingPercent === 'number' ? recommendedRawSettings.followingPercent : 20,
	unknownPercent: typeof recommendedRawSettings.unknownPercent === 'number' ? recommendedRawSettings.unknownPercent : 20,
	qualityPercent: typeof recommendedRawSettings.qualityPercent === 'number' ? recommendedRawSettings.qualityPercent : 50,
	balancedPercent: typeof recommendedRawSettings.balancedPercent === 'number' ? recommendedRawSettings.balancedPercent : 30,
	freshPercent: typeof recommendedRawSettings.freshPercent === 'number' ? recommendedRawSettings.freshPercent : 20,
	forcedLimit: typeof recommendedRawSettings.forcedLimit === 'number' ? recommendedRawSettings.forcedLimit : 3,
	publicBonus: typeof recommendedRawSettings.publicBonus === 'number' ? recommendedRawSettings.publicBonus : 2,
	twoHopRenoteBonus: typeof recommendedRawSettings.twoHopRenoteBonus === 'number' ? recommendedRawSettings.twoHopRenoteBonus : 6,
	sensitivePenalty: typeof recommendedRawSettings.sensitivePenalty === 'number' ? recommendedRawSettings.sensitivePenalty : 6,
	negativePenalty: typeof recommendedRawSettings.negativePenalty === 'number' ? recommendedRawSettings.negativePenalty : 8,
});
const recommendedForcedAccounts = ref(Array.isArray(recommendedRawSettings.forcedAccounts) ? recommendedRawSettings.forcedAccounts.join('\n') : '');
const recommendedNegativeWords = ref(Array.isArray(recommendedRawSettings.negativeWords) ? recommendedRawSettings.negativeWords.join('\n') : '');
const recommendedNegativeAccounts = ref(Array.isArray(recommendedRawSettings.negativeAccounts) ? recommendedRawSettings.negativeAccounts.join('\n') : '');
type RecommendedAdminText = { label: string; caption: string; collectLabel: string; collectCaption: string; forcedWords: string; forcedWordsCaption: string; advanced: string; candidatePoolLimit: string; candidateScanLimit: string; snapshotHours: string; maxNotesPerAuthor: string; twoHopPercent: string; followingPercent: string; unknownPercent: string; qualityPercent: string; balancedPercent: string; freshPercent: string; forcedLimit: string; publicBonus: string; twoHopRenoteBonus: string; sensitivePenalty: string; negativePenalty: string; forcedAccounts: string; negativeWords: string; negativeAccounts: string; accountCaption: string };
const recommendedAdminDefaultText: RecommendedAdminText = {
	label: 'Enable recommended timeline', caption: 'Controls whether users can open the recommended timeline.', collectLabel: 'Collect notes for recommendations', collectCaption: 'Collects candidates while the timeline is hidden.', forcedWords: 'Always-recommend words', forcedWordsCaption: 'One plain-text word per line. Visibility, mute, and block rules are never bypassed.', advanced: 'Recommendation settings', candidatePoolLimit: 'Candidate pool size', candidateScanLimit: 'Candidates checked per generation', snapshotHours: 'Snapshot retention (hours)', maxNotesPerAuthor: 'Maximum notes per author', twoHopPercent: 'Two-hop accounts (%)', followingPercent: 'Followed accounts (%)', unknownPercent: 'Unrelated accounts (%)', qualityPercent: 'High-quality slots (%)', balancedPercent: 'Balanced slots (%)', freshPercent: 'Fresh slots (%)', forcedLimit: 'Maximum forced slots', publicBonus: 'Public note bonus', twoHopRenoteBonus: 'Two-hop public renote bonus', sensitivePenalty: 'Sensitive file penalty', negativePenalty: 'Negative rule penalty', forcedAccounts: 'Always-recommend accounts', negativeWords: 'Negative words', negativeAccounts: 'Negative accounts', accountCaption: 'One account per line: @username or @username@server.example.',
};
const recommendedTimelineAdminTexts: Record<string, Partial<RecommendedAdminText>> = {
	'en-US': { label: 'Enable recommended timeline', caption: 'Controls whether users can open the recommended timeline.', collectLabel: 'Collect notes for recommendations', collectCaption: 'Collects candidates even while the timeline is hidden, so it can be prepared before launch. Public notes and home notes with hashtags are eligible.', forcedWords: 'Always-recommend words', forcedWordsCaption: 'One plain-text word per line. Visibility, mute, and block rules are never bypassed.' },
	'ja-JP': { label: 'おすすめタイムラインを有効にする', caption: 'ユーザーがおすすめタイムラインを開けるかどうかを設定します。', collectLabel: 'おすすめ用のノートを収集する', collectCaption: 'タイムラインを非公開にしたまま候補を収集し、公開前に準備できます。パブリックのノートと、ハッシュタグ付きのホーム公開ノートが対象です。', forcedWords: '必ずおすすめに含めるワード', forcedWordsCaption: '1行に1つ、通常の文字列として指定します。公開範囲・ミュート・ブロックは常に優先されます。' },
	'ja-KS': { label: 'おすすめタイムラインを有効にする', caption: 'みんながおすすめタイムラインを開けるかどうか決めるで。', collectLabel: 'おすすめ用のノートを集める', collectCaption: 'タイムラインをまだ見せんと候補だけ集めて、公開前に準備できるで。パブリックのノートと、ハッシュタグ付きのホーム公開ノートが対象や。', forcedWords: '必ずおすすめに入れる言葉', forcedWordsCaption: '1行に1つずつ書いてな。公開範囲・ミュート・ブロックはいつでも優先やで。' },
	'ko-KR': { label: '추천 타임라인 활성화', caption: '사용자가 추천 타임라인을 열 수 있는지 설정합니다.', collectLabel: '추천용 노트 수집', collectCaption: '타임라인을 숨긴 상태에서도 후보를 수집하여 공개 전에 준비할 수 있습니다. 공개 노트와 해시태그가 있는 홈 노트가 대상입니다.', forcedWords: '항상 추천에 포함할 단어', forcedWordsCaption: '한 줄에 일반 텍스트 하나를 입력하세요. 공개 범위, 뮤트 및 차단 규칙은 항상 우선합니다.' },
	'zh-CN': { label: '启用推荐时间线', caption: '设置用户是否可以打开推荐时间线。', collectLabel: '收集推荐候选笔记', collectCaption: '即使时间线尚未公开也会收集候选，以便提前准备。公开笔记和带有话题标签的首页笔记会被收集。', forcedWords: '始终推荐的词语', forcedWordsCaption: '每行输入一个纯文本词语。可见范围、静音和屏蔽规则始终优先。' },
	'zh-TW': { label: '啟用推薦時間軸', caption: '設定使用者是否可以開啟推薦時間軸。', collectLabel: '收集推薦候選貼文', collectCaption: '即使時間軸尚未公開也會收集候選，以便事先準備。公開貼文及帶有主題標籤的首頁貼文會被收集。', forcedWords: '一律推薦的詞語', forcedWordsCaption: '每行輸入一個純文字詞語。可見範圍、靜音與封鎖規則永遠優先。' },
};
Object.assign(recommendedTimelineAdminTexts['ja-JP']!, { advanced: 'おすすめタイムラインの詳細設定', candidatePoolLimit: '候補ノートの保存件数（全体）', candidateScanLimit: '1回に調査する候補数', snapshotHours: '結果スナップショットの保持時間（時間）', maxNotesPerAuthor: '同じ投稿者の最大表示数', twoHopPercent: '二段階フォロー圏の割合（%）', followingPercent: 'フォロー中アカウントの割合（%）', unknownPercent: '関係のないアカウントの割合（%）', qualityPercent: '高スコア投稿の割合（%）', balancedPercent: 'バランス投稿の割合（%）', freshPercent: '新しめの投稿の割合（%）', forcedLimit: '強制表示の最大件数', publicBonus: 'パブリック投稿の加点', twoHopRenoteBonus: '二段階フォロー圏のリノート加点', sensitivePenalty: 'センシティブファイルの減点', negativePenalty: '減点ルールの減点量', forcedAccounts: '強制表示アカウント', negativeWords: '減点対象ワード', negativeAccounts: '減点対象アカウント', accountCaption: '1行に1アカウント。@username または @username@server.example 形式で指定します。' });
Object.assign(recommendedTimelineAdminTexts['ja-KS']!, { advanced: 'おすすめタイムラインの細かい設定', candidatePoolLimit: '候補ノートの保存件数（全体）', candidateScanLimit: '1回に調べる候補数', snapshotHours: '結果の保持時間（時間）', maxNotesPerAuthor: '同じ投稿者を出す最大数', twoHopPercent: '二段階フォロー圏の割合（%）', followingPercent: 'フォロー中アカウントの割合（%）', unknownPercent: '関係ないアカウントの割合（%）', publicBonus: 'パブリック投稿の加点', twoHopRenoteBonus: '二段階フォロー圏のリノート加点', sensitivePenalty: 'センシティブファイルの減点', negativePenalty: '減点ルールの減点量', forcedAccounts: '強制表示アカウント', negativeWords: '減点対象ワード', negativeAccounts: '減点対象アカウント', accountCaption: '1行に1アカウント。@username か @username@server.example で書いてな。' });
const recommendedTimelineAdminText: RecommendedAdminText = { ...recommendedAdminDefaultText, ...(recommendedTimelineAdminTexts[window.document.documentElement.lang] ?? {}) };

async function onChange_enableRegistration(value: boolean) {
	if (value) {
		const { canceled } = await os.confirm({
			type: 'warning',
			text: i18n.ts.acknowledgeNotesAndEnable,
		});
		if (canceled) return;
	}

	enableRegistration.value = value;

	os.apiWithDialog('admin/update-meta', {
		disableRegistration: !value,
	}).then(() => {
		fetchInstance(true);
	});
}

function onChange_emailRequiredForSignup(value: boolean) {
	os.apiWithDialog('admin/update-meta', {
		emailRequiredForSignup: value,
	}).then(() => {
		fetchInstance(true);
	});
}

function onChange_enableRecommendedTimeline(value: boolean) {
	os.apiWithDialog('admin/update-meta', {
		enableRecommendedTimeline: value,
	} as never).then(() => {
		fetchInstance(true);
	});
}

function onChange_collectRecommendedTimelineNotes(value: boolean) {
	os.apiWithDialog('admin/update-meta', {
		collectRecommendedTimelineNotes: value,
	} as never).then(() => {
		fetchInstance(true);
	});
}

function save_recommendedTimelineForcedWords() {
	os.apiWithDialog('admin/update-meta', {
		recommendedTimelineForcedWords: recommendedTimelineForcedWords.value.split('\n').map(word => word.trim()).filter(Boolean),
	} as never).then(() => fetchInstance(true));
}

function save_recommendedSettings() {
	const percentages = recommendedSettings.value.twoHopPercent + recommendedSettings.value.followingPercent + recommendedSettings.value.unknownPercent;
	if (percentages !== 100) {
		os.alert({ type: 'error', text: '二段階フォロー圏・フォロー中・関係のないアカウントの割合は、合計100%にしてください。' });
		return;
	}
	const displayPercentages = recommendedSettings.value.qualityPercent + recommendedSettings.value.balancedPercent + recommendedSettings.value.freshPercent;
	if (displayPercentages !== 100) {
		os.alert({ type: 'error', text: '高スコア・バランス・新しめの投稿の割合は、合計100%にしてください。' });
		return;
	}
	os.apiWithDialog('admin/update-meta', {
		recommendedTimelineSettings: {
			...recommendedSettings.value,
			forcedAccounts: recommendedForcedAccounts.value.split('\n').map(value => value.trim()).filter(Boolean),
			negativeWords: recommendedNegativeWords.value.split('\n').map(value => value.trim()).filter(Boolean),
			negativeAccounts: recommendedNegativeAccounts.value.split('\n').map(value => value.trim()).filter(Boolean),
		},
	} as never).then(() => fetchInstance(true));
}

function onChange_ugcVisibilityForVisitor(value: typeof ugcVisibilityForVisitor.value) {
	os.apiWithDialog('admin/update-meta', {
		ugcVisibilityForVisitor: value,
	}).then(() => {
		fetchInstance(true);
	});
}

function save_preservedUsernames() {
	os.apiWithDialog('admin/update-meta', {
		preservedUsernames: preservedUsernames.value.split('\n'),
	}).then(() => {
		fetchInstance(true);
	});
}

function save_sensitiveWords() {
	os.apiWithDialog('admin/update-meta', {
		sensitiveWords: sensitiveWords.value.split('\n'),
	}).then(() => {
		fetchInstance(true);
	});
}

function save_prohibitedWords() {
	os.apiWithDialog('admin/update-meta', {
		prohibitedWords: prohibitedWords.value.split('\n'),
	}).then(() => {
		fetchInstance(true);
	});
}

function save_prohibitedWordsForNameOfUser() {
	os.apiWithDialog('admin/update-meta', {
		prohibitedWordsForNameOfUser: prohibitedWordsForNameOfUser.value.split('\n'),
	}).then(() => {
		fetchInstance(true);
	});
}

function save_hiddenTags() {
	os.apiWithDialog('admin/update-meta', {
		hiddenTags: hiddenTags.value.split('\n'),
	}).then(() => {
		fetchInstance(true);
	});
}

function save_blockedHosts() {
	os.apiWithDialog('admin/update-meta', {
		blockedHosts: blockedHosts.value.split('\n') || [],
	}).then(() => {
		fetchInstance(true);
	});
}

function save_silencedHosts() {
	os.apiWithDialog('admin/update-meta', {
		silencedHosts: silencedHosts.value.split('\n') || [],
	}).then(() => {
		fetchInstance(true);
	});
}

function save_mediaSilencedHosts() {
	os.apiWithDialog('admin/update-meta', {
		mediaSilencedHosts: mediaSilencedHosts.value.split('\n') || [],
	}).then(() => {
		fetchInstance(true);
	});
}

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.moderation,
	icon: 'ti ti-shield',
}));
</script>
