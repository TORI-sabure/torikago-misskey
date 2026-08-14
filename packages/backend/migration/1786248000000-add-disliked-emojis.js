/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddDislikedEmojis1786248000000 {
	name = 'AddDislikedEmojis1786248000000';

	async up(queryRunner) {
		await queryRunner.query('ALTER TABLE "user_profile" ADD "dislikedEmojis" character varying array NOT NULL DEFAULT \'{}\'');
	}

	async down(queryRunner) {
		await queryRunner.query('ALTER TABLE "user_profile" DROP COLUMN "dislikedEmojis"');
	}
}
