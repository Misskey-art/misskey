/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { LoggerService } from '@/core/LoggerService.js';
import type { MiMeta } from '@/models/Meta.js';
import type Logger from '@/logger.js';

// misskey.art独自: 使い捨てメールアドレスのドメインの一覧(https://github.com/disposable-email-domains/disposable-email-domains、CC0)で、
// 新規登録・メールアドレス変更を断る。メールの検証方式(verifymail.io・Truemail・deep-email-validator)とは別に動く。
// 一覧は1日に1回取り直してRedisに置き(プロセス・再起動をまたいで使う)、取れなかったときは前の一覧を使い続ける。
// 一度も取れていない間は、判定しない(登録を止めない)。misskey-juiceの同じ機能から移植した

const LIST_URL = 'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf';
const REDIS_KEY = 'disposableEmailDomains';
const LOCK_KEY = 'disposableEmailDomains:lock';
// 一覧を取り直す間隔と、取るのに失敗した後に次に試すまでの間隔
const REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 24;
const RETRY_INTERVAL_MS = 1000 * 60 * 30;
// ほかのプロセスが取り直した一覧を、Redisから読み直す間隔
const RELOAD_INTERVAL_MS = 1000 * 60 * 10;
// 取ってきた一覧が、これより少なければ壊れているとみなして使わない(本物は数千件ある)
const MIN_DOMAINS = 1000;
const MAX_LIST_BYTES = 1024 * 1024 * 4;

const DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

/** 一覧の文字列(1行に1ドメイン。#から始まる行・空行は飛ばす)を、ドメインの集合にする */
export function parseDisposableEmailDomainList(text: string): Set<string> {
	const domains = new Set<string>();
	for (const line of text.split('\n')) {
		const domain = line.trim().toLowerCase();
		if (domain === '' || domain.startsWith('#')) continue;
		if (domain.length <= 253 && DOMAIN_PATTERN.test(domain)) domains.add(domain);
	}
	return domains;
}

/** ドメインそのもの、またはその親のドメインが、集合にあるか(sub.example.com なら sub.example.com・example.com を見る。TLDだけでは見ない) */
export function isDomainListed(domain: string, list: ReadonlySet<string>): boolean {
	const labels = domain.toLowerCase().replace(/\.$/, '').split('.');
	for (let i = 0; i < labels.length - 1; i++) {
		if (list.has(labels.slice(i).join('.'))) return true;
	}
	return false;
}

/** 管理画面で入れた許可するドメインの一覧を、保存する形にそろえる(小文字・重複なし・形の正しいものだけ) */
export function normalizeDisposableEmailAllowDomains(domains: readonly string[]): string[] {
	return [...parseDisposableEmailDomainList(domains.map(domain => domain.trim().replace(/^@/, '')).join('\n'))];
}

function domainOf(emailAddress: string): string | null {
	const domain = emailAddress.split('@').pop()?.trim().toLowerCase();
	return domain == null || domain === '' ? null : domain;
}

type StoredList = { fetchedAt: number; domains: string };

@Injectable()
export class DisposableEmailDomainService {
	private logger: Logger;
	private domains: Set<string> | null = null;
	// 今持っている一覧を取ってきた時刻
	private fetchedAt: number | null = null;
	// Redisから読み直した時刻・取り直しを最後に試みた時刻
	private loadedAt = 0;
	private lastAttemptAt = 0;
	private refreshing: Promise<void> | null = null;

	constructor(
		@Inject(DI.meta)
		private meta: MiMeta,

		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		private httpRequestService: HttpRequestService,
		private loggerService: LoggerService,
	) {
		this.logger = this.loggerService.getLogger('disposable-email');
	}

	/**
	 * そのメールアドレスが、使い捨てメールアドレスの一覧に載っているドメインのものか。
	 * 設定がオフのとき、許可するドメインのとき、一覧をまだ持っていないときはfalse
	 */
	@bindThis
	public async isDisposable(emailAddress: string): Promise<boolean> {
		if (!this.meta.disposableEmailBlocklistEnabled) return false;
		const domain = domainOf(emailAddress);
		if (domain == null) return false;
		if (isDomainListed(domain, new Set(this.meta.disposableEmailAllowDomains))) return false;
		const list = await this.getList();
		return list != null && isDomainListed(domain, list);
	}

	/**
	 * 管理画面の「使い捨てと判定しないドメイン」に入っているドメイン(とそのサブドメイン)のアドレスか。
	 * 検証の方式(verifymail.io等)が使い捨てと判定したときにも使うため、一覧の設定がオフでも見る
	 */
	@bindThis
	public isAllowed(emailAddress: string): boolean {
		const domain = domainOf(emailAddress);
		return domain != null && isDomainListed(domain, new Set(this.meta.disposableEmailAllowDomains));
	}

	/** 設定がオンで、一覧を持っているか(=この一覧で判定できているか) */
	@bindThis
	public async isReady(): Promise<boolean> {
		return this.meta.disposableEmailBlocklistEnabled && await this.getList() != null;
	}

	/** 一覧の状態(管理画面に出す) */
	@bindThis
	public async status(): Promise<{ count: number; fetchedAt: string | null }> {
		await this.loadFromRedis(true).catch(() => {});
		return {
			count: this.domains?.size ?? 0,
			fetchedAt: this.fetchedAt != null ? new Date(this.fetchedAt).toISOString() : null,
		};
	}

	/**
	 * 一覧を返す。古くなっていたら裏で取り直す(判定は今の一覧で進める)。一覧を一度も持っていなければ、取ってくるのを少しだけ待つ
	 */
	@bindThis
	private async getList(): Promise<Set<string> | null> {
		const now = Date.now();
		if (this.domains == null || now - this.loadedAt > RELOAD_INTERVAL_MS) {
			await this.loadFromRedis().catch(err => this.logger.warn(`Failed to load the list from Redis: ${err}`));
		}
		const stale = this.fetchedAt == null || now - this.fetchedAt > REFRESH_INTERVAL_MS;
		if (stale && now - this.lastAttemptAt > (this.domains == null ? 1000 * 60 : RETRY_INTERVAL_MS)) {
			const refreshing = this.refresh();
			// 初めてのときだけ待つ(長くは待たない。間に合わなければ、今回は判定しない)
			if (this.domains == null) await Promise.race([refreshing, new Promise(resolve => setTimeout(resolve, 5000))]);
		}
		return this.domains;
	}

	@bindThis
	private async loadFromRedis(force = false): Promise<void> {
		if (!force && this.domains != null && Date.now() - this.loadedAt <= RELOAD_INTERVAL_MS) return;
		this.loadedAt = Date.now();
		const raw = await this.redisClient.get(REDIS_KEY);
		if (raw == null) return;
		const stored = JSON.parse(raw) as StoredList;
		if (this.fetchedAt != null && stored.fetchedAt <= this.fetchedAt) return;
		const domains = parseDisposableEmailDomainList(stored.domains);
		if (domains.size < MIN_DOMAINS) return;
		this.domains = domains;
		this.fetchedAt = stored.fetchedAt;
	}

	/**
	 * 一覧を取り直す(同時には1つだけ。ほかのプロセスが取り直している間は、その結果をRedisから読む)。
	 * 失敗しても例外は投げず、前の一覧を使い続ける
	 */
	@bindThis
	public refresh(): Promise<void> {
		this.refreshing ??= this.doRefresh().finally(() => {
			this.refreshing = null;
		});
		return this.refreshing;
	}

	@bindThis
	private async doRefresh(): Promise<void> {
		this.lastAttemptAt = Date.now();
		try {
			// ほかのプロセスと同時に取りに行かない
			const locked = await this.redisClient.set(LOCK_KEY, '1', 'EX', 60, 'NX');
			if (locked == null) {
				await new Promise(resolve => setTimeout(resolve, 3000));
				await this.loadFromRedis(true);
				return;
			}
			const res = await this.httpRequestService.send(LIST_URL, {
				method: 'GET',
				headers: { Accept: 'text/plain, */*' },
				timeout: 10000,
				size: MAX_LIST_BYTES,
			});
			const text = await res.text();
			const domains = parseDisposableEmailDomainList(text);
			if (domains.size < MIN_DOMAINS) throw new Error(`The fetched list is too small (${domains.size} domains)`);
			const fetchedAt = Date.now();
			await this.redisClient.set(REDIS_KEY, JSON.stringify({ fetchedAt, domains: [...domains].join('\n') } satisfies StoredList));
			this.domains = domains;
			this.fetchedAt = fetchedAt;
			this.loadedAt = fetchedAt;
			this.logger.info(`Fetched the disposable email domain list (${domains.size} domains)`);
		} catch (err) {
			this.logger.warn(`Failed to fetch the disposable email domain list (the previous list stays in use): ${err}`);
		}
	}
}
