/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { SignupApprovalChecksRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { QueryService } from '@/core/QueryService.js';
import { IdService } from '@/core/IdService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';

// misskey.art独自: 承認制の新規登録で、審査が済んだ(承認・却下した)申請の履歴。misskey-juiceのadmin/juice/signup-approval-historyから移植した。
// 審査を待っている申請は、承認・却下に実在するuserIdが要るため、admin/signup-approvals/pendingがuserの行から出す。
// こちらはsignup_approval_checkの写しを読むだけにする。却下したアカウントは消えているため、username・signupReasonは申請した時点の写しを出す
export const signupApprovalHistoryStatuses = ['approved', 'declined'] as const;

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	// モデレーター・管理者か、ロールポリシーのcanApproveSignupsを持つ人だけ
	requiredRolePolicyOrModerator: 'canApproveSignups',
	// 審査したモデレーターが誰かを含むため、審査を待っている申請の一覧(read:admin:pending-signups)とは別のkindにする
	kind: 'read:admin:signup-approval-history',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			properties: {
				id: {
					type: 'string',
					optional: false, nullable: false,
					format: 'id',
				},
				createdAt: {
					type: 'string',
					optional: false, nullable: false,
					format: 'date-time',
				},
				username: {
					type: 'string',
					optional: false, nullable: true,
				},
				signupReason: {
					type: 'string',
					optional: false, nullable: true,
				},
				status: {
					type: 'string',
					optional: false, nullable: false,
					enum: signupApprovalHistoryStatuses,
				},
				reason: {
					type: 'string',
					optional: false, nullable: true,
				},
				reviewedAt: {
					type: 'string',
					optional: false, nullable: true,
					format: 'date-time',
				},
				reviewer: {
					type: 'object',
					optional: false, nullable: true,
					ref: 'UserLite',
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		state: { type: 'string', enum: signupApprovalHistoryStatuses, default: 'approved' },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.signupApprovalChecksRepository)
		private signupApprovalChecksRepository: SignupApprovalChecksRepository,

		private queryService: QueryService,
		private idService: IdService,
		private userEntityService: UserEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.queryService.makePaginationQuery(this.signupApprovalChecksRepository.createQueryBuilder('signupCheck'), ps.sinceId, ps.untilId)
				.andWhere('signupCheck.status = :status', { status: ps.state })
				.leftJoinAndSelect('signupCheck.reviewer', 'reviewer');

			const checks = await query.limit(ps.limit).getMany();

			const reviewers = await this.userEntityService.packMany(
				[...new Map(checks.flatMap(check => check.reviewer != null ? [[check.reviewer.id, check.reviewer] as const] : [])).values()],
				me,
				{ schema: 'UserLite' },
			);
			const reviewerMap = new Map(reviewers.map(reviewer => [reviewer.id, reviewer]));

			return checks.map(check => ({
				id: check.id,
				createdAt: this.idService.parse(check.id).date.toISOString(),
				username: check.username,
				signupReason: check.signupReason,
				status: check.status as typeof signupApprovalHistoryStatuses[number],
				reason: check.reason,
				reviewedAt: check.reviewedAt?.toISOString() ?? null,
				reviewer: check.reviewerId != null ? reviewerMap.get(check.reviewerId) ?? null : null,
			}));
		});
	}
}
