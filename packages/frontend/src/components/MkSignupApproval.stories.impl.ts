/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { action } from 'storybook/actions';
import { HttpResponse, http } from 'msw';
import { commonHandlers } from '../../.storybook/mocks.js';
import MkSignupApproval from './MkSignupApproval.vue';
import type { StoryObj } from '@storybook/vue3';
export const Default = {
	render(args) {
		return {
			components: {
				MkSignupApproval,
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
				events() {
					return {
						resolved: action('resolved'),
					};
				},
			},
			template: '<MkSignupApproval v-bind="props" v-on="events" />',
		};
	},
	args: {
		signup: {
			id: 'someuserid',
			createdAt: new Date().toISOString(),
			username: 'miskist',
			host: null,
			signupReason: 'イラストを描いています。作品を投稿したくて申請しました。',
		},
	},
	parameters: {
		layout: 'centered',
		msw: {
			handlers: [
				...commonHandlers,
				http.post('/api/admin/signup-approvals/approve', async ({ request }) => {
					action('POST /api/admin/signup-approvals/approve')(await request.json());
					return new HttpResponse(null, { status: 204 });
				}),
				http.post('/api/admin/signup-approvals/decline', async ({ request }) => {
					action('POST /api/admin/signup-approvals/decline')(await request.json());
					return new HttpResponse(null, { status: 204 });
				}),
			],
		},
	},
	decorators: [() => ({
		template: '<div style="width: 480px;"><story/></div>',
	})],
} satisfies StoryObj<typeof MkSignupApproval>;
