/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { MiSignupApprovalCheck, MiUser } from '@/models/_.js';
import type { MiMeta, UserProfilesRepository, UsersRepository } from '@/models/_.js';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { EmailService } from '@/core/EmailService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { UserService } from '@/core/UserService.js';
import UsersChart from '@/core/chart/charts/users.js';
import { signupApprovedEmail } from '@/misc/signup-approval-emails.js';

// misskey.art独自: 承認制の新規登録で、申請を承認する。misskey-juiceのadmin/juice/approve-signupから移植した
export const meta = {
	tags: ['admin'],

	requireCredential: true,
	// モデレーター・管理者か、ロールポリシーのcanApproveSignupsを持つ人だけ
	requiredRolePolicyOrModerator: 'canApproveSignups',
	kind: 'write:admin:approve-signup',

	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: 'bdcf7c8c-cb42-48c2-a226-47080733cf1f',
			httpStatusCode: 404,
		},
		alreadyApproved: {
			message: 'The user is already approved.',
			code: 'ALREADY_APPROVED',
			id: '224da03a-21ef-4e16-a3eb-e3afc8ff2447',
			httpStatusCode: 400,
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'misskey:id' },
	},
	required: ['userId'],
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

		@Inject(DI.db)
		private db: DataSource,

		private moderationLogService: ModerationLogService,
		private emailService: EmailService,
		private globalEventService: GlobalEventService,
		private userService: UserService,
		private usersChart: UsersChart,
	) {
		super(meta, paramDef, async (ps, me) => {
			const user = await this.usersRepository.findOneBy({ id: ps.userId });
			if (user == null) {
				throw new ApiError(meta.errors.noSuchUser);
			}
			if (user.approved) {
				throw new ApiError(meta.errors.alreadyApproved);
			}

			// アカウントの承認と確認コードの状況は、途中で落ちても食い違わないよう、まとめて書く
			const approved = await this.db.transaction(async em => {
				// 上のapprovedの確認と更新の間に、ほかの審査(承認・却下)が割り込まないよう、
				// approved = falseを条件にした更新で排他する
				const updateResult = await em.update(MiUser, { id: user.id, approved: false }, {
					approved: true,
				});
				if (updateResult.affected === 0) return false;

				await em.update(MiSignupApprovalCheck, { userId: user.id }, {
					status: 'approved',
					reviewerId: me.id,
					reviewedAt: new Date(),
				});
				return true;
			});
			if (!approved) {
				// 割り込んだのが却下ならアカウントはもう無く、承認ならアカウントは承認済みになっている
				const exists = await this.usersRepository.existsBy({ id: user.id });
				throw new ApiError(exists ? meta.errors.alreadyApproved : meta.errors.noSuchUser);
			}

			// キャッシュしているユーザーの情報を読み直させる
			this.globalEventService.publishInternalEvent('localUserUpdated', { id: user.id });

			// 承認を待つアカウントは、申請の時点ではユーザーの統計に数えずWebhookも送っていない(SignupService)ので、ここでする
			const approvedUser = { ...user, approved: true };
			this.usersChart.update(approvedUser, true);
			this.userService.notifySystemWebhook(approvedUser, 'userCreated');

			this.moderationLogService.log(me, 'approveSignup', {
				userId: user.id,
				userUsername: user.username,
				userHost: user.host,
			});

			const profile = await this.userProfilesRepository.findOneBy({ userId: user.id });
			if (profile?.email != null) {
				const email = signupApprovedEmail(this.serverSettings.name ?? this.config.host);
				this.emailService.sendEmail(profile.email, email.subject, email.html, email.text);
			}
		});
	}
}
