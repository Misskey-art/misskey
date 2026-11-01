/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { action } from 'storybook/actions';
import { HttpResponse, http } from 'msw';
import { commonHandlers } from '../../.storybook/mocks.js';
import MkSignupCheckForm from './MkSignupCheckForm.vue';
import type { StoryObj } from '@storybook/vue3';
export const Default = {
	render(args) {
		return {
			components: {
				MkSignupCheckForm,
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
			template: '<MkSignupCheckForm v-bind="props" />',
		};
	},
	args: {},
	parameters: {
		layout: 'centered',
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
	decorators: [() => ({
		template: '<div style="width: 480px;"><story/></div>',
	})],
} satisfies StoryObj<typeof MkSignupCheckForm>;
