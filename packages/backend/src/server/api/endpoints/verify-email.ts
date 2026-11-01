/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { UserProfilesRepository } from '@/models/_.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DI } from '@/di-symbols.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { EmailService } from '@/core/EmailService.js';
import { ApiError } from '../error.js';

export const meta = {
	requireCredential: false,

	tags: ['account'],

	errors: {
		noSuchCode: {
			message: 'No such code.',
			code: 'NO_SUCH_CODE',
			id: '97c1f576-e4b8-4b8a-a6dc-9cb65e7f6f85',
		},

		// misskey.art独自: 変更を受け付けた後に、同じ(別名を含む)メールアドレスのほかのアカウントが確認済みになっていた
		emailAlreadyUsed: {
			message: 'This email address is already used by another account.',
			code: 'EMAIL_ALREADY_USED',
			id: 'b7e3a1d2-5c64-4f0e-9a8b-3d2f6c1e7a90',
		},

		// misskey.art独自: 変更を受け付けた後に、管理画面で+タグ・Gmailのドットを含むアドレスを禁止した
		unavailableEmail: {
			message: 'This email address is not allowed on this server.',
			code: 'UNAVAILABLE_EMAIL',
			id: 'e4c2f0a8-7b19-4d6e-8f35-1a9c6b2d0e47',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		code: { type: 'string' },
	},
	required: ['code'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		private userEntityService: UserEntityService,
		private globalEventService: GlobalEventService,
		private emailService: EmailService,
	) {
		super(meta, paramDef, async (ps) => {
			const profile = await this.userProfilesRepository.findOneBy({
				emailVerifyCode: ps.code,
			});

			if (profile == null) {
				throw new ApiError(meta.errors.noSuchCode);
			}

			// misskey.art独自: 変更の受付時は確認前の変更を数えないため、別名で複数のアカウントに設定してから順に確認すると、
			// 重複を防げない。確認済みにする直前にもう一度確かめる
			if (profile.email != null && await this.emailService.isEmailUsedByOtherAccount(profile.email, profile.userId)) {
				throw new ApiError(meta.errors.emailAlreadyUsed);
			}
			// 受付の後に管理画面で+タグ・Gmailのドットを禁止した場合も、確認済みにしない
			if (profile.email != null && (this.emailService.isPlusTagBlocked(profile.email) || this.emailService.isGmailDotBlocked(profile.email))) {
				throw new ApiError(meta.errors.unavailableEmail);
			}

			await this.userProfilesRepository.update({ userId: profile.userId }, {
				emailVerified: true,
				emailVerifyCode: null,
			});

			this.globalEventService.publishMainStream(profile.userId, 'meUpdated', await this.userEntityService.pack(profile.userId, { id: profile.userId }, {
				schema: 'MeDetailed',
				includeSecrets: true,
			}));
		});
	}
}

