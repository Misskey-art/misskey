/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { api, castAsError, host, initTestDb, origin, randomString, relativeFetch, role, signup, successfulApiCall } from '../utils.js';
import type { UserToken } from '../utils.js';
import type * as misskey from 'misskey-js';
import type { DataSource } from 'typeorm';
import { MiSignupApprovalCheck, MiUser, MiUserPending } from '@/models/_.js';

type PendingSignup = misskey.entities.AdminSignupApprovalsPendingResponse[number];

// misskey.art独自: 承認制の新規登録(misskey-juiceの同じ機能から移植した)
describe('承認制の新規登録', () => {
	let db: DataSource;
	let admin: misskey.entities.SignupSuccessResponse;
	let bob: misskey.entities.SignupSuccessResponse;

	/** 承認を待つ申請をして、確認コードを返す */
	const apply = async (username: string, reason = 'よろしくお願いします') => {
		const res = await api('signup', { username, password: 'test', reason });
		assert.strictEqual(res.status, 200);
		const body = res.body as misskey.entities.SignupPendingApprovalResponse;
		assert.strictEqual(body.pendingApproval, true);
		return body.checkCode;
	};

	/** 承認を待つ申請の一覧から、そのユーザー名の申請を探す */
	const findPending = async (username: string, user: UserToken = admin): Promise<PendingSignup | undefined> => {
		const list = await api('admin/signup-approvals/pending', { limit: 100 }, user);
		assert.strictEqual(list.status, 200);
		return list.body.find(u => u.username === username);
	};

	beforeAll(async () => {
		db = await initTestDb(true);
		admin = await signup({ username: 'admin' });
		bob = await signup({ username: 'bob' });
		// メールサーバーの実在確認(DNS)に頼らないよう、メールアドレスの検証は形式だけにする
		// ActivityPub・webfingerでの見え方も確かめるため、連合を有効にする
		await api('admin/update-meta', { enableActiveEmailValidation: false, federation: 'all' }, admin);
	});

	afterEach(async () => {
		await api('admin/update-meta', {
			approvalRequiredForSignup: false,
			signupReasonRequired: true,
			signupReasonMaxLength: 4096,
			emailRequiredForSignup: false,
		}, admin);
	});

	test('設定は既定でオフで、管理画面とmetaから読める', async () => {
		const adminMeta = await api('admin/meta', {}, admin);
		expect(adminMeta.body).toMatchObject({
			approvalRequiredForSignup: false,
			signupReasonRequired: true,
			signupReasonMaxLength: 4096,
		});
		const meta = await api('meta', {});
		expect(meta.body).toMatchObject({
			approvalRequiredForSignup: false,
			signupReasonRequired: true,
			signupReasonMaxLength: 4096,
		});

		const denied = await api('admin/update-meta', { approvalRequiredForSignup: true }, bob);
		assert.strictEqual(denied.status, 403);
	});

	test('オフのときは、理由を書いても今までどおりすぐ使えるアカウントになる', async () => {
		const res = await api('signup', { username: randomString(), password: 'test', reason: 'unused' });
		assert.strictEqual(res.status, 200);
		assert.strictEqual(typeof (res.body as misskey.entities.SignupSuccessResponse).token, 'string');
	});

	describe('有効なとき', () => {
		beforeEach(async () => {
			const res = await api('admin/update-meta', { approvalRequiredForSignup: true }, admin);
			assert.strictEqual(res.status, 204);
		});

		test('理由なしでは登録できない', async () => {
			const res = await api('signup', { username: randomString(), password: 'test' });
			assert.strictEqual(res.status, 400);
			assert.match(JSON.stringify(res.body), /REASON_REQUIRED/);

			const blank = await api('signup', { username: randomString(), password: 'test', reason: '  ' });
			assert.strictEqual(blank.status, 400);
			assert.match(JSON.stringify(blank.body), /REASON_REQUIRED/);
		});

		test('理由が長すぎると登録できない', async () => {
			await api('admin/update-meta', { signupReasonMaxLength: 10 }, admin);
			const res = await api('signup', { username: randomString(), password: 'test', reason: 'a'.repeat(11) });
			assert.strictEqual(res.status, 400);
			assert.match(JSON.stringify(res.body), /REASON_TOO_LONG/);

			await apply(randomString(), 'a'.repeat(10));
		});

		test('理由を必須にしていなければ、理由なしでも申請できる', async () => {
			await api('admin/update-meta', { signupReasonRequired: false }, admin);
			const res = await api('signup', { username: randomString(), password: 'test' });
			assert.strictEqual(res.status, 200);
			assert.strictEqual((res.body as misskey.entities.SignupPendingApprovalResponse).pendingApproval, true);
		});

		test('理由ありなら承認を待つアカウントが作られ、トークンは返らない', async () => {
			const username = randomString();
			const res = await api('signup', { username, password: 'test', reason: 'よろしくお願いします' });
			assert.strictEqual(res.status, 200);
			assert.deepStrictEqual(Object.keys(res.body as object).sort(), ['checkCode', 'pendingApproval']);
			assert.strictEqual(typeof (res.body as misskey.entities.SignupPendingApprovalResponse).checkCode, 'string');

			const user = await db.getRepository(MiUser).findOneOrFail({ where: { usernameLower: username.toLowerCase() }, select: { id: true, approved: true, signupReason: true } });
			assert.strictEqual(user.approved, false);
			assert.strictEqual(user.signupReason, 'よろしくお願いします');
		});

		test('承認を待つアカウントは、パスワードが合っているときだけ承認待ちのエラーになる', async () => {
			const username = randomString();
			await apply(username);

			const res = await api('signin-flow', { username, password: 'test' });
			assert.strictEqual(res.status, 403);
			assert.strictEqual(castAsError(res.body as any).error.id, '9f2f084b-af33-4f06-93cf-8a7fe04c6786');

			const wrong = await api('signin-flow', { username, password: 'wrong' });
			assert.strictEqual(wrong.status, 403);
			assert.strictEqual(castAsError(wrong.body as any).error.id, '932c904e-9460-45b7-9ce6-7ed33be7eb2c');
		});

		test('承認を待つアカウントのトークンでは、APIを使えない', async () => {
			const username = randomString();
			await apply(username);
			const user = await db.getRepository(MiUser).findOneByOrFail({ usernameLower: username.toLowerCase() });

			const res = await api('i', {}, { token: user.token! });
			assert.strictEqual(res.status, 403);
			assert.strictEqual(castAsError(res.body as any).error.code, 'YOUR_ACCOUNT_NOT_APPROVED');
			assert.strictEqual(castAsError(res.body as any).error.id, '3c25f403-6ed7-4b14-ba24-be9bb72a29e4');
		});

		test('すでにいる(承認済みの)アカウントは、今までどおりサインインできる', async () => {
			const res = await api('signin-flow', { username: 'bob', password: 'test' });
			assert.strictEqual(res.status, 200);
		});

		test('モデレーターでなければ、一覧の取得・承認・却下・履歴の取得ができない', async () => {
			const username = randomString();
			await apply(username);
			const target = await findPending(username);
			assert.ok(target);

			const list = await api('admin/signup-approvals/pending', {}, bob);
			assert.strictEqual(list.status, 403);
			assert.strictEqual(castAsError(list.body as any).error.code, 'ROLE_PERMISSION_DENIED');

			const approveRes = await api('admin/signup-approvals/approve', { userId: target.id }, bob);
			assert.strictEqual(approveRes.status, 403);
			assert.strictEqual(castAsError(approveRes.body as any).error.code, 'ROLE_PERMISSION_DENIED');

			const declineRes = await api('admin/signup-approvals/decline', { userId: target.id, reason: 'test decline reason' }, bob);
			assert.strictEqual(declineRes.status, 403);
			assert.strictEqual(castAsError(declineRes.body as any).error.code, 'ROLE_PERMISSION_DENIED');

			const history = await api('admin/signup-approvals/history', {}, bob);
			assert.strictEqual(history.status, 403);
			assert.strictEqual(castAsError(history.body as any).error.code, 'ROLE_PERMISSION_DENIED');
		});

		test('モデレーターでなくても、ロールでcanApproveSignupsを持っていれば、一覧の取得と承認ができる', async () => {
			// 承認制が有効なので、承認する人のアカウントも審査を通して作る(signup()は承認待ちの応答を扱わない)
			const approverUsername = randomString();
			await apply(approverUsername, 'approver setup');
			const approverPending = await findPending(approverUsername);
			assert.ok(approverPending);
			await successfulApiCall({ endpoint: 'admin/signup-approvals/approve', parameters: { userId: approverPending.id }, user: admin });
			const approverSignin = await api('signin-flow', { username: approverUsername, password: 'test' });
			assert.strictEqual(approverSignin.status, 200);
			const approverSigninBody = approverSignin.body as unknown as { id: string, i: string };
			const approver = { id: approverSigninBody.id, token: approverSigninBody.i };
			const approverToken: UserToken = { token: approver.token };

			const approverRole = await role(admin, { isModerator: false, name: 'Signup Approver Role' }, {
				canApproveSignups: { priority: 0, useDefault: false, value: true },
			});
			await api('admin/roles/assign', { userId: approver.id, roleId: approverRole.id }, admin);

			const username = randomString();
			await apply(username);
			const target = await findPending(username, approverToken);
			assert.ok(target);

			const approveRes = await api('admin/signup-approvals/approve', { userId: target.id }, approverToken);
			assert.strictEqual(approveRes.status, 204);
		});

		test('承認すると、一覧に理由が出ていて、承認の後はサインインでき、モデレーションログに残る', async () => {
			const username = randomString();
			await apply(username, '審査してください');

			const target = await findPending(username);
			assert.ok(target);
			assert.strictEqual(target.signupReason, '審査してください');
			assert.strictEqual(target.host, null);

			const approveRes = await api('admin/signup-approvals/approve', { userId: target.id }, admin);
			assert.strictEqual(approveRes.status, 204);
			assert.strictEqual(await findPending(username), undefined);

			const signinRes = await api('signin-flow', { username, password: 'test' });
			assert.strictEqual(signinRes.status, 200);

			const logs = await api('admin/show-moderation-logs', { type: 'approveSignup' }, admin);
			assert.strictEqual(logs.status, 200);
			expect(logs.body.find(log => (log.info as { userId?: string }).userId === target.id)).toMatchObject({
				type: 'approveSignup',
				info: { userId: target.id, userUsername: username, userHost: null },
			});
		});

		test('承認済み・存在しないアカウントは、承認・却下できない', async () => {
			const approved = await api('admin/signup-approvals/approve', { userId: bob.id }, admin);
			assert.strictEqual(approved.status, 400);
			assert.strictEqual(castAsError(approved.body as any).error.code, 'ALREADY_APPROVED');

			const declined = await api('admin/signup-approvals/decline', { userId: bob.id, reason: 'no' }, admin);
			assert.strictEqual(declined.status, 400);
			assert.strictEqual(castAsError(declined.body as any).error.code, 'ALREADY_APPROVED');

			const missing = await api('admin/signup-approvals/approve', { userId: 'aaaaaaaaaa' }, admin);
			assert.strictEqual(missing.status, 404);
			assert.strictEqual(castAsError(missing.body as any).error.code, 'NO_SUCH_USER');

			const missingDecline = await api('admin/signup-approvals/decline', { userId: 'aaaaaaaaaa', reason: 'no' }, admin);
			assert.strictEqual(missingDecline.status, 404);
			assert.strictEqual(castAsError(missingDecline.body as any).error.code, 'NO_SUCH_USER');
		});

		test('却下するとアカウントが消え、サインインできず、モデレーションログに理由が残る', async () => {
			const username = randomString();
			await apply(username);
			const target = await findPending(username);
			assert.ok(target);

			const declineRes = await api('admin/signup-approvals/decline', { userId: target.id, reason: 'test decline reason' }, admin);
			assert.strictEqual(declineRes.status, 204);

			// 却下は承認前のアカウントをその場で消すので、サインインは「承認待ち」(403)ではなく「いない」(404)になる
			const signinRes = await api('signin-flow', { username, password: 'test' });
			assert.strictEqual(signinRes.status, 404);
			assert.strictEqual(await db.getRepository(MiUser).countBy({ id: target.id }), 0);

			const logs = await api('admin/show-moderation-logs', { type: 'declineSignup' }, admin);
			expect(logs.body.find(log => (log.info as { userId?: string }).userId === target.id)).toMatchObject({
				type: 'declineSignup',
				info: { userId: target.id, userUsername: username, userHost: null, reason: 'test decline reason' },
			});
		});

		test('却下されたユーザー名で、もう一度申請できる', async () => {
			const username = randomString();
			await apply(username);
			const target = await findPending(username);
			assert.ok(target);

			const declineRes = await api('admin/signup-approvals/decline', { userId: target.id, reason: 'test decline reason' }, admin);
			assert.strictEqual(declineRes.status, 204);

			// 一度も承認されていないので、普通のアカウントの削除と違い、used_usernameに残らない
			await apply(username, 'test again');
		});

		test('承認と却下を同時に送っても、片方しか成功しない(承認したアカウントを誤って消さない)', async () => {
			const username = randomString();
			await apply(username);
			const target = await findPending(username);
			assert.ok(target);

			const [approveRes, declineRes] = await Promise.all([
				api('admin/signup-approvals/approve', { userId: target.id }, admin),
				api('admin/signup-approvals/decline', { userId: target.id, reason: '却下理由' }, admin),
			]);

			const statuses = [approveRes.status, declineRes.status];
			assert.strictEqual(statuses.filter(status => status === 204).length, 1, '承認・却下を同時に送っても、成功するのはちょうど1件のはず');

			// 承認が勝ったならユーザーが残ってapproved: trueで、却下はALREADY_APPROVED。
			// 却下が勝ったならユーザーごと消えていて、承認はNO_SUCH_USER
			const userRow = await db.getRepository(MiUser).findOneBy({ id: target.id });
			if (approveRes.status === 204) {
				assert.notStrictEqual(userRow, null);
				assert.strictEqual(userRow!.approved, true);
				assert.strictEqual(declineRes.status, 400);
				assert.strictEqual(castAsError(declineRes.body as any).error.code, 'ALREADY_APPROVED');
			} else {
				assert.strictEqual(userRow, null);
				assert.strictEqual(approveRes.status, 404);
				assert.strictEqual(castAsError(approveRes.body as any).error.code, 'NO_SUCH_USER');
			}
		});

		test('却下の理由は、空や空白だけにできない', async () => {
			const username = randomString();
			await apply(username);
			const target = await findPending(username);
			assert.ok(target);

			const empty = await api('admin/signup-approvals/decline', { userId: target.id, reason: '' }, admin);
			assert.strictEqual(empty.status, 400);
			assert.strictEqual(castAsError(empty.body as any).error.code, 'INVALID_PARAM');

			const blank = await api('admin/signup-approvals/decline', { userId: target.id, reason: '   ' }, admin);
			assert.strictEqual(blank.status, 400);
			assert.strictEqual(castAsError(blank.body as any).error.code, 'REASON_REQUIRED');
			assert.ok(await findPending(username));
		});

		test('signup-check-status: 長すぎるコードは受け付けない', async () => {
			const res = await api('signup-check-status', { code: 'a'.repeat(65) });
			assert.strictEqual(res.status, 400);
			assert.strictEqual(castAsError(res.body as any).error.code, 'INVALID_PARAM');
		});

		test('承認を待つアカウントは、ほかの人からはいないものとして扱い、承認すると見えるようになる', async () => {
			const username = `hidden${randomString().slice(0, 8)}`;
			await apply(username);
			const target = await findPending(username);
			assert.ok(target);

			const checkVisible = async (visible: boolean) => {
				// users/show(id・ユーザー名・まとめて)
				const byId = await api('users/show', { userId: target.id }, bob);
				assert.strictEqual(byId.status, visible ? 200 : 404);
				const byName = await api('users/show', { username }, bob);
				assert.strictEqual(byName.status, visible ? 200 : 404);
				const byNameAnon = await api('users/show', { username });
				assert.strictEqual(byNameAnon.status, visible ? 200 : 404);
				const many = await api('users/show', { userIds: [target.id] }, bob);
				assert.strictEqual((many.body as unknown[]).length, visible ? 1 : 0);

				// 検索・一覧
				const search = await api('users/search', { query: username, origin: 'local' }, bob);
				assert.strictEqual(search.status, 200);
				assert.strictEqual(search.body.some(u => u.id === target.id), visible);
				// サインインしての検索は、フォローしていない・一度も更新していない(updatedAtがnull)アカウントを
				// 元々出さない(上流の仕様)ので、出ないことだけを確かめる
				const searchByName = await api('users/search-by-username-and-host', { username, host: null }, bob);
				if (!visible) assert.strictEqual(searchByName.body.some(u => u.id === target.id), false);
				const searchByNameAnon = await api('users/search-by-username-and-host', { username, host: null });
				assert.strictEqual(searchByNameAnon.body.some(u => u.id === target.id), visible);
				const list = await api('users', { origin: 'local', sort: '+createdAt', limit: 100 }, bob);
				assert.strictEqual(list.body.some(u => u.id === target.id), visible);

				// webfinger・ActivityPub
				const webfinger = await relativeFetch(`.well-known/webfinger?resource=acct:${username}@${host}`);
				assert.strictEqual(webfinger.status, visible ? 200 : 404);
				const actor = await relativeFetch(`users/${target.id}`, { headers: { Accept: 'application/activity+json' } });
				assert.strictEqual(actor.status, visible ? 200 : 404);
				const actorByAcct = await relativeFetch(`@${username}`, { headers: { Accept: 'application/activity+json' } });
				assert.strictEqual(actorByAcct.status, visible ? 200 : 404);
				const outbox = await relativeFetch(`users/${target.id}/outbox`, { headers: { Accept: 'application/activity+json' } });
				assert.strictEqual(outbox.status, visible ? 200 : 404);

				// ユーザーIDを指定するほかのAPIも、隠している間は無いアカウントと同じ答えを返す(あること自体が分からない)
				const missingId = 'nonexistent0000';
				// 内部エラー(500)どうしを比べるときに、ほかの理由の500と取り違えないよう、元の例外の名前(info.e.code)も比べる
				const errorCode = (body: unknown) => {
					const error = (body as { error?: { code?: string; info?: { e?: { code?: string } } } } | null)?.error;
					return error == null ? undefined : `${error.code}/${error.info?.e?.code ?? ''}`;
				};
				const expectSameAsMissing = async (label: string, call: (userId: string) => Promise<{ status: number; body: unknown }>) => {
					const [res, missing] = await Promise.all([call(target.id), call(missingId)]);
					if (visible) {
						assert.notStrictEqual(errorCode(res.body) ?? null, errorCode(missing.body) ?? null, label);
					} else {
						assert.strictEqual(res.status, missing.status, label);
						assert.strictEqual(errorCode(res.body), errorCode(missing.body), label);
					}
				};
				await expectSameAsMissing('users/followers', userId => api('users/followers', { userId }, bob));
				await expectSameAsMissing('users/following', userId => api('users/following', { userId }, bob));
				await expectSameAsMissing('users/reactions', userId => api('users/reactions', { userId }, bob));
				await expectSameAsMissing('users/achievements', userId => api('users/achievements', { userId }, bob));
				await expectSameAsMissing('users/lists/list', userId => api('users/lists/list', { userId }, bob));
				await expectSameAsMissing('ap/show', userId => api('ap/show', { uri: `${origin}/users/${userId}` }, bob));

				// メンションしても、隠している間は宛先に入らない(通知も、連合のMentionのタグも出ない)
				for (const mention of [`@${username}`, `@${username}@${host}`]) {
					const note = await api('notes/create', { text: `${mention} こんにちは` }, bob);
					assert.strictEqual(note.status, 200);
					assert.strictEqual((note.body.createdNote.mentions ?? []).includes(target.id), visible, mention);
				}
			};

			await checkVisible(false);

			// モデレーターには見える
			assert.strictEqual((await api('users/show', { userId: target.id }, admin)).status, 200);
			assert.strictEqual((await api('admin/show-user', { userId: target.id }, admin)).status, 200);
			assert.strictEqual((await api('users/followers', { userId: target.id }, admin)).status, 200);
			assert.strictEqual((await api('users/achievements', { userId: target.id }, admin)).status, 200);

			// フォローできない
			const follow = await api('following/create', { userId: target.id }, bob);
			assert.strictEqual(follow.status, 400);
			assert.strictEqual(castAsError(follow.body as any).error.code, 'NO_SUCH_USER');

			await successfulApiCall({ endpoint: 'admin/signup-approvals/approve', parameters: { userId: target.id }, user: admin });

			await checkVisible(true);
			const followAfter = await api('following/create', { userId: target.id }, bob);
			assert.strictEqual(followAfter.status, 200);
		});

		test('signup-check-status: 発行した直後はpending', async () => {
			const checkCode = await apply(randomString());

			const res = await api('signup-check-status', { code: checkCode });
			assert.strictEqual(res.status, 200);
			assert.deepStrictEqual(res.body, { status: 'pending', reason: null });
		});

		test('signup-check-status: 承認するとapproved', async () => {
			const username = randomString();
			const checkCode = await apply(username);
			const target = await findPending(username);
			assert.ok(target);
			await successfulApiCall({ endpoint: 'admin/signup-approvals/approve', parameters: { userId: target.id }, user: admin });

			const res = await api('signup-check-status', { code: checkCode });
			assert.strictEqual(res.status, 200);
			assert.deepStrictEqual(res.body, { status: 'approved', reason: null });
		});

		test('signup-check-status: 却下してアカウントが消えた後も、declinedと理由を確かめられる', async () => {
			const username = randomString();
			const checkCode = await apply(username);
			const target = await findPending(username);
			assert.ok(target);
			await successfulApiCall({ endpoint: 'admin/signup-approvals/decline', parameters: { userId: target.id, reason: 'test decline reason' }, user: admin });

			const res = await api('signup-check-status', { code: checkCode });
			assert.strictEqual(res.status, 200);
			assert.deepStrictEqual(res.body, { status: 'declined', reason: 'test decline reason' });
		});

		test('signup-check-status: 無いコードはnotFound', async () => {
			const res = await api('signup-check-status', { code: 'no-such-code' });
			assert.strictEqual(res.status, 200);
			assert.deepStrictEqual(res.body, { status: 'notFound', reason: null });
		});

		test('履歴: 承認すると、ユーザー名・理由・審査した人が残る', async () => {
			const username = randomString();
			await apply(username, 'approve history test reason');
			const target = await findPending(username);
			assert.ok(target);
			await successfulApiCall({ endpoint: 'admin/signup-approvals/approve', parameters: { userId: target.id }, user: admin });

			const history = await api('admin/signup-approvals/history', { state: 'approved', limit: 100 }, admin);
			assert.strictEqual(history.status, 200);
			const entry = history.body.find(e => e.username === username);
			assert.ok(entry);
			assert.strictEqual(entry.signupReason, 'approve history test reason');
			assert.strictEqual(entry.status, 'approved');
			assert.strictEqual(entry.reason, null);
			assert.strictEqual(entry.reviewer?.id, admin.id);
			assert.notStrictEqual(entry.reviewedAt, null);
		});

		test('履歴: 却下してアカウントが消えた後も、ユーザー名・理由の写しが残る', async () => {
			const username = randomString();
			await apply(username, 'decline history test reason');
			const target = await findPending(username);
			assert.ok(target);
			await successfulApiCall({ endpoint: 'admin/signup-approvals/decline', parameters: { userId: target.id, reason: 'decline history test reason for reject' }, user: admin });

			const history = await api('admin/signup-approvals/history', { state: 'declined', limit: 100 }, admin);
			assert.strictEqual(history.status, 200);
			const entry = history.body.find(e => e.username === username);
			assert.ok(entry);
			assert.strictEqual(entry.signupReason, 'decline history test reason');
			assert.strictEqual(entry.reason, 'decline history test reason for reject');
			assert.strictEqual(entry.status, 'declined');
			assert.strictEqual(entry.reviewer?.id, admin.id);

			const check = await db.getRepository(MiSignupApprovalCheck).findOneByOrFail({ id: entry.id });
			assert.strictEqual(check.userId, null);
		});

		test('メールアドレスが必須のとき: 確認のリンクを開くと、承認を待つアカウントになる', async () => {
			await api('admin/update-meta', { emailRequiredForSignup: true }, admin);
			const username = randomString();

			const noReason = await api('signup', { username, password: 'test', emailAddress: `approval-${randomString()}@example.com` });
			assert.strictEqual(noReason.status, 400);
			assert.match(JSON.stringify(noReason.body), /REASON_REQUIRED/);

			const res = await api('signup', { username, password: 'test', emailAddress: `approval-${randomString()}@example.com`, reason: 'メールで申請' });
			assert.strictEqual(res.status, 204);
			const pending = await db.getRepository(MiUserPending).findOneByOrFail({ username });
			assert.strictEqual(pending.reason, 'メールで申請');

			const confirmed = await api('signup-pending', { code: pending.code });
			assert.strictEqual(confirmed.status, 200);
			const body = confirmed.body as misskey.entities.SignupPendingApprovalResponse;
			assert.strictEqual(body.pendingApproval, true);
			assert.strictEqual(typeof body.checkCode, 'string');

			const target = await findPending(username);
			assert.ok(target);
			assert.strictEqual(target.signupReason, 'メールで申請');

			const status = await api('signup-check-status', { code: body.checkCode });
			assert.deepStrictEqual(status.body, { status: 'pending', reason: null });
		});
	});
});
