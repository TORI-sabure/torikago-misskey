/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddReducedRecommendationsToUserMemo1789000000000 {
	name = 'AddReducedRecommendationsToUserMemo1789000000000';

	async up(queryRunner) {
		await queryRunner.query('ALTER TABLE "user_memo" ADD "reduceRecommendations" boolean NOT NULL DEFAULT false');
		await queryRunner.query('COMMENT ON COLUMN "user_memo"."reduceRecommendations" IS \'Whether the author wants this account shown less often in recommendations.\'');
	}

	async down(queryRunner) {
		await queryRunner.query('ALTER TABLE "user_memo" DROP COLUMN "reduceRecommendations"');
	}
}
