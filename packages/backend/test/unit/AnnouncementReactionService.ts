/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { describe, expect, beforeEach, afterEach, test, vi } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import { Test } from '@nestjs/testing';
import { GlobalModule } from '@/GlobalModule.js';
import { AnnouncementReactionService } from '@/core/AnnouncementReactionService.js';
import type {
	AnnouncementReactionsRepository,
	AnnouncementsRepository,
	MiAnnouncement,
	MiEmoji,
	MiUser,
	UsersRepository,
} from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { genAidx } from '@/misc/id/aidx.js';
import { IdService } from '@/core/IdService.js';
import { CustomEmojiService } from '@/core/CustomEmojiService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { ReactionService } from '@/core/ReactionService.js';
import { RoleService } from '@/core/RoleService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';
import type { TestingModule } from '@nestjs/testing';

describe('AnnouncementReactionService', () => {
	let app: TestingModule;
	let service: AnnouncementReactionService;
	let usersRepository: UsersRepository;
	let announcementsRepository: AnnouncementsRepository;
	let announcementReactionsRepository: AnnouncementReactionsRepository;
	let reactionTypeLimit: number;
	let localEmojis: Map<string, MiEmoji>;

	function createUser(data: Partial<MiUser> = {}) {
		const un = secureRndstr(16);
		return usersRepository.insert({
			id: genAidx(Date.now()),
			username: un,
			usernameLower: un.toLowerCase(),
			...data,
		})
			.then(x => usersRepository.findOneByOrFail(x.identifiers[0]));
	}

	function createAnnouncement(data: Partial<MiAnnouncement> = {}) {
		return announcementsRepository.insert({
			id: genAidx(Date.now()),
			updatedAt: null,
			title: 'Title',
			text: 'Text',
			...data,
		})
			.then(x => announcementsRepository.findOneByOrFail(x.identifiers[0]));
	}

	beforeEach(async () => {
		reactionTypeLimit = 20;
		localEmojis = new Map();

		app = await Test.createTestingModule({
			imports: [
				GlobalModule,
			],
			providers: [
				AnnouncementReactionService,
				IdService,
			],
		})
			.useMocker((token) => {
				if (token === RoleService) {
					return {
						getUserPolicies: vi.fn(async () => ({ announcementReactionTypeLimit: reactionTypeLimit })),
						getUserRoles: vi.fn(async () => []),
					};
				} else if (token === CustomEmojiService) {
					return {
						localEmojisCache: { fetch: vi.fn(async () => localEmojis) },
					};
				} else if (token === ReactionService) {
					return {
						normalize: vi.fn((reaction: string) => reaction),
						decodeReaction: vi.fn((reaction: string) => ({ reaction })),
					};
				} else if (token === UtilityService) {
					return {
						toPunyNullable: vi.fn((host: string | null) => host),
					};
				} else if (token === GlobalEventService) {
					return {
						publishBroadcastStream: vi.fn(),
					};
				} else if (typeof token === 'function') {
					return mockDeep<typeof token>();
				}
			})
			.compile();

		app.enableShutdownHooks();

		service = app.get<AnnouncementReactionService>(AnnouncementReactionService);
		usersRepository = app.get<UsersRepository>(DI.usersRepository);
		announcementsRepository = app.get<AnnouncementsRepository>(DI.announcementsRepository);
		announcementReactionsRepository = app.get<AnnouncementReactionsRepository>(DI.announcementReactionsRepository);
	});

	afterEach(async () => {
		await announcementReactionsRepository.createQueryBuilder().delete().execute();
		await Promise.all([
			usersRepository.createQueryBuilder().delete().execute(),
			announcementsRepository.createQueryBuilder().delete().execute(),
		]);

		await app.close();
	});

	describe('create', () => {
		test('同時に新しい種類を付けても種類数の上限を超えない', async () => {
			reactionTypeLimit = 3;
			const announcement = await createAnnouncement();
			const users = await Promise.all(Array.from({ length: 10 }, () => createUser()));

			const results = await Promise.allSettled(users.map((user, i) => service.create(user, announcement, `r${i}`)));

			expect(results.filter(r => r.status === 'fulfilled').length).toBe(3);
			for (const r of results) {
				if (r.status === 'rejected') expect(r.reason.id).toBe('dc1dd554-8eee-4558-a6d6-9b325b993dde');
			}
			expect(await announcementReactionsRepository.countBy({ announcementId: announcement.id })).toBe(3);
		});

		test('上限に達していても、既にある種類には付けられる', async () => {
			reactionTypeLimit = 1;
			const announcement = await createAnnouncement();
			const [alice, bob] = await Promise.all([createUser(), createUser()]);

			await service.create(alice, announcement, 'r');
			await service.create(bob, announcement, 'r');
			await expect(service.create(bob, announcement, 's')).rejects.toMatchObject({ id: 'dc1dd554-8eee-4558-a6d6-9b325b993dde' });
		});

		test('同じリアクションを重ねて付けるとALREADY_REACTEDになる', async () => {
			const announcement = await createAnnouncement();
			const user = await createUser();

			await service.create(user, announcement, 'r');
			await expect(service.create(user, announcement, 'r')).rejects.toMatchObject({ id: '0b0d5c9f-0c07-4f0e-8a3d-6f6a4a2b0a4f' });
		});
	});

	describe('delete', () => {
		test('付けた後にカスタム絵文字が消えても外せる', async () => {
			localEmojis.set('foo', { name: 'foo', roleIdsThatCanBeUsedThisEmojiAsReaction: [] } as unknown as MiEmoji);
			const announcement = await createAnnouncement();
			const user = await createUser();

			await service.create(user, announcement, ':foo:');
			expect(await announcementReactionsRepository.countBy({ announcementId: announcement.id, reaction: ':foo:' })).toBe(1);

			localEmojis.delete('foo');
			await service.delete(user, announcement, ':foo@.:');
			expect(await announcementReactionsRepository.countBy({ announcementId: announcement.id })).toBe(0);
		});

		test('使えないカスタム絵文字で付けた(FALLBACKで保存された)リアクションも、同じ文字列で外せる', async () => {
			const announcement = await createAnnouncement();
			const user = await createUser();

			await service.create(user, announcement, ':foo:');
			expect(await announcementReactionsRepository.countBy({ announcementId: announcement.id, reaction: '\u2764' })).toBe(1);

			await service.delete(user, announcement, ':foo@.:');
			expect(await announcementReactionsRepository.countBy({ announcementId: announcement.id })).toBe(0);
		});

		test('付けていないリアクションはNOT_REACTEDになる', async () => {
			const announcement = await createAnnouncement();
			const user = await createUser();

			await expect(service.delete(user, announcement, 'r')).rejects.toMatchObject({ id: '9f2b4d1e-3c8a-4b6f-9d0e-7a1c5b8e2f30' });
		});
	});
});
