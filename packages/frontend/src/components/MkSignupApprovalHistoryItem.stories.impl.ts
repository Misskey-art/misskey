/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { userLite } from '../../.storybook/fakes.js';
import MkSignupApprovalHistoryItem from './MkSignupApprovalHistoryItem.vue';
import type { StoryObj } from '@storybook/vue3';
export const Approved = {
	render(args) {
		return {
			components: {
				MkSignupApprovalHistoryItem,
			},
			setup() {
				return {
					args,
				};
			},
			computed: {
				props() {
					return {
						...this.args,
					};
				},
			},
			template: '<MkSignupApprovalHistoryItem v-bind="props" />',
		};
	},
	args: {
		entry: {
			id: 'somecheckid',
			createdAt: new Date().toISOString(),
			username: 'miskist',
			signupReason: 'イラストを描いています。作品を投稿したくて申請しました。',
			status: 'approved',
			reason: null,
			reviewedAt: new Date().toISOString(),
			reviewer: userLite('somemoderatorid', 'moderator', null, 'Moderator'),
		},
	},
	parameters: {
		layout: 'centered',
	},
	decorators: [() => ({
		template: '<div style="width: 480px;"><story/></div>',
	})],
} satisfies StoryObj<typeof MkSignupApprovalHistoryItem>;
export const Declined = {
	...Approved,
	args: {
		entry: {
			...Approved.args.entry,
			status: 'declined',
			reason: '登録の理由が書かれていなかったため。',
		},
	},
} satisfies StoryObj<typeof MkSignupApprovalHistoryItem>;
