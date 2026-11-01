<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!-- misskey.art独自: 審査を待っている新規登録の申請1件 -->
<template>
<MkFolder>
	<template #icon><i class="ti ti-user-question"></i></template>
	<template #label>@{{ signup.username }}{{ signup.host ? `@${signup.host}` : '' }}</template>
	<template #suffix><MkTime :time="signup.createdAt"/></template>
	<template #footer>
		<div class="_buttons">
			<MkButton primary @click="approve"><i class="ti ti-check"></i> {{ i18n.ts._signupApprovals.approve }}</MkButton>
			<MkButton danger @click="decline"><i class="ti ti-x"></i> {{ i18n.ts._signupApprovals.decline }}</MkButton>
		</div>
	</template>

	<div class="_gaps_s">
		<div>{{ i18n.ts._signupApprovals.reason }}</div>
		<div class="_selectable" :class="$style.reason">{{ signup.signupReason ?? i18n.ts.none }}</div>
	</div>
</MkFolder>
</template>

<script lang="ts" setup>
import * as Misskey from 'misskey-js';
import MkButton from '@/components/MkButton.vue';
import MkFolder from '@/components/MkFolder.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';

const props = defineProps<{
	signup: Misskey.entities.AdminSignupApprovalsPendingResponse[number];
}>();

const emit = defineEmits<{
	(ev: 'resolved', userId: string): void;
}>();

async function approve() {
	const { canceled } = await os.confirm({
		type: 'question',
		text: i18n.tsx._signupApprovals.approveConfirm({ username: props.signup.username }),
	});
	if (canceled) return;

	os.apiWithDialog('admin/signup-approvals/approve', {
		userId: props.signup.id,
	}).then(() => {
		emit('resolved', props.signup.id);
	});
}

async function decline() {
	// 却下するとアカウントは消える(取り消せない)ため、理由を聞くときに一緒に知らせる
	const { canceled, result: reason } = await os.inputText({
		title: i18n.ts._signupApprovals.declineReasonTitle,
		text: i18n.tsx._signupApprovals.declineWarning({ username: props.signup.username }),
		minLength: 1,
		maxLength: 1024,
	});
	if (canceled || reason.trim() === '') return;

	os.apiWithDialog('admin/signup-approvals/decline', {
		userId: props.signup.id,
		reason,
	}).then(() => {
		emit('resolved', props.signup.id);
	});
}
</script>

<style lang="scss" module>
.reason {
	white-space: pre-wrap;
	word-break: break-word;
}
</style>
