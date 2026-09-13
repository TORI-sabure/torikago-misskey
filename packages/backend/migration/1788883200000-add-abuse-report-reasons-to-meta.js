/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddAbuseReportReasonsToMeta1788883200000 {
	name = 'AddAbuseReportReasonsToMeta1788883200000';

	async up(queryRunner) {
		await queryRunner.query('ALTER TABLE "meta" ADD "abuseReportReasons" character varying(512) array NOT NULL DEFAULT \'{}\'');
	}

	async down(queryRunner) {
		await queryRunner.query('ALTER TABLE "meta" DROP COLUMN "abuseReportReasons"');
	}
}
