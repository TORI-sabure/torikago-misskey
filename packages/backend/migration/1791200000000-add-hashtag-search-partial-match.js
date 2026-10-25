/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddHashtagSearchPartialMatch1791200000000 {
	name = 'AddHashtagSearchPartialMatch1791200000000';

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" ADD "hashtagSearchPartialMatch" boolean NOT NULL DEFAULT false`);
		await queryRunner.query(`COMMENT ON COLUMN "meta"."hashtagSearchPartialMatch" IS 'Whether hashtag search matches anywhere in the tag name instead of only at its start.'`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "hashtagSearchPartialMatch"`);
	}
}
