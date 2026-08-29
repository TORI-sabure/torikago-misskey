/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddDislikedEmojisToUserMemo1787932800000 {
	name = 'AddDislikedEmojisToUserMemo1787932800000';

	async up(queryRunner) {
		await queryRunner.query('ALTER TABLE "user_memo" ADD "dislikedEmojis" character varying array NOT NULL DEFAULT \'{}\'');
		await queryRunner.query('COMMENT ON COLUMN "user_memo"."dislikedEmojis" IS \'Personal list of emojis the author believes the target user dislikes.\'');
	}

	async down(queryRunner) {
		await queryRunner.query('ALTER TABLE "user_memo" DROP COLUMN "dislikedEmojis"');
	}
}
