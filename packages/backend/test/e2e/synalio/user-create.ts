/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { setTimeout } from 'node:timers/promises';
import { entities } from 'misskey-js';
import { afterEach, beforeEach, describe, test, beforeAll, afterAll, expect } from 'vitest';
import {
	api,
	captureWebhook,
	randomString,
	role,
	signup,
	startJobQueue,
	UserToken,
	WEBHOOK_HOST,
} from '../../utils.js';
import type { INestApplicationContext } from '@nestjs/common';

describe('[シナリオ] ユーザ作成', () => {
	let queue: INestApplicationContext;
	let admin: entities.SignupSuccessResponse;

	async function createSystemWebhook(args?: Partial<entities.AdminSystemWebhookCreateRequest>, credential?: UserToken): Promise<entities.AdminSystemWebhookCreateResponse> {
		const res = await api(
			'admin/system-webhook/create',
			{
				isActive: true,
				name: randomString(),
				on: ['userCreated'],
				url: WEBHOOK_HOST,
				secret: randomString(),
				...args,
			},
			credential ?? admin,
		);
		return res.body;
	}

	// -------------------------------------------------------------------------------------------

	beforeAll(async () => {
		queue = await startJobQueue();
		admin = await signup({ username: 'admin' });

		await role(admin, { isAdministrator: true });
	}, 1000 * 60 * 2);

	afterAll(async () => {
		await queue.close();
	});

	// -------------------------------------------------------------------------------------------

	describe('SystemWebhook', () => {
		beforeEach(async () => {
			const webhooks = await api('admin/system-webhook/list', {}, admin);
			for (const webhook of webhooks.body) {
				await api('admin/system-webhook/delete', { id: webhook.id }, admin);
			}
		});

		test('ユーザが作成された -> userCreatedが送出される', async () => {
			const webhook = await createSystemWebhook({
				on: ['userCreated'],
				isActive: true,
			});

			let alice: any = null;
			const webhookBody = await captureWebhook(async () => {
				alice = await signup({ username: 'alice' });
			});

			// webhookの送出後にいろいろやってるのでちょっと待つ必要がある
			await setTimeout(2000);

			console.log(alice);
			console.log(JSON.stringify(webhookBody, null, 2));

			expect(webhookBody.hookId).toBe(webhook.id);
			expect(webhookBody.type).toBe('userCreated');

			const body = webhookBody.body as entities.UserLite;
			expect(alice.id).toBe(body.id);
			expect(alice.name).toBe(body.name);
			expect(alice.username).toBe(body.username);
			expect(alice.host).toBe(body.host);
			expect(alice.avatarUrl).toBe(body.avatarUrl);
			expect(alice.avatarBlurhash).toBe(body.avatarBlurhash);
			expect(alice.avatarDecorations).toEqual(body.avatarDecorations);
			expect(alice.isBot).toBe(body.isBot);
			expect(alice.isCat).toBe(body.isCat);
			expect(alice.instance).toEqual(body.instance);
			expect(alice.emojis).toEqual(body.emojis);
			expect(alice.onlineStatus).toBe(body.onlineStatus);
			expect(alice.badgeRoles).toEqual(body.badgeRoles);
		});

		test('ユーザ作成 -> userCreatedが未許可の場合は送出されない', async () => {
			await createSystemWebhook({
				on: [],
				isActive: true,
			});

			let alice: any = null;
			const webhookBody = await captureWebhook(async () => {
				alice = await signup({ username: 'alice' });
			}).catch(e => e.message);

			expect(webhookBody).toBe('timeout');
			expect(alice.id).not.toBeNull();
		});

		test('ユーザ作成 -> Webhookが無効の場合は送出されない', async () => {
			await createSystemWebhook({
				on: ['userCreated'],
				isActive: false,
			});

			let alice: any = null;
			const webhookBody = await captureWebhook(async () => {
				alice = await signup({ username: 'alice' });
			}).catch(e => e.message);

			expect(webhookBody).toBe('timeout');
			expect(alice.id).not.toBeNull();
		});

		// misskey.art独自: 承認制の新規登録
		describe('承認制の新規登録がオンのとき', () => {
			beforeEach(async () => {
				await api('admin/update-meta', { approvalRequiredForSignup: true }, admin);
			});

			afterEach(async () => {
				await api('admin/update-meta', { approvalRequiredForSignup: false }, admin);
			});

			const apply = async (username: string, reason: string) => {
				const res = await api('signup', { username, password: 'test', reason });
				expect(res.status).toBe(200);
				expect((res.body as entities.SignupPendingApprovalResponse).pendingApproval).toBe(true);
			};

			test('申請 -> signupApplicationCreatedが、申請した人と理由を付けて送出される(確認コードは含まない)', async () => {
				const webhook = await createSystemWebhook({
					on: ['signupApplicationCreated'],
					isActive: true,
				});

				const username = randomString();
				const webhookBody = await captureWebhook(async () => {
					await apply(username, 'よろしくお願いします');
				});

				expect(webhookBody.hookId).toBe(webhook.id);
				expect(webhookBody.type).toBe('signupApplicationCreated');
				const body = webhookBody.body as { applicant: entities.UserLite; reason: string | null };
				expect(Object.keys(body).sort()).toEqual(['applicant', 'reason']);
				expect(body.applicant.username).toBe(username);
				expect(body.applicant.host).toBeNull();
				expect(body.reason).toBe('よろしくお願いします');
			});

			test('申請 -> userCreatedは送出されず、承認したときに送出される', async () => {
				await createSystemWebhook({
					on: ['userCreated'],
					isActive: true,
				});

				const username = randomString();
				const onApply = await captureWebhook(async () => {
					await apply(username, 'よろしくお願いします');
				}).catch(e => e.message);
				expect(onApply).toBe('timeout');

				const pending = await api('admin/signup-approvals/pending', { limit: 100 }, admin);
				const user = pending.body.find(u => u.username === username);
				expect(user).toBeDefined();

				const onApprove = await captureWebhook(async () => {
					const res = await api('admin/signup-approvals/approve', { userId: user!.id }, admin);
					expect(res.status).toBe(204);
				});
				expect(onApprove.type).toBe('userCreated');
				expect((onApprove.body as entities.UserLite).id).toBe(user!.id);
			});

			test('申請 -> signupApplicationCreatedが未許可の場合は送出されない', async () => {
				await createSystemWebhook({
					on: [],
					isActive: true,
				});

				const webhookBody = await captureWebhook(async () => {
					await apply(randomString(), 'よろしくお願いします');
				}).catch(e => e.message);

				expect(webhookBody).toBe('timeout');
			});
		});
	});
});
