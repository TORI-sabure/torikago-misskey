/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddSensitiveByModeratorToDriveFile1787327522966 {
    name = 'AddSensitiveByModeratorToDriveFile1787327522966'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "drive_file" ADD "isSensitiveByModerator" boolean NOT NULL DEFAULT false`)
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "drive_file" DROP COLUMN "isSensitiveByModerator"`)
    }
}
