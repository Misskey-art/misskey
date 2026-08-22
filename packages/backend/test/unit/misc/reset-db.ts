/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { resetDb } from '@/misc/reset-db.js';
import type { DataSource } from 'typeorm';

/**
 * `resetDb` は接続先DB名しか見ないので、クエリを実行しないダミーで十分。
 */
function fakeDataSource(database: unknown): DataSource {
	return {
		options: { database },
		query: async () => [],
	} as unknown as DataSource;
}

describe('resetDb', () => {
	test('テスト用DBならリセットできる', async () => {
		await expect(resetDb(fakeDataSource('test-misskey'))).resolves.toBeUndefined();
	});

	test('開発用DBはリセットを拒否する', async () => {
		await expect(resetDb(fakeDataSource('misskey'))).rejects.toThrow(/refusing to reset/);
	});

	test('DB名が未設定ならリセットを拒否する', async () => {
		await expect(resetDb(fakeDataSource(undefined))).rejects.toThrow(/refusing to reset/);
	});

	test('DB名がテスト用でなければリセットを拒否する', async () => {
		await expect(resetDb(fakeDataSource('production'))).rejects.toThrow(/refusing to reset/);
	});
});
