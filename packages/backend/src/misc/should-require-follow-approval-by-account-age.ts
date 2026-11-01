/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { MiUserProfile } from '@/models/UserProfile.js';

/** 「新しいアカウントからのフォローを承認制にする」の期間の上限(30日) */
export const FOLLOW_APPROVAL_MAX_SECONDS = 30 * 24 * 60 * 60;

export function shouldRequireFollowApprovalByAccountAge(
	profile: Pick<MiUserProfile, 'followApprovalLocalSeconds' | 'followApprovalRemoteSeconds'>,
	isRemote: boolean,
	createdAt: Date,
	now = Date.now(),
): boolean {
	// アカウント作成からの経過時間がフォロー承認の必要時間より短い場合、承認が必要とする
	// 必要時間が0または未設定の場合、承認は不要とする
	const seconds = (isRemote ? profile.followApprovalRemoteSeconds : profile.followApprovalLocalSeconds) ?? 0;
	return seconds > 0 && now - createdAt.getTime() < seconds * 1000;
}

/**
 * misskey.art独自: ユーザーが「既定値を使う」(null)にしている期間を、管理画面で決めたサーバーの既定値で埋める。
 * shouldRequireFollowApprovalByAccountAgeはnullを無効として扱うため、判定の前に通す
 */
export function applyFollowApprovalDefaults(
	profile: Pick<MiUserProfile, 'followApprovalLocalSeconds' | 'followApprovalRemoteSeconds'>,
	defaults: { followApprovalDefaultLocalSeconds: number; followApprovalDefaultRemoteSeconds: number },
): Pick<MiUserProfile, 'followApprovalLocalSeconds' | 'followApprovalRemoteSeconds'> {
	return {
		followApprovalLocalSeconds: profile.followApprovalLocalSeconds ?? defaults.followApprovalDefaultLocalSeconds,
		followApprovalRemoteSeconds: profile.followApprovalRemoteSeconds ?? defaults.followApprovalDefaultRemoteSeconds,
	};
}
