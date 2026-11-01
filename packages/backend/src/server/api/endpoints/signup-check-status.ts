/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import ms from 'ms';
import * as Redis from 'ioredis';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { MiMeta, SignupApprovalChecksRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { CaptchaService } from '@/core/CaptchaService.js';
import { ApiError } from '@/server/api/error.js';
import { markSignupCheckCodeSeen, touchSignupCheckCodeSeen } from '@/misc/signup-check-seen.js';

// misskey.art独自: 承認制の新規登録で、登録したときに渡した確認コードから、審査の結果を確かめる。
// misskey-juiceのjuice/signup-check-statusから移植した
export const meta = {
	tags: ['meta'],

	requireCredential: false,

	description: 'Check the approval status of a pending signup application using its check code.',

	limit: {
		duration: ms('1hour'),
		max: 30,
	},

	errors: {
		captchaFailed: {
			message: 'Captcha verification failed.',
			code: 'CAPTCHA_FAILED',
			id: 'fbea36d0-8e72-4b5e-b752-a49e16abd09d',
		},
	},

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			status: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['pending', 'approved', 'declined', 'notFound'],
			},
			// 却下したときの理由。却下していないときはnull
			reason: {
				type: 'string',
				optional: false, nullable: true,
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		code: { type: 'string', minLength: 1, maxLength: 64 },
		// 端末に保存したコードを、画面を開くたびに黙って確かめ直すときは、captchaを要らないようにする。
		// ただ、新しいコードかどうかはこの申告だけでは決められないので、サーバー側で一度見たコードを記録し、
		// 記録の無いコードには、申告によらずcaptchaを要るようにする(下を参照)
		isNewSubmission: { type: 'boolean', default: false },
		'hcaptcha-response': { type: 'string', nullable: true },
		'g-recaptcha-response': { type: 'string', nullable: true },
		'm-captcha-response': { type: 'string', nullable: true },
		'turnstile-response': { type: 'string', nullable: true },
		'testcaptcha-response': { type: 'string', nullable: true },
	},
	required: ['code'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.meta)
		private serverSettings: MiMeta,

		@Inject(DI.signupApprovalChecksRepository)
		private signupApprovalChecksRepository: SignupApprovalChecksRepository,

		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		private captchaService: CaptchaService,
	) {
		super(meta, paramDef, async (ps) => {
			// isNewSubmissionは呼び出す側の申告で、攻撃する人はいつでもfalseを送れる。
			// そのため、一度見たコードをサーバー側(Redis)で記録し、記録の無いコードには申告によらずcaptchaを要るようにする。
			// 登録したときに発行したコードも記録するので、端末に保存したコードはcaptchaなしで確かめられ、
			// 知らないコードを総当たりで試すには、毎回captchaが要る
			const seen = !ps.isNewSubmission && await touchSignupCheckCodeSeen(this.redisClient, ps.code);

			if (!seen) {
				await this.captchaService.verifyRequestCaptcha(this.serverSettings, {
					hcaptcha: ps['hcaptcha-response'],
					mcaptcha: ps['m-captcha-response'],
					recaptcha: ps['g-recaptcha-response'],
					turnstile: ps['turnstile-response'],
					testcaptcha: ps['testcaptcha-response'],
				}).catch(err => {
					throw new ApiError(meta.errors.captchaFailed, { message: err.message });
				});

				await markSignupCheckCodeSeen(this.redisClient, ps.code);
			}

			const check = await this.signupApprovalChecksRepository.findOneBy({ code: ps.code });

			return {
				status: check?.status ?? 'notFound',
				reason: check?.reason ?? null,
			};
		});
	}
}
