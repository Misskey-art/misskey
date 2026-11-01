/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { action } from 'storybook/actions';
import MkSignupApprovalPendingDialog from './MkSignupApprovalPendingDialog.vue';
import type { StoryObj } from '@storybook/vue3';
import { i18n } from '@/i18n.js';
export const Default = {
	render(args) {
		return {
			components: {
				MkSignupApprovalPendingDialog,
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
			template: '<MkSignupApprovalPendingDialog v-bind="props" v-on="events" />',
		};
	},
	args: {
		text: i18n.ts._signup.pendingApprovalNoEmail,
		code: 'abcdefghijklmnopqrstuvwxyzabcdef',
	},
	parameters: {
		layout: 'centered',
	},
} satisfies StoryObj<typeof MkSignupApprovalPendingDialog>;
