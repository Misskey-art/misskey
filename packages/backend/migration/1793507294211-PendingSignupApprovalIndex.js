/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// misskey.art独自: 承認を待つアカウントの一覧(admin/signup-approvals/pending)のためのインデックス。
// 作るときにuserの表を一度だけ全部読むため、MISSKEY_MIGRATION_CREATE_INDEX_CONCURRENTLY=1のときは
// CONCURRENTLYで作り、その間もuserへの書き込みを止めない(1780059833698-NoteIdIndexForPinAndFavoriteと同じ)
const isConcurrentIndexMigrationEnabled = process.env.MISSKEY_MIGRATION_CREATE_INDEX_CONCURRENTLY === '1';

const INDEX_NAME = 'IDX_user_pending_approval';

export class PendingSignupApprovalIndex1793507294211 {
	name = 'PendingSignupApprovalIndex1793507294211';
	transaction = isConcurrentIndexMigrationEnabled ? false : undefined;

	async up(queryRunner) {
		if (isConcurrentIndexMigrationEnabled) {
			// CONCURRENTLYで作るのに失敗すると、使えない(indisvalidがfalseの)インデックスが残るので、作り直す
			const hasValidIndex = await queryRunner.query(`SELECT indisvalid FROM pg_index INNER JOIN pg_class ON pg_index.indexrelid = pg_class.oid WHERE pg_class.relname = '${INDEX_NAME}'`);
			if (hasValidIndex.length === 0 || hasValidIndex[0].indisvalid !== true) {
				await queryRunner.query(`DROP INDEX IF EXISTS "${INDEX_NAME}"`);
				await queryRunner.query(`CREATE INDEX CONCURRENTLY "${INDEX_NAME}" ON "user" ("id") WHERE "approved" = false AND "host" IS NULL`);
			}
		} else {
			await queryRunner.query(`CREATE INDEX IF NOT EXISTS "${INDEX_NAME}" ON "user" ("id") WHERE "approved" = false AND "host" IS NULL`);
		}
	}

	async down(queryRunner) {
		const concurrently = isConcurrentIndexMigrationEnabled ? 'CONCURRENTLY' : '';
		await queryRunner.query(`DROP INDEX ${concurrently} IF EXISTS "public"."${INDEX_NAME}"`);
	}
}
