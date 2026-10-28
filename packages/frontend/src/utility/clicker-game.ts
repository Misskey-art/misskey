/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ref, computed } from 'vue';
import { misskeyApi } from '@/utility/misskey-api.js';

type SaveData = {
	gameVersion: number;
	puddings: number;
	totalPuddings: number;
	totalHandmadePuddings: number;
	clicked: number;
	achievements: any[];
	facilities: any[];
};

export const saveData = ref<SaveData>();
export const ready = computed(() => saveData.value != null);

let prev = '';

// misskey.art独自: クッキーをプリンに改名した時に移行処理が無かったため、古いセーブデータの
// cookies系の値は読まれずに残り、puddings系はNaN(保存するとnull)から数え直しになっていた。
// 読み込み時に古い値をpuddings系へ足し込み、古いキーは消す
const legacyKeys = [
	['cookies', 'puddings'],
	['totalCookies', 'totalPuddings'],
	['totalHandmadeCookies', 'totalHandmadePuddings'],
] as const;

function toCount(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function createSaveData(): SaveData {
	return {
		gameVersion: 2,
		puddings: 0,
		totalPuddings: 0,
		totalHandmadePuddings: 0,
		clicked: 0,
		achievements: [],
		facilities: [],
	};
}

/**
 * 古いセーブデータをその場で書き換える。書き換えた場合はtrueを返す
 */
function migrate(data: Record<string, any>): boolean {
	let migrated = false;

	// gameVersion 1 は累計を持っていなかったため、所持数で埋める
	if (data.gameVersion === 1) {
		data.totalCookies ??= data.cookies;
		data.totalHandmadeCookies ??= data.cookies;
		data.achievements ??= [];
		data.facilities ??= [];
		data.gameVersion = 2;
		migrated = true;
	}

	for (const [legacyKey, key] of legacyKeys) {
		if (legacyKey in data || !Number.isFinite(data[key])) {
			data[key] = toCount(data[key]) + toCount(data[legacyKey]);
			delete data[legacyKey];
			migrated = true;
		}
	}

	return migrated;
}

export async function load() {
	let data: unknown;
	try {
		data = await misskeyApi('i/registry/get', {
			scope: ['clickerGame'],
			key: 'saveData',
		});
	} catch (err: any) {
		if (err.code === 'NO_SUCH_KEY') {
			saveData.value = createSaveData();
			save();
			return;
		}
		throw err;
	}

	if (data == null || typeof data !== 'object') {
		saveData.value = createSaveData();
		save();
		return;
	}

	const migrated = migrate(data);
	saveData.value = data as SaveData;
	// 古いキーが残ったまま別のタブなどから上書きされないよう、移行した内容はすぐ保存する
	if (migrated) save();
}

export async function save() {
	const current = JSON.stringify(saveData.value);
	if (current === prev) return;

	await misskeyApi('i/registry/set', {
		scope: ['clickerGame'],
		key: 'saveData',
		value: saveData.value,
	});

	prev = current;
}
