/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddUserRoleEditor1791300000000 {
	name = 'AddUserRoleEditor1791300000000';

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "role" ADD "createdByUserId" character varying(32)`);
		await queryRunner.query(`COMMENT ON COLUMN "role"."createdByUserId" IS 'The ID of the user who created this role with the user role editor. NULL for roles created by administrators.'`);
		await queryRunner.query(`ALTER TABLE "role" ADD "isPersonal" boolean NOT NULL DEFAULT false`);
		await queryRunner.query(`ALTER TABLE "meta" ADD "enableUserRoleEditor" boolean NOT NULL DEFAULT false`);
		await queryRunner.query(`COMMENT ON COLUMN "meta"."enableUserRoleEditor" IS 'Whether users can create and manage their own cosmetic roles with the user role editor.'`);
		await queryRunner.query(`ALTER TABLE "meta" ADD "userRoleCreateLimit" integer NOT NULL DEFAULT 10`);
		await queryRunner.query(`COMMENT ON COLUMN "meta"."userRoleCreateLimit" IS 'The maximum number of roles one user can create with the user role editor.'`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "userRoleCreateLimit"`);
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "enableUserRoleEditor"`);
		await queryRunner.query(`ALTER TABLE "role" DROP COLUMN "isPersonal"`);
		await queryRunner.query(`ALTER TABLE "role" DROP COLUMN "createdByUserId"`);
	}
}
