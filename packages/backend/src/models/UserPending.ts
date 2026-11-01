/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { PrimaryColumn, Entity, Index, Column } from 'typeorm';
import { id } from './util/id.js';

@Entity('user_pending')
export class MiUserPending {
	@PrimaryColumn(id())
	public id: string;

	@Index({ unique: true })
	@Column('varchar', {
		length: 128,
	})
	public code: string;

	@Column('varchar', {
		length: 128,
	})
	public username: string;

	@Column('varchar', {
		length: 128,
	})
	public email: string;

	@Column('varchar', {
		length: 128,
	})
	public password: string;

	// misskey.art独自: 承認制の新規登録で、申請者が書いた登録の理由(メールアドレスの確認が済んでアカウントを作るときに使う)
	@Column('text', {
		nullable: true,
	})
	public reason: string | null;
}
