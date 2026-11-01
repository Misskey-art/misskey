/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class SignupEmailProtections1793458995009 {
    name = 'SignupEmailProtections1793458995009';

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" ADD "disposableEmailBlocklistEnabled" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "meta" ADD "disposableEmailAllowDomains" character varying(1024) array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "meta" ADD "blockEmailDotAliasRegistration" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "meta" ADD "blockEmailPlusAliasRegistration" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "meta" ADD "followApprovalDefaultLocalSeconds" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "meta" ADD "followApprovalDefaultRemoteSeconds" integer NOT NULL DEFAULT 0`);
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "followApprovalDefaultRemoteSeconds"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "followApprovalDefaultLocalSeconds"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "blockEmailPlusAliasRegistration"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "blockEmailDotAliasRegistration"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "disposableEmailAllowDomains"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "disposableEmailBlocklistEnabled"`);
    }
}
