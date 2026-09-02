/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// This must remain separate from the original recommended-timeline migration.
// That migration may already have been applied by an earlier test deployment.
export class AddRecommendedTimelineSettings1788364800000 {
	name = 'AddRecommendedTimelineSettings1788364800000';

	async up(queryRunner) {
		await queryRunner.query('ALTER TABLE "meta" ADD "recommendedTimelineSettings" jsonb NOT NULL DEFAULT \'{}\'');
	}

	async down(queryRunner) {
		await queryRunner.query('ALTER TABLE "meta" DROP COLUMN "recommendedTimelineSettings"');
	}
}
