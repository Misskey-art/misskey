/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { MiSignupApprovalCheck, MiUsedUsername, MiUser } from '@/models/_.js';
import type { MiMeta, SignupApprovalChecksRepository, UserProfilesRepository, UsersRepository } from '@/models/_.js';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { EmailService } from '@/core/EmailService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { signupDeclinedEmail } from '@/misc/signup-approval-emails.js';

// misskey.art独自: 承認制の新規登録で、申請を却下する(承認を待っていたアカウントは消す)。
// misskey-juiceのadmin/juice/decline-signupから移植した
export const meta = {
	tags: ['admin'],

	requireCredential: true,
	// モデレーター・管理者か、ロールポリシーのcanApproveSignupsを持つ人だけ
	requiredRolePolicyOrModerator: 'canApproveSignups',
	kind: 'write:admin:decline-signup',

	errors: {
		reasonRequired: {
			message: 'The reason must not be empty.',
			code: 'REASON_REQUIRED',
			id: 'b1365762-dbdc-48eb-8775-faa8cff7a9c7',
			httpStatusCode: 400,
		},
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '37965999-8bb5-4cf6-aaa4-41f57fa2f8a8',
			httpStatusCode: 404,
		},
		alreadyApproved: {
			message: 'The user is already approved.',
			code: 'ALREADY_APPROVED',
			id: '8e2bd22e-44b4-4cd2-8faa-147bfbe6998a',
			httpStatusCode: 400,
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'misskey:id' },
		// 却下の理由(申請者へのメールと、審査の結果の確認に出す)
		reason: { type: 'string', minLength: 1, maxLength: 1024 },
	},
	required: ['userId', 'reason'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.meta)
		private serverSettings: MiMeta,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		@Inject(DI.signupApprovalChecksRepository)
		private signupApprovalChecksRepository: SignupApprovalChecksRepository,

		@Inject(DI.db)
		private db: DataSource,

		private moderationLogService: ModerationLogService,
		private emailService: EmailService,
		private globalEventService: GlobalEventService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// 空白だけの理由は、申請者に伝わらないので受け付けない
			if (ps.reason.trim() === '') {
				throw new ApiError(meta.errors.reasonRequired);
			}

			const user = await this.usersRepository.findOneBy({ id: ps.userId });
			if (user == null) {
				throw new ApiError(meta.errors.noSuchUser);
			}
			if (user.approved) {
				throw new ApiError(meta.errors.alreadyApproved);
			}

			// user_profileはuserと一緒に消える(ON DELETE CASCADE)ため、メールアドレスは消す前に読んでおく
			const profile = await this.userProfilesRepository.findOneBy({ userId: user.id });

			// signup_approval_check.userIdはuserを消すとNULLになる(ON DELETE SET NULL)ため、消した後はuserIdで探せない。
			// 消す前にidを控えておき、後の更新にはこのidを使う
			const check = await this.signupApprovalChecksRepository.findOneBy({ userId: user.id });

			// 承認を待っているアカウントは、サインインもAPIの利用もできないため、ノート・ファイルなどを持ち得ない。
			// そのため、アカウントの削除(DeleteAccountService)のキューを通さず、ここでuserの行を直接消す。
			// キューを通すと、実際にuserの行が消えるのはジョブが動いた後になり、却下の直後に同じユーザー名で
			// 申請し直そうとしても、userの重複の確認で断られてしまうため。
			// user_profile・user_keypair・role_assignmentなどは、外部キーのON DELETE CASCADEで一緒に消える。
			//
			// 上のapprovedの確認と削除の間に、承認(admin/signup-approvals/approve)が割り込まないよう、
			// approved = falseを条件にした削除で排他する。
			// アカウントの削除・確認コードの状況・ユーザー名の解放は、途中で落ちても食い違わない
			// (アカウントは消えたのに「審査待ち」のまま残る・ユーザー名が使えないまま残る)よう、まとめて書く
			const declined = await this.db.transaction(async em => {
				const deleteResult = await em.delete(MiUser, { id: user.id, approved: false });
				if (deleteResult.affected === 0) return false;

				// 確認コードのレコードは、userを消した後も残る(ON DELETE SET NULL)ので、
				// メールアドレスの無い申請者も、コードから却下とその理由を確かめられる
				if (check != null) {
					await em.update(MiSignupApprovalCheck, { id: check.id }, {
						status: 'declined',
						reason: ps.reason,
						reviewerId: me.id,
						reviewedAt: new Date(),
					});
				}

				// 却下したアカウントは一度も承認されておらず使われていないので、普通のアカウントの削除
				// (used_usernameを残してユーザー名を使い回させない)とは違い、同じユーザー名でもう一度申請できるようにする。
				// usernameLowerはselect: falseで読めていないので、SignupServiceと同じくusername.toLowerCase()を使う
				await em.delete(MiUsedUsername, { username: user.username.toLowerCase() });
				return true;
			});
			if (!declined) {
				// 割り込んだのが承認ならアカウントは承認済みになっていて、却下ならアカウントはもう無い
				const exists = await this.usersRepository.existsBy({ id: user.id });
				throw new ApiError(exists ? meta.errors.alreadyApproved : meta.errors.noSuchUser);
			}

			// キャッシュしているユーザーの情報を捨てさせる
			this.globalEventService.publishInternalEvent('localUserUpdated', { id: user.id });

			// メール・ログは、実際に消せたときだけにする
			if (profile?.email != null) {
				const email = signupDeclinedEmail(this.serverSettings.name ?? this.config.host, ps.reason);
				this.emailService.sendEmail(profile.email, email.subject, email.html, email.text);
			}

			this.moderationLogService.log(me, 'declineSignup', {
				userId: user.id,
				userUsername: user.username,
				userHost: user.host,
				reason: ps.reason,
			});
		});
	}
}
