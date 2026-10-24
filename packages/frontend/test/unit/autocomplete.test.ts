/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { assert, describe, test } from 'vitest';
import { searchCustomEmojiPrefix, searchEmoji } from '@/utility/search-emoji.js';

describe('emoji autocomplete', () => {
	test('名前の完全一致は名前の前方一致より優先される', async () => {
		const result = searchEmoji('foooo', [{ emoji: ':foooo:', name: 'foooo' }, { emoji: ':foooobaaar:', name: 'foooobaaar' }]);
		assert.equal(result[0].emoji, ':foooo:');
	});

	test('名前の前方一致は名前の部分一致より優先される', async () => {
		const result = searchEmoji('baaa', [{ emoji: ':baaar:', name: 'baaar' }, { emoji: ':foooobaaar:', name: 'foooobaaar' }]);
		assert.equal(result[0].emoji, ':baaar:');
	});

	test('名前の完全一致はタグの完全一致より優先される', async () => {
		const result = searchEmoji('foooo', [{ emoji: ':foooo:', name: 'foooo' }, { emoji: ':baaar:', name: 'foooo', aliasOf: 'baaar' }]);
		assert.equal(result[0].emoji, ':foooo:');
	});

	test('名前の前方一致はタグの前方一致より優先される', async () => {
		const result = searchEmoji('foo', [{ emoji: ':foooo:', name: 'foooo' }, { emoji: ':baaar:', name: 'foooo', aliasOf: 'baaar' }]);
		assert.equal(result[0].emoji, ':foooo:');
	});

	test('名前の部分一致はタグの部分一致より優先される', async () => {
		const result = searchEmoji('oooo', [{ emoji: ':foooo:', name: 'foooo' }, { emoji: ':baaar:', name: 'foooo', aliasOf: 'baaar' }]);
		assert.equal(result[0].emoji, ':foooo:');
	});
});

describe('emoji autocomplete without colon', () => {
	const c = (name: string, aliasOf?: string) => ({ emoji: `:${aliasOf ?? name}:`, name, aliasOf, isCustomEmoji: true as const });

	test('前方一致のみで、部分一致は出さない', () => {
		const result = searchCustomEmojiPrefix('neko', [c('neko'), c('nekomimi'), c('big_neko')]);
		assert.deepEqual(result.map(x => x.emoji), [':neko:', ':nekomimi:']);
	});

	test('タグ(エイリアス)の前方一致でも見つかり、名前の一致が優先される', () => {
		const result = searchCustomEmojiPrefix('cat', [c('cat_tag', 'neko'), c('catface')]);
		assert.equal(result[0].emoji, ':catface:');
		assert.equal(result[1].emoji, ':neko:');
	});

	test('同じ絵文字は名前とタグが両方当たっても1件だけ', () => {
		const result = searchCustomEmojiPrefix('ne', [c('neko'), c('nyan', 'neko'), c('ne_alias', 'neko')]);
		assert.equal(result.length, 1);
	});

	test('Unicode 絵文字は対象外', () => {
		const result = searchCustomEmojiPrefix('smile', [{ emoji: '😄', name: 'smile' }, c('smile_x')]);
		assert.deepEqual(result.map(x => x.emoji), [':smile_x:']);
	});

	test('大文字小文字は区別しない', () => {
		const result = searchCustomEmojiPrefix('Neko', [c('neko')]);
		assert.deepEqual(result.map(x => x.emoji), [':neko:']);
	});

	test('空の入力は候補なし', () => {
		assert.deepEqual(searchCustomEmojiPrefix('', [c('neko')]), []);
		assert.deepEqual(searchCustomEmojiPrefix(null, [c('neko')]), []);
	});
});
