<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModalWindow
	ref="dialog"
	:width="500"
	:height="600"
	@close="onClose"
	@closed="emit('closed')"
>
	<template #header>{{ headerText }}</template>

	<div style="overflow-x: clip;">
		<Transition
			mode="out-in"
			:enterActiveClass="$style.transition_x_enterActive"
			:leaveActiveClass="$style.transition_x_leaveActive"
			:enterFromClass="$style.transition_x_enterFrom"
			:leaveToClass="$style.transition_x_leaveTo"
		>
			<template v-if="!isAcceptedServerRule">
				<XServerRules @done="isAcceptedServerRule = true" @cancel="onClose"/>
			</template>
			<template v-else>
				<XSignup :autoSet="autoSet" @signup="onSignup" @signupEmailPending="onSignupEmailPending" @signupPendingApproval="onSignupPendingApproval"/>
			</template>
		</Transition>
	</div>
</MkModalWindow>
</template>

<script lang="ts" setup>
import { useTemplateRef, ref, computed } from 'vue';
import * as Misskey from 'misskey-js';
import XSignup from '@/components/MkSignupDialog.form.vue';
import XServerRules from '@/components/MkSignupDialog.rules.vue';
import MkModalWindow from '@/components/MkModalWindow.vue';
import { i18n } from '@/i18n.js';
import { instance } from '@/instance.js';

const props = withDefaults(defineProps<{
	autoSet?: boolean;
}>(), {
	autoSet: false,
});

const emit = defineEmits<{
	(ev: 'done', res: Misskey.entities.SignupSuccessResponse): void;
	(ev: 'cancelled'): void;
	(ev: 'closed'): void;
}>();

const dialog = useTemplateRef('dialog');

// misskey.art独自: 承認制の新規登録では、登録ではなく参加の申請になる
const headerText = computed(() => instance.approvalRequiredForSignup ? i18n.ts._signup.applicationTitle : i18n.ts.signup);

const isAcceptedServerRule = ref(false);

function onClose() {
	emit('cancelled');
	dialog.value?.close();
}

function onSignup(res: Misskey.entities.SignupSuccessResponse) {
	emit('done', res);
	dialog.value?.close();
}

function onSignupEmailPending() {
	dialog.value?.close();
}

// misskey.art独自: 承認を待つアカウントはまだ使えないので、アカウントの追加はしない(キャンセル扱い)
function onSignupPendingApproval() {
	emit('cancelled');
	dialog.value?.close();
}
</script>

<style lang="scss" module>
.transition_x_enterActive,
.transition_x_leaveActive {
	transition: opacity 0.3s cubic-bezier(0,0,.35,1), transform 0.3s cubic-bezier(0,0,.35,1);
}
.transition_x_enterFrom {
	opacity: 0;
	transform: translateX(50px);
}
.transition_x_leaveTo {
	opacity: 0;
	transform: translateX(-50px);
}
</style>
