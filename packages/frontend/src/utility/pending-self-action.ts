/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 自分自身がこのタブで直前に行った操作をキーで記録し、対応するリアルタイム通知(broadcast)を
 * 二重反映しないよう判定するためのヘルパー。
 *
 * 単純に「操作したuserId === 自分のid」で弾くと、同じアカウントで複数タブ/セッションを
 * 開いている場合に、楽観的更新を行っていない他のタブの通知まで一緒に弾いてしまう。
 * このタブで実際に行った操作だけをキー単位で記録することで、他のタブ・他のユーザーからの
 * 通知は正しく反映されるようにする。
 */
export class PendingSelfActions {
	private readonly expiresAt = new Map<string, number>();

	constructor(private readonly ttlMs = 10000) {}

	public mark(key: string): void {
		this.expiresAt.set(key, Date.now() + this.ttlMs);
	}

	public consume(key: string): boolean {
		const expiresAt = this.expiresAt.get(key);
		if (expiresAt == null) return false;
		this.expiresAt.delete(key);
		return expiresAt >= Date.now();
	}
}
