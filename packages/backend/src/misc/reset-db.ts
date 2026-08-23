/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { DataSource } from 'typeorm';

/**
 * 開発用DBを誤って消さないためのガード。
 *
 * `built/.config.json` は NODE_ENV によって default.yml / test.yml のどちらからでも
 * 生成されるため、環境変数だけを信用すると設定と実際の接続先がズレたときに
 * 開発用DBを削除してしまう。実際の接続先DB名を検証しておく。
 */
function assertTestDatabase(db: DataSource) {
	const database = db.options.database;

	if (typeof database !== 'string' || !database.includes('test')) {
		throw new Error(`resetDb: refusing to reset a database that does not look like a test database (database=${String(database)}). Check built/.config.json — it may have been generated from default.yml.`);
	}
}

export async function resetDb(db: DataSource) {
	assertTestDatabase(db);

	const reset = async () => {
		const tables = await db.query(`SELECT relname AS "table"
		FROM pg_class C LEFT JOIN pg_namespace N ON (N.oid = C.relnamespace)
		WHERE nspname NOT IN ('pg_catalog', 'information_schema')
			AND C.relkind = 'r'
			AND nspname !~ '^pg_toast';`);
		for (const table of tables) {
			await db.query(`DELETE FROM "${table.table}" CASCADE`);
		}
	};

	for (let i = 1; i <= 3; i++) {
		try {
			await reset();
		} catch (e) {
			if (i === 3) {
				throw e;
			} else {
				await new Promise(resolve => setTimeout(resolve, 1000));
				continue;
			}
		}
		break;
	}
}
