/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { UserProfilesRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { RoleService } from '@/core/RoleService.js';

export const meta = {
	requireCredential: false,

	res: {
		type: 'array',
		items: {
			ref: 'Achievement',
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
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		private roleService: RoleService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// misskey.art独自: 承認を待っているアカウントは、モデレーター以外には無いアカウント(findOneOrFailが投げる)と同じに見せる
			const profile = await this.roleService.isModerator(me)
				? await this.userProfilesRepository.findOneByOrFail({ userId: ps.userId })
				: await this.userProfilesRepository.findOneOrFail({ where: { userId: ps.userId, user: { approved: true } } });

			return profile.achievements;
		});
	}
}
