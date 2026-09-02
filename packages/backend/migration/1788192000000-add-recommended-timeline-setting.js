/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddRecommendedTimelineSetting1788192000000 {
	name = 'AddRecommendedTimelineSetting1788192000000';

	async up(queryRunner) {
		await queryRunner.query('ALTER TABLE "meta" ADD "enableRecommendedTimeline" boolean NOT NULL DEFAULT false');
		await queryRunner.query('ALTER TABLE "meta" ADD "collectRecommendedTimelineNotes" boolean NOT NULL DEFAULT false');
		await queryRunner.query('ALTER TABLE "meta" ADD "recommendedTimelineForcedWords" character varying(64) array NOT NULL DEFAULT \'{}\'');
	}

	async down(queryRunner) {
		await queryRunner.query('ALTER TABLE "meta" DROP COLUMN "recommendedTimelineForcedWords"');
		await queryRunner.query('ALTER TABLE "meta" DROP COLUMN "collectRecommendedTimelineNotes"');
		await queryRunner.query('ALTER TABLE "meta" DROP COLUMN "enableRecommendedTimeline"');
	}
}
