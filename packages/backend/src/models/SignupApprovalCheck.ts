/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';

export const signupApprovalCheckStatuses = ['pending', 'approved', 'declined'] as const;

/**
 * misskey.art独自: 承認制の新規登録で、メールアドレスを登録していない申請者でも
 * 審査の結果を後から確かめられるようにするための確認コード。
 * 却下したときはユーザーの行ごと消すため、このレコードはユーザーとは別に残す。
 * misskey-juiceの同じ機能から移植した
 */
@Entity('signup_approval_check')
export class MiSignupApprovalCheck {
	@PrimaryColumn(id())
	public id: string;

	@Index({ unique: true })
	@Column('varchar', {
		length: 64,
		comment: 'The secret code given to the applicant to check their approval status.',
	})
	public code: string;

	@ManyToOne(() => MiUser, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public user: MiUser | null;

	@Index()
	@Column({
		...id(),
		nullable: true,
	})
	public userId: MiUser['id'] | null;

	@Column('varchar', {
		length: 16,
		default: 'pending',
		comment: 'The approval status of this signup application: pending, approved, or declined.',
	})
	public status: typeof signupApprovalCheckStatuses[number];

	@Column('text', {
		nullable: true,
		comment: 'The reason for declining this signup application, if declined.',
	})
	public reason: string | null;

	// 却下したときはuserIdがNULLになる(SET NULL)ため、履歴に出せるようにユーザー名を写して残す
	@Column('varchar', {
		length: 128,
		nullable: true,
		comment: 'A snapshot of the applicant username at the time of application, since the user row may be deleted later.',
	})
	public username: string | null;

	// 却下したときはuser.signupReasonごと消えるため、履歴に出せるように申請の理由を写して残す
	@Column('text', {
		nullable: true,
		comment: 'A snapshot of the applicant-submitted signup reason at the time of application.',
	})
	public signupReason: string | null;

	@Index()
	@Column({
		...id(),
		nullable: true,
		comment: 'The ID of the moderator/admin who reviewed this signup application.',
	})
	public reviewerId: MiUser['id'] | null;

	@ManyToOne(() => MiUser, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public reviewer: MiUser | null;

	@Column('timestamp with time zone', {
		nullable: true,
	})
	public reviewedAt: Date | null;
}
