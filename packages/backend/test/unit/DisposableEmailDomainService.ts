/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { DisposableEmailDomainService, isDomainListed, normalizeDisposableEmailAllowDomains, parseDisposableEmailDomainList } from '@/core/DisposableEmailDomainService.js';
import type { MiMeta } from '@/models/Meta.js';

type Settings = Partial<Pick<MiMeta, 'disposableEmailBlocklistEnabled' | 'disposableEmailAllowDomains'>>;

// 本物と同じくらいの件数の一覧(件数が少ない一覧は、壊れているとみなして使わないため)
const LIST = ['mailinator.com', 'trash-mail.example', ...Array.from({ length: 1200 }, (_, i) => `disposable-${i}.example`)].join('\n');

function setup(options: { settings?: Settings; stored?: string | null; fetch?: () => Promise<string> } = {}) {
	const store = new Map<string, string>();
	if (options.stored != null) store.set('disposableEmailDomains', options.stored);
	const redis = {
		get: vi.fn(async (key: string) => store.get(key) ?? null),
		set: vi.fn(async (key: string, value: string, ...args: unknown[]) => {
			if (args.includes('NX') && store.has(key)) return null;
			store.set(key, value);
			return 'OK';
		}),
	};
	const send = vi.fn(async () => ({ text: options.fetch ?? (async () => LIST) }));
	const logger = { info: vi.fn(), warn: vi.fn() };
	const settings = options.settings ?? { disposableEmailBlocklistEnabled: true };
	const meta = {
		disposableEmailBlocklistEnabled: settings.disposableEmailBlocklistEnabled ?? false,
		disposableEmailAllowDomains: settings.disposableEmailAllowDomains ?? [],
	};
	const service = new DisposableEmailDomainService(
		meta as never,
		redis as never,
		{ send } as never,
		{ getLogger: () => logger } as never,
	);
	return { service, redis, send, store, logger };
}

describe('DisposableEmailDomainService', () => {
	describe('parseDisposableEmailDomainList', () => {
		test('1行に1ドメイン。空行・コメント・形のおかしい行は飛ばし、小文字にする', () => {
			expect([...parseDisposableEmailDomainList('Mailinator.com\n\n# comment\n  spaced.example  \nnot a domain\nnodot\n-bad.example\n')]).toEqual(['mailinator.com', 'spaced.example']);
		});
	});

	describe('isDomainListed', () => {
		const list = new Set(['mailinator.com', 'co.uk.example']);

		test('ドメインそのものと、サブドメインが一致する', () => {
			expect(isDomainListed('mailinator.com', list)).toBe(true);
			expect(isDomainListed('a.b.MAILINATOR.com', list)).toBe(true);
			expect(isDomainListed('mailinator.com.', list)).toBe(true);
		});

		test('後ろが同じだけの別のドメイン・親のドメイン・TLDだけでは一致しない', () => {
			expect(isDomainListed('notmailinator.com', list)).toBe(false);
			expect(isDomainListed('uk.example', list)).toBe(false);
			expect(isDomainListed('com', new Set(['com']))).toBe(false);
		});
	});

	test('normalizeDisposableEmailAllowDomains: 小文字・重複なし・形の正しいものだけにする', () => {
		expect(normalizeDisposableEmailAllowDomains([' Example.com ', '@example.com', 'bad domain', 'sub.example.org'])).toEqual(['example.com', 'sub.example.org']);
	});

	test('一覧に載っているドメイン(サブドメインも)を使い捨てと判定する', async () => {
		const { service, send } = setup();
		expect(await service.isDisposable('a@mailinator.com')).toBe(true);
		expect(await service.isDisposable('a@x.mailinator.com')).toBe(true);
		expect(await service.isDisposable('a@gmail.com')).toBe(false);
		// 一覧は1回だけ取りに行く
		expect(send).toHaveBeenCalledTimes(1);
	});

	test('設定がオフなら判定せず、一覧も取りに行かない', async () => {
		const { service, send } = setup({ settings: {} });
		expect(await service.isDisposable('a@mailinator.com')).toBe(false);
		expect(send).not.toHaveBeenCalled();
	});

	test('許可するドメイン(サブドメインも)は、一覧に載っていても受け付ける', async () => {
		const { service } = setup({ settings: { disposableEmailBlocklistEnabled: true, disposableEmailAllowDomains: ['mailinator.com'] } });
		expect(await service.isDisposable('a@mailinator.com')).toBe(false);
		expect(await service.isDisposable('a@sub.mailinator.com')).toBe(false);
		expect(await service.isDisposable('a@trash-mail.example')).toBe(true);
	});

	test('isAllowed・isReady', async () => {
		const { service } = setup({ settings: { disposableEmailBlocklistEnabled: true, disposableEmailAllowDomains: ['mailinator.com'] } });
		expect(service.isAllowed('a@sub.mailinator.com')).toBe(true);
		expect(service.isAllowed('a@trash-mail.example')).toBe(false);
		expect(await service.isReady()).toBe(true);
		// 一覧の設定がオフでも、許可するドメインは見る(検証の方式が使い捨てと判定したときに使う)。一覧では判定できていない
		const off = setup({ settings: { disposableEmailAllowDomains: ['mailinator.com'] } });
		expect(off.service.isAllowed('a@mailinator.com')).toBe(true);
		expect(await off.service.isReady()).toBe(false);
		// 一覧を取れなければ、判定できていない
		const failing = setup({ fetch: async () => { throw new Error('network'); } });
		expect(await failing.service.isReady()).toBe(false);
	});

	test('取ってきた一覧が小さすぎる・取れないときは、判定しない(登録を止めない)', async () => {
		const small = setup({ fetch: async () => 'mailinator.com\n' });
		expect(await small.service.isDisposable('a@mailinator.com')).toBe(false);
		expect(small.store.has('disposableEmailDomains')).toBe(false);

		const failing = setup({ fetch: async () => { throw new Error('network'); } });
		expect(await failing.service.isDisposable('a@mailinator.com')).toBe(false);
		expect(failing.logger.warn).toHaveBeenCalled();
	});

	test('Redisに新しい一覧があれば、取りに行かずにそれを使う', async () => {
		const { service, send } = setup({ stored: JSON.stringify({ fetchedAt: Date.now(), domains: LIST }) });
		expect(await service.isDisposable('a@mailinator.com')).toBe(true);
		expect(send).not.toHaveBeenCalled();
	});

	test('Redisの一覧が古くて取り直しに失敗しても、前の一覧を使い続ける', async () => {
		const { service, send } = setup({
			stored: JSON.stringify({ fetchedAt: Date.now() - 1000 * 60 * 60 * 48, domains: LIST }),
			fetch: async () => { throw new Error('network'); },
		});
		expect(await service.isDisposable('a@mailinator.com')).toBe(true);
		await service.refresh();
		expect(send).toHaveBeenCalled();
		expect(await service.isDisposable('a@mailinator.com')).toBe(true);
	});

	test('status: 件数と取ってきた日時を返す(まだ無ければ0とnull)', async () => {
		const empty = setup({ settings: {} });
		expect(await empty.service.status()).toEqual({ count: 0, fetchedAt: null });
		const { service } = setup();
		await service.refresh();
		const status = await service.status();
		expect(status.count).toBe(1202);
		expect(status.fetchedAt).not.toBeNull();
	});
});
