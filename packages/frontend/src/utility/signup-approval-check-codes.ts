/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { miLocalStorage } from '@/local-storage.js';

// misskey.art独自: 承認制の新規登録で発行された確認コードを、この端末に覚えておく。
// 1つの端末から複数のアカウントを申請することもあるため、配列で持つ(新しいものが先頭)
const STORAGE_KEY = 'signupApprovalCheckCodes';
const MAX_CODES = 20;

export function getSignupApprovalCheckCodes(): string[] {
	const codes = miLocalStorage.getItemAsJson(STORAGE_KEY);
	return Array.isArray(codes) ? codes.filter((x): x is string => typeof x === 'string') : [];
}

export function addSignupApprovalCheckCode(code: string): void {
	const codes = getSignupApprovalCheckCodes().filter(x => x !== code);
	codes.unshift(code);
	miLocalStorage.setItemAsJson(STORAGE_KEY, codes.slice(0, MAX_CODES));
}

export function removeSignupApprovalCheckCode(code: string): void {
	const codes = getSignupApprovalCheckCodes().filter(x => x !== code);
	miLocalStorage.setItemAsJson(STORAGE_KEY, codes);
}
