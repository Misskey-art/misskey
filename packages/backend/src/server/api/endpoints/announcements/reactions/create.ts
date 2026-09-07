/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import type { AnnouncementsRepository } from '@/models/_.js';
import { AnnouncementReactionService } from '@/core/AnnouncementReactionService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['reactions', 'announcements'],

	requireCredential: true,

	prohibitMoved: true,

	kind: 'write:reactions',

	errors: {
		noSuchAnnouncement: {
			message: 'No such announcement.',
			code: 'NO_SUCH_ANNOUNCEMENT',
			id: '8cd3a0bb-4a35-47d7-9d4f-965bd3156879',
		},

		alreadyReacted: {
			message: 'You are already reacting to that announcement.',
			code: 'ALREADY_REACTED',
			id: '18aca5e1-b265-47b2-b40a-6cc0958fdeab',
		},

		reactionNotAllowed: {
			message: 'Reactions are not allowed on announcements addressed to a specific user.',
			code: 'REACTION_NOT_ALLOWED',
			id: '73336770-bf20-40a2-9cf0-11ac2a9b768a',
		},

		tooManyReactionTypes: {
			message: 'This announcement already has the maximum number of distinct reaction types.',
			code: 'TOO_MANY_REACTION_TYPES',
			id: '2d5069c9-59c8-4d70-8fa7-f923f8e7cf5b',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		announcementId: { type: 'string', format: 'misskey:id' },
		reaction: { type: 'string' },
	},
	required: ['announcementId', 'reaction'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.announcementsRepository)
		private announcementsRepository: AnnouncementsRepository,

		private announcementReactionService: AnnouncementReactionService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const announcement = await this.announcementsRepository.findOneBy({
				id: ps.announcementId,
				isActive: true,
			});

			if (announcement == null) {
				throw new ApiError(meta.errors.noSuchAnnouncement);
			}

			if (announcement.userId != null) {
				// ユーザー宛てのお知らせはリアクション自体を許可しない。本人以外には存在も知られてはいけないため404として扱う
				if (announcement.userId !== me.id) {
					throw new ApiError(meta.errors.noSuchAnnouncement);
				}
				throw new ApiError(meta.errors.reactionNotAllowed);
			}

			await this.announcementReactionService.create(me, announcement, ps.reaction).catch(err => {
				if (err.id === '0b0d5c9f-0c07-4f0e-8a3d-6f6a4a2b0a4f') throw new ApiError(meta.errors.alreadyReacted);
				if (err.id === 'dc1dd554-8eee-4558-a6d6-9b325b993dde') throw new ApiError(meta.errors.tooManyReactionTypes);
				throw err;
			});
		});
	}
}
