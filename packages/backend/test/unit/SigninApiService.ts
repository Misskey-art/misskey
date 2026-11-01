/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { IncomingHttpHeaders } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { HttpHeader } from 'fastify/types/utils.js';
import { MiUser } from '@/models/User.js';
import { MiUserProfile, UserProfilesRepository, UsersRepository } from '@/models/_.js';
import { IdService } from '@/core/IdService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { DI } from '@/di-symbols.js';
import { CoreModule } from '@/core/CoreModule.js';
import { SigninApiService } from '@/server/api/SigninApiService.js';
import { RateLimiterService } from '@/server/api/RateLimiterService.js';
import { SigninService } from '@/server/api/SigninService.js';

class FakeLimiter {
	public async limit() {
		return;
	}
}

class FakeSigninService {
	public signin(..._args: any): any {
		return { finished: true, id: 'dummy', i: 'dummy-token' };
	}
}

class DummyFastifyReply {
	public statusCode: number;
	code(num: number): void {
		this.statusCode = num;
	}
	header(_key: HttpHeader, _value: any): void {
	}
}
class DummyFastifyRequest {
	public ip: string;
	public body: any;
	public headers: IncomingHttpHeaders = { 'accept': 'application/json' };
	constructor(body?: any) {
		this.ip = '0.0.0.0';
		this.body = body;
	}
}

type ApiFastifyRequestType = FastifyRequest<{
	Body: {
		username: string;
		password?: string;
		token?: string;
	};
}>;

// misskey.art独自: 承認制の新規登録で、まだ承認されていないアカウントのサインイン(misskey-juiceのテストから移植した)。
// SigninWithPasskeyApiService.tsのテストと同じく、GlobalModule+CoreModuleを読み込み、副作用のある依存だけをFakeに差し替える
describe('SigninApiService', () => {
	let app: TestingModule;
	let signinApiService: SigninApiService;
	let usersRepository: UsersRepository;
	let userProfilesRepository: UserProfilesRepository;
	let idService: IdService;

	const rawPassword = 'correct-password';
	let passwordHash: string;
	let username: string;

	async function createUser(data: Partial<MiUser> = {}) {
		return await usersRepository.save({ ...data });
	}

	async function createUserProfile(data: Partial<MiUserProfile> = {}) {
		return await userProfilesRepository.save({ ...data });
	}

	beforeAll(async () => {
		passwordHash = await bcrypt.hash(rawPassword, await bcrypt.genSalt(8));

		app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [
				SigninApiService,
				{ provide: RateLimiterService, useClass: FakeLimiter },
				{ provide: SigninService, useClass: FakeSigninService },
			],
		}).useMocker((token) => {
			if (typeof token === 'function') {
				return mockDeep<typeof token>();
			}
		}).compile();

		signinApiService = app.get<SigninApiService>(SigninApiService);
		usersRepository = app.get<UsersRepository>(DI.usersRepository);
		userProfilesRepository = app.get<UserProfilesRepository>(DI.userProfilesRepository);
		idService = app.get<IdService>(IdService);
	});

	beforeEach(async () => {
		const uid = idService.gen();
		username = uid;
		await createUser({
			id: uid, username: uid, usernameLower: uid.toLowerCase(), uri: null, host: null, approved: true, isSuspended: false,
		});
		await createUserProfile({
			userId: uid,
			password: passwordHash,
		});
	});

	afterAll(async () => {
		await app.close();
	});

	it('パスワードが正しければサインインできる', async () => {
		const req = new DummyFastifyRequest({ username, password: rawPassword }) as ApiFastifyRequestType;
		const res = new DummyFastifyReply() as unknown as FastifyReply;
		const result = await signinApiService.signin(req, res);

		expect(result).toEqual({ finished: true, id: 'dummy', i: 'dummy-token' });
	});

	it('承認待ちのアカウントは、パスワードが正しいときだけ403(承認待ち)が返る', async () => {
		await usersRepository.update({ id: username }, { approved: false });

		const req = new DummyFastifyRequest({ username, password: rawPassword }) as ApiFastifyRequestType;
		const res = new DummyFastifyReply() as unknown as FastifyReply;
		const result = await signinApiService.signin(req, res);

		expect(res.statusCode).toBe(403);
		expect((result as { error: { id: string } }).error.id).toBe('9f2f084b-af33-4f06-93cf-8a7fe04c6786');
	});

	it('承認待ちのアカウントでも、パスワードが違えば普通の失敗になる(状態を調べられないように)', async () => {
		await usersRepository.update({ id: username }, { approved: false });

		const req = new DummyFastifyRequest({ username, password: 'wrong-password' }) as ApiFastifyRequestType;
		const res = new DummyFastifyReply() as unknown as FastifyReply;
		const result = await signinApiService.signin(req, res);

		expect(res.statusCode).toBe(403);
		expect((result as { error: { id: string } }).error.id).toBe('932c904e-9460-45b7-9ce6-7ed33be7eb2c');
	});
});
