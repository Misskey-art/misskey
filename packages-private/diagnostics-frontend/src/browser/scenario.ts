/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { api, closeUserSetupDialog, postNote, registerUser, resetState, signupThroughUi, visitHome } from '../../../../packages/frontend/test/e2e/shared';
import { sleep } from './server';
import type { HeadlessChromeController } from './controller';

export const scenarioDescription = 'fresh browser signup, first timeline note, after the note becomes visible';

/**
 * 各ラウンドを同じ初期状態から始めるため、DBを消して管理者だけ作り直す。
 */
export async function prepareInstance(baseUrl: string) {
	await resetState(baseUrl);
	await registerUser(baseUrl, 'admin', 'admin1234', true);

	// 管理者作成後のrootUserId更新が、APIとトップページのメタ情報へ反映されるまで待つ。
	for (let i = 0; i < 30; i++) {
		const meta = await api(baseUrl, 'meta', { detail: true });
		if (!meta.requireSetup) {
			const html = await fetch(`${baseUrl}/`).then(response => response.text());
			if (html.includes('"requireSetup":false')) return;
		}
		await sleep(1000);
	}

	throw new Error('Timed out waiting for instance setup to complete');
}

export async function runSignupAndPostScenario(chrome: HeadlessChromeController, baseUrl: string) {
	const page = chrome.page;
	const noteText = `Frontend browser metrics ${Date.now()}`;

	await visitHome(page, baseUrl);
	await signupThroughUi(page, { username: 'alice', password: 'password' });
	await closeUserSetupDialog(page);
	await postNote(page, noteText, 10_000);

	// 投稿直後の非同期処理が落ち着いてから計測したいので少し待つ
	await sleep(1000);
}
