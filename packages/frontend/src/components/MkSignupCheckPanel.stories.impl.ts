/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { action } from 'storybook/actions';
import { HttpResponse, http } from 'msw';
import { commonHandlers } from '../../.storybook/mocks.js';
import MkSignupCheckPanel from './MkSignupCheckPanel.vue';
import type { StoryObj } from '@storybook/vue3';
export const Default = {
	render(args) {
		return {
			components: {
				MkSignupCheckPanel,
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
						closed: action('closed'),
					};
				},
			},
			template: '<MkSignupCheckPanel v-bind="props" v-on="events" />',
		};
	},
	args: {},
	parameters: {
		layout: 'fullscreen',
		msw: {
			handlers: [
				...commonHandlers,
				http.post('/api/signup-check-status', async ({ request }) => {
					action('POST /api/signup-check-status')(await request.json());
					return HttpResponse.json({ status: 'pending', reason: null });
				}),
			],
		},
	},
} satisfies StoryObj<typeof MkSignupCheckPanel>;
