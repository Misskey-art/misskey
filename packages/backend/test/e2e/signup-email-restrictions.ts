/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { api, castAsError, initTestDb, randomString, signup } from '../utils.js';
import type * as misskey from 'misskey-js';
import { MiUserPending, MiUserProfile } from '@/models/_.js';

// misskey.art独自: 登録に使えるメールアドレスの制限(+タグ・Gmailのドット)と、確認のリンクを開いたときの再確認、フォロー承認の既定値
describe('登録に使えるメールアドレスの制限', () => {
	let admin: misskey.entities.SignupSuccessResponse;

	beforeAll(async () => {
		admin = await signup({ username: 'admin' });
		// メールサーバーの実在確認(DNS)に頼らないよう、メールアドレスの検証は形式だけにする
		await api('admin/update-meta', { enableActiveEmailValidation: false }, admin);
	});

	afterEach(async () => {
		await api('admin/update-meta', {
			blockEmailDotAliasRegistration: false,
			blockEmailPlusAliasRegistration: false,
			emailRequiredForSignup: false,
			followApprovalDefaultLocalSeconds: 0,
			followApprovalDefaultRemoteSeconds: 0,
		}, admin);
	});

	test('設定は管理者だけが読み書きでき、既定はオフ', async () => {
		const meta = await api('admin/meta', {}, admin);
		assert.strictEqual(meta.status, 200);
		expect(meta.body).toMatchObject({
			disposableEmailBlocklistEnabled: false,
			disposableEmailAllowDomains: [],
			disposableEmailBlocklistCount: 0,
			disposableEmailBlocklistFetchedAt: null,
			blockEmailDotAliasRegistration: false,
			blockEmailPlusAliasRegistration: false,
			followApprovalDefaultLocalSeconds: 0,
			followApprovalDefaultRemoteSeconds: 0,
		});

		const user = await signup();
		const denied = await api('admin/update-meta', { blockEmailPlusAliasRegistration: true }, user);
		assert.strictEqual(denied.status, 403);
	});

	test('使い捨てと判定しないドメインは、小文字・重複なし・形の正しいものだけにして保存する', async () => {
		const res = await api('admin/update-meta', { disposableEmailAllowDomains: [' Example.com ', '@example.com', 'bad domain', 'sub.example.org'] }, admin);
		assert.strictEqual(res.status, 204);
		const meta = await api('admin/meta', {}, admin);
		assert.deepStrictEqual(meta.body.disposableEmailAllowDomains, ['example.com', 'sub.example.org']);
		await api('admin/update-meta', { disposableEmailAllowDomains: [] }, admin);
	});

	test('+タグを禁止すると、既存のアカウントが無くても+を含むアドレスは使えない', async () => {
		await api('admin/update-meta', { blockEmailPlusAliasRegistration: true }, admin);
		const plus = await api('email-address/available', { emailAddress: 'nobody-art+1@example.com' });
		assert.deepStrictEqual(plus.body, { available: false, reason: 'plusTag' });
		const plain = await api('email-address/available', { emailAddress: 'nobody-art@example.com' });
		assert.deepStrictEqual(plain.body, { available: true, reason: null });

		await api('admin/update-meta', { blockEmailPlusAliasRegistration: false }, admin);
		const off = await api('email-address/available', { emailAddress: 'nobody-art+1@example.com' });
		assert.deepStrictEqual(off.body, { available: true, reason: null });
	});

	test('Gmailのドットを禁止すると、.を含むGmailのアドレスは使えない(ほかのドメインは使える)', async () => {
		await api('admin/update-meta', { blockEmailDotAliasRegistration: true }, admin);
		for (const emailAddress of ['no.body.art@Gmail.com', 'no.body.art@googlemail.com']) {
			const res = await api('email-address/available', { emailAddress });
			assert.deepStrictEqual(res.body, { available: false, reason: 'gmailDot' });
		}
		for (const emailAddress of ['nobodyart@gmail.com', 'no.body.art@example.com']) {
			const res = await api('email-address/available', { emailAddress });
			assert.deepStrictEqual(res.body, { available: true, reason: null });
		}
	});

	test('+タグを禁止すると、確認済みのアカウントと+より前が同じアドレスは使用済みになる', async () => {
		const connection = await initTestDb(true);
		const profiles = connection.getRepository(MiUserProfile);
		const user = await signup();
		const local = `alias-${randomString()}`;
		await profiles.update({ userId: user.id }, { email: `${local}+old@example.com`, emailVerified: true });

		const before = await api('email-address/available', { emailAddress: `${local}@example.com` });
		assert.deepStrictEqual(before.body, { available: true, reason: null });

		await api('admin/update-meta', { blockEmailPlusAliasRegistration: true }, admin);
		const after = await api('email-address/available', { emailAddress: `${local.toUpperCase()}@example.com` });
		assert.deepStrictEqual(after.body, { available: false, reason: 'used' });
	});

	test('メールアドレスの変更では、別名の判定で本人の今のアドレスを使用済みとみなさない', async () => {
		const connection = await initTestDb(true);
		const profiles = connection.getRepository(MiUserProfile);
		const user = await signup({ password: 'test' });
		const local = `self-${randomString()}`;
		await profiles.update({ userId: user.id }, { email: `${local}+old@example.com`, emailVerified: true });
		await api('admin/update-meta', { blockEmailPlusAliasRegistration: true }, admin);

		const res = await api('i/update-email', { password: 'test', email: `${local}@example.com` }, user);
		assert.strictEqual(res.status, 200);
		const profile = await profiles.findOneByOrFail({ userId: user.id });
		assert.strictEqual(profile.email, `${local}@example.com`);
		assert.strictEqual(profile.emailVerified, false);
	});

	test('Gmailのドットを禁止すると、.を除くと同じになる確認済みのアドレスは使用済みになる', async () => {
		const connection = await initTestDb(true);
		const profiles = connection.getRepository(MiUserProfile);
		const user = await signup();
		const local = `dot${randomString()}`;
		await profiles.update({ userId: user.id }, { email: `${local.slice(0, 4)}.${local.slice(4)}@gmail.com`, emailVerified: true });

		await api('admin/update-meta', { blockEmailDotAliasRegistration: true }, admin);
		const res = await api('email-address/available', { emailAddress: `${local}@gmail.com` });
		assert.deepStrictEqual(res.body, { available: false, reason: 'used' });
		// Gmail以外のドメインでは、.を別の文字として扱う
		await profiles.update({ userId: user.id }, { email: `${local.slice(0, 4)}.${local.slice(4)}@example.com` });
		const other = await api('email-address/available', { emailAddress: `${local}@example.com` });
		assert.deepStrictEqual(other.body, { available: true, reason: null });
	});

	describe('確認のリンクを開いたとき', () => {
		test('メールアドレスの変更: 受付の後に、同じアドレスがほかのアカウントで確認済みになっていたら確認済みにしない', async () => {
			const connection = await initTestDb(true);
			const profiles = connection.getRepository(MiUserProfile);
			const first = await signup();
			const second = await signup();
			const email = `dup-verify-${randomString()}@example.com`;
			const code = randomString();
			await profiles.update({ userId: first.id }, { email, emailVerified: true });
			await profiles.update({ userId: second.id }, { email, emailVerified: false, emailVerifyCode: code });

			const res = await api('verify-email', { code });
			assert.strictEqual(res.status, 400);
			assert.strictEqual(castAsError(res.body as any).error.code, 'EMAIL_ALREADY_USED');
			assert.strictEqual((await profiles.findOneByOrFail({ userId: second.id })).emailVerified, false);
		});

		test('メールアドレスの変更: 受付の後に+タグを禁止したら確認済みにしない', async () => {
			const connection = await initTestDb(true);
			const profiles = connection.getRepository(MiUserProfile);
			const user = await signup();
			const code = randomString();
			await profiles.update({ userId: user.id }, { email: `plus-verify-${randomString()}+1@example.com`, emailVerified: false, emailVerifyCode: code });
			await api('admin/update-meta', { blockEmailPlusAliasRegistration: true }, admin);

			const res = await api('verify-email', { code });
			assert.strictEqual(res.status, 400);
			assert.strictEqual(castAsError(res.body as any).error.code, 'UNAVAILABLE_EMAIL');
		});

		test('メールアドレスの変更: 問題が無ければ確認済みになる', async () => {
			const connection = await initTestDb(true);
			const profiles = connection.getRepository(MiUserProfile);
			const user = await signup();
			const code = randomString();
			await profiles.update({ userId: user.id }, { email: `ok-verify-${randomString()}@example.com`, emailVerified: false, emailVerifyCode: code });

			const res = await api('verify-email', { code });
			assert.strictEqual(res.status, 204);
			assert.strictEqual((await profiles.findOneByOrFail({ userId: user.id })).emailVerified, true);
		});

		test('新規登録: 同じアドレスで受け付けた登録は、先に確認した方だけがアカウントになる', async () => {
			const connection = await initTestDb(true);
			const pendings = connection.getRepository(MiUserPending);
			const email = `dup-signup-${randomString()}@example.com`;
			const usernames = [randomString(), randomString()];
			await api('admin/update-meta', { emailRequiredForSignup: true }, admin);

			for (const username of usernames) {
				const res = await api('signup', { username, password: 'test', emailAddress: email });
				assert.strictEqual(res.status, 204);
			}
			const codes = await Promise.all(usernames.map(async username => (await pendings.findOneByOrFail({ username })).code));

			const first = await api('signup-pending', { code: codes[0] });
			assert.strictEqual(first.status, 200);
			const second = await api('signup-pending', { code: codes[1] });
			assert.strictEqual(second.status, 400);
			assert.match(JSON.stringify(second.body), /USED_EMAIL/);
			// 断った登録は残さない
			assert.strictEqual(await pendings.countBy({ username: usernames[1] }), 0);
		});

		test('新規登録: 受付の後に+タグを禁止したら、アカウントを作らない', async () => {
			const connection = await initTestDb(true);
			const pendings = connection.getRepository(MiUserPending);
			const username = randomString();
			await api('admin/update-meta', { emailRequiredForSignup: true }, admin);

			const res = await api('signup', { username, password: 'test', emailAddress: `plus-signup-${randomString()}+1@example.com` });
			assert.strictEqual(res.status, 204);
			const { code } = await pendings.findOneByOrFail({ username });

			await api('admin/update-meta', { blockEmailPlusAliasRegistration: true }, admin);
			const confirmed = await api('signup-pending', { code });
			assert.strictEqual(confirmed.status, 400);
			assert.match(JSON.stringify(confirmed.body), /UNAVAILABLE_EMAIL/);
			assert.strictEqual(await pendings.countBy({ username }), 0);
		});
	});

	describe('フォロー承認の期間の既定値', () => {
		test('「既定値を使う」の人は、管理者が決めた期間の間、新しいアカウントからのフォローが承認制になる', async () => {
			await api('admin/update-meta', { followApprovalDefaultLocalSeconds: 3600 }, admin);
			const meta = await api('meta', {});
			expect(meta.body).toMatchObject({ followApprovalDefaultLocalSeconds: 3600, followApprovalDefaultRemoteSeconds: 0 });

			const receiver = await signup();
			const follower = await signup();
			expect((await api('following/create', { userId: receiver.id }, follower)).status).toBe(200);
			const pending = await api('users/show', { userId: receiver.id }, follower);
			expect(pending.body).toMatchObject({ isFollowing: false, hasPendingFollowRequestFromYou: true });
		});

		test('自分で「無効」にしている人には、既定値を使わない', async () => {
			await api('admin/update-meta', { followApprovalDefaultLocalSeconds: 3600 }, admin);
			const receiver = await signup();
			const follower = await signup();
			await api('i/update', { followApprovalLocalSeconds: 0 }, receiver);
			await api('following/create', { userId: receiver.id }, follower);
			const result = await api('users/show', { userId: receiver.id }, follower);
			expect(result.body).toMatchObject({ isFollowing: true, hasPendingFollowRequestFromYou: false });
		});

		test('上限(30日)を超える既定値は保存できない', async () => {
			const res = await api('admin/update-meta', { followApprovalDefaultLocalSeconds: 30 * 86400 + 1 }, admin);
			assert.strictEqual(res.status, 400);
		});
	});
});
