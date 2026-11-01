/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import SignupCheckStatusEndpoint from '@/server/api/endpoints/signup-check-status.js';
import { markSignupCheckCodeSeen } from '@/misc/signup-check-seen.js';
import type { CaptchaService } from '@/core/CaptchaService.js';
import type { MiMeta, SignupApprovalChecksRepository } from '@/models/_.js';
import type * as Redis from 'ioredis';

// misskey.art独自: テストの環境(NODE_ENV=test)ではCaptchaService.verifyRequestCaptchaが常に素通りするため、
// e2eではcaptchaが要るかどうかを確かめられない。ここでは偽物に差し替えて、どの確認でcaptchaが要るかを見る
// (misskey-juiceのテストから移植した)
describe('signup-check-status endpoint', () => {
	let store: Map<string, string>;
	let redisClient: Redis.Redis;
	let captchaService: { verifyRequestCaptcha: ReturnType<typeof vi.fn> };
	let endpoint: SignupCheckStatusEndpoint;

	beforeEach(() => {
		store = new Map();
		redisClient = {
			set: vi.fn(async (key: string, value: string) => {
				store.set(key, value);
				return 'OK';
			}),
			expire: vi.fn(async (key: string) => (store.has(key) ? 1 : 0)),
		} as unknown as Redis.Redis;
		// captchaの答えが無ければ失敗する(captchaを有効にしているサーバーのつもり)
		captchaService = {
			verifyRequestCaptcha: vi.fn(async (_meta: MiMeta, response: { testcaptcha?: string | null }) => {
				if (response.testcaptcha !== 'testcaptcha-passed') throw new Error('testcaptcha-failed');
			}),
		};
		const repository = {
			findOneBy: vi.fn(async ({ code }: { code: string }) => (code === 'known-code' ? { status: 'pending', reason: null } : null)),
		} as unknown as SignupApprovalChecksRepository;
		endpoint = new SignupCheckStatusEndpoint({} as MiMeta, repository, redisClient, captchaService as unknown as CaptchaService);
	});

	test('登録のときに記録したコードは、captchaなしで確かめられる', async () => {
		await markSignupCheckCodeSeen(redisClient, 'known-code');

		await expect(endpoint.exec({ code: 'known-code' }, null, null)).resolves.toEqual({ status: 'pending', reason: null });
		expect(captchaService.verifyRequestCaptcha).not.toHaveBeenCalled();
	});

	test('記録の無いコードは、isNewSubmissionを省いてもcaptchaが要る', async () => {
		await expect(endpoint.exec({ code: 'unknown-code' }, null, null)).rejects.toMatchObject({ code: 'CAPTCHA_FAILED' });
	});

	test('captchaを通ったコードは記録され、2回目からはcaptchaなしで確かめられる', async () => {
		await expect(endpoint.exec({ code: 'known-code', isNewSubmission: true, 'testcaptcha-response': 'testcaptcha-passed' }, null, null))
			.resolves.toEqual({ status: 'pending', reason: null });

		await expect(endpoint.exec({ code: 'known-code' }, null, null)).resolves.toEqual({ status: 'pending', reason: null });
		expect(captchaService.verifyRequestCaptcha).toHaveBeenCalledTimes(1);
	});

	test('isNewSubmissionなら、記録があってもcaptchaが要る', async () => {
		await markSignupCheckCodeSeen(redisClient, 'known-code');

		await expect(endpoint.exec({ code: 'known-code', isNewSubmission: true }, null, null)).rejects.toMatchObject({ code: 'CAPTCHA_FAILED' });
	});
});
