/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createHash } from 'node:crypto';
import type * as Redis from 'ioredis';

// misskey.art独自: 承認制の新規登録の確認コード(signup-check-status)のうち、captchaなしで確かめ直してよい
// 「一度見たコード」の記録。キーはコードそのものではなくハッシュにする。misskey-juiceの同じ機能から移植した
const SEEN_TTL_SECONDS = 60 * 60 * 24 * 30;

function seenKey(code: string): string {
	return `signup-check:seen:${createHash('sha256').update(code).digest('hex')}`;
}

export async function markSignupCheckCodeSeen(redisClient: Redis.Redis, code: string): Promise<void> {
	await redisClient.set(seenKey(code), '1', 'EX', SEEN_TTL_SECONDS);
}

/** 記録があれば期限を延ばして true を返す */
export async function touchSignupCheckCodeSeen(redisClient: Redis.Redis, code: string): Promise<boolean> {
	return await redisClient.expire(seenKey(code), SEEN_TTL_SECONDS) === 1;
}
