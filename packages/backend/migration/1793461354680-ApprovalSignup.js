/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class ApprovalSignup1793461354680 {
    name = 'ApprovalSignup1793461354680';

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" ADD "approved" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`COMMENT ON COLUMN "user"."approved" IS 'Whether the User is approved (used when approval-required signup is enabled).'`);
        await queryRunner.query(`ALTER TABLE "user" ADD "signupReason" text`);
        await queryRunner.query(`COMMENT ON COLUMN "user"."signupReason" IS 'The reason the User gave at signup, when approval-required signup was enabled. Moderator/admin only.'`);
        await queryRunner.query(`ALTER TABLE "user_pending" ADD "reason" text`);

        await queryRunner.query(`CREATE TABLE "signup_approval_check" ("id" character varying(32) NOT NULL, "code" character varying(64) NOT NULL, "userId" character varying(32), "status" character varying(16) NOT NULL DEFAULT 'pending', "reason" text, "username" character varying(128), "signupReason" text, "reviewerId" character varying(32), "reviewedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_85fa469d265c6c5aa5322e92468" PRIMARY KEY ("id"))`);
        await queryRunner.query(`COMMENT ON COLUMN "signup_approval_check"."code" IS 'The secret code given to the applicant to check their approval status.'`);
        await queryRunner.query(`COMMENT ON COLUMN "signup_approval_check"."status" IS 'The approval status of this signup application: pending, approved, or declined.'`);
        await queryRunner.query(`COMMENT ON COLUMN "signup_approval_check"."reason" IS 'The reason for declining this signup application, if declined.'`);
        await queryRunner.query(`COMMENT ON COLUMN "signup_approval_check"."username" IS 'A snapshot of the applicant username at the time of application, since the user row may be deleted later.'`);
        await queryRunner.query(`COMMENT ON COLUMN "signup_approval_check"."signupReason" IS 'A snapshot of the applicant-submitted signup reason at the time of application.'`);
        await queryRunner.query(`COMMENT ON COLUMN "signup_approval_check"."reviewerId" IS 'The ID of the moderator/admin who reviewed this signup application.'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f01a6db6a5912378d75c384bd2" ON "signup_approval_check" ("code") `);
        await queryRunner.query(`CREATE INDEX "IDX_a07a5d85770541ff7c5a465e01" ON "signup_approval_check" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_27c2546c121c042dab560255bb" ON "signup_approval_check" ("reviewerId") `);
        await queryRunner.query(`ALTER TABLE "signup_approval_check" ADD CONSTRAINT "FK_a07a5d85770541ff7c5a465e01b" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "signup_approval_check" ADD CONSTRAINT "FK_27c2546c121c042dab560255bb2" FOREIGN KEY ("reviewerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TABLE "meta" ADD "approvalRequiredForSignup" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "meta" ADD "signupReasonRequired" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "meta" ADD "signupReasonMaxLength" integer NOT NULL DEFAULT 4096`);
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "signupReasonMaxLength"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "signupReasonRequired"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "approvalRequiredForSignup"`);

        await queryRunner.query(`ALTER TABLE "signup_approval_check" DROP CONSTRAINT "FK_27c2546c121c042dab560255bb2"`);
        await queryRunner.query(`ALTER TABLE "signup_approval_check" DROP CONSTRAINT "FK_a07a5d85770541ff7c5a465e01b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_27c2546c121c042dab560255bb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a07a5d85770541ff7c5a465e01"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f01a6db6a5912378d75c384bd2"`);
        await queryRunner.query(`DROP TABLE "signup_approval_check"`);

        await queryRunner.query(`ALTER TABLE "user_pending" DROP COLUMN "reason"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "signupReason"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "approved"`);
    }
}
