/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { escapeHtml } from '@/misc/escape-html.js';

// misskey.art独自: 承認制の新規登録で送るメールの文面。バックエンドには言語ごとの文面の仕組みが無いので、
// 日本語・英語の順に両方を書いた決まった文面にする(misskey-juiceでは言語ごとに分けていた)

export type SignupApprovalEmail = {
	subject: string;
	html: string;
	text: string;
};

/**
 * 日本語の段落と英語の段落を、この順に並べたメールにする。
 * 各行はプレーンテキストで渡す(HTMLでは行ごとにエスケープしてから改行を<br>にする)
 */
function bilingual(subject: string, ja: string[], en: string[]): SignupApprovalEmail {
	const toHtml = (lines: string[]) => lines.map(line => escapeHtml(line)).join('<br>');
	return {
		subject,
		html: `${toHtml(ja)}<br><br>${toHtml(en)}`,
		text: `${ja.join('\n')}\n\n${en.join('\n')}`,
	};
}

function linesOf(text: string): string[] {
	return text.split(/\r\n|\r|\n/);
}

/** メールアドレスの確認が済み、モデレーターの承認を待っているとき */
export function signupPendingApprovalEmail(instanceName: string): SignupApprovalEmail {
	return bilingual('登録の承認待ちです / Your registration is awaiting approval', [
		`${instanceName} にご登録いただき、ありがとうございます。`,
		'運営が登録を承認するまで、サインインはできません。審査の結果は、このメールアドレスにお知らせします。',
	], [
		`Thank you for registering on ${instanceName}.`,
		'You will not be able to sign in until a moderator approves your registration. We will let you know the result at this email address.',
	]);
}

/** 登録が承認されたとき */
export function signupApprovedEmail(instanceName: string): SignupApprovalEmail {
	return bilingual('登録が承認されました / Your registration has been approved', [
		`${instanceName} へのアカウントの登録が承認されました。サインインできるようになりました。`,
	], [
		`Your account registration on ${instanceName} has been approved. You can now sign in.`,
	]);
}

/** 登録が却下されたとき(理由は、モデレーターが書いたものをそのまま載せる) */
export function signupDeclinedEmail(instanceName: string, reason: string): SignupApprovalEmail {
	return bilingual('登録が却下されました / Your registration has been declined', [
		`${instanceName} へのアカウントの登録の申請は、却下されました。`,
		'理由:',
		...linesOf(reason),
	], [
		`Your account registration request on ${instanceName} has been declined.`,
		'Reason:',
		...linesOf(reason),
	]);
}
