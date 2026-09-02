/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddRecommendedTimelineAllowedUsers1788537600000 {
	name = 'AddRecommendedTimelineAllowedUsers1788537600000';

	async up(queryRunner) {
		await queryRunner.query('ALTER TABLE "meta" ADD "recommendedTimelineAllowedUserIds" character varying(32) array NOT NULL DEFAULT \'{}\'');
	}

	async down(queryRunner) {
		await queryRunner.query('ALTER TABLE "meta" DROP COLUMN "recommendedTimelineAllowedUserIds"');
	}
}
