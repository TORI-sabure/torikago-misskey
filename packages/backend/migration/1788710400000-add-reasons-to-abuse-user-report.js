/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddReasonsToAbuseUserReport1788710400000 {
	name = 'AddReasonsToAbuseUserReport1788710400000';

	async up(queryRunner) {
		await queryRunner.query('ALTER TABLE "abuse_user_report" ADD "reasons" character varying array NOT NULL DEFAULT \'{}\'');
	}

	async down(queryRunner) {
		await queryRunner.query('ALTER TABLE "abuse_user_report" DROP COLUMN "reasons"');
	}
}
