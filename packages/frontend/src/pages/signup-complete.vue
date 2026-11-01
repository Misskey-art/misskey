<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithAnimBg>
	<div :class="$style.formContainer">
		<form :class="$style.form" class="_panel" @submit.prevent="submit()">
			<div :class="$style.banner">
				<i class="ti ti-user-check"></i>
			</div>
			<div class="_gaps_m" style="padding: 32px;">
				<template v-if="pendingApproval">
					<!-- misskey.art独自: 承認制の新規登録で申請を受け付けた後は、審査状況の確認ページへ案内する -->
					<div>{{ i18n.ts._signup.applicationReceived }}</div>
					<div>{{ i18n.ts._signup.pendingApproval }}</div>
					<div>
						<MkButton gradate large rounded type="routerLink" to="/signup-check" style="margin: 0 auto;">{{ i18n.ts._signupCheck.title }}</MkButton>
					</div>
				</template>
				<template v-else>
					<div>{{ i18n.tsx.clickToFinishEmailVerification({ ok: i18n.ts.gotIt }) }}</div>
					<div>
						<MkButton gradate large rounded type="submit" :disabled="submitting" data-testid="admin-ok" style="margin: 0 auto;">
							{{ submitting ? i18n.ts.processing : i18n.ts.gotIt }}<MkEllipsis v-if="submitting"/>
						</MkButton>
					</div>
				</template>
			</div>
		</form>
	</div>
</PageWithAnimBg>
</template>

<script lang="ts" setup>
import { ref, defineAsyncComponent } from 'vue';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { login } from '@/accounts.js';
import { addSignupApprovalCheckCode } from '@/utility/signup-approval-check-codes.js';

const submitting = ref(false);
// misskey.art独自: 承認制の新規登録で、申請を受け付けた後(もう一度送っても失敗するだけなので、送るボタンの代わりに審査状況の確認へ案内する)
const pendingApproval = ref(false);

const props = defineProps<{
	code: string;
}>();

function submit() {
	if (submitting.value || pendingApproval.value) return;
	submitting.value = true;

	misskeyApi('signup-pending', {
		code: props.code,
	}).then(res => {
		// misskey.art独自: 承認制の新規登録では、サインインせずに確認コードを受け取る。
		// コードをこの端末に保存し、/signup-check でいつでも審査状況を確かめられるようにする
		if ('pendingApproval' in res) {
			submitting.value = false;
			pendingApproval.value = true;
			addSignupApprovalCheckCode(res.checkCode);
			const { dispose } = os.popup(defineAsyncComponent(() => import('@/components/MkSignupApprovalPendingDialog.vue')), {
				text: i18n.ts._signup.pendingApproval,
				code: res.checkCode,
			}, {
				closed: () => dispose(),
			});
			return;
		}

		return login(res.i, '/');
	}).catch(() => {
		submitting.value = false;

		os.alert({
			type: 'error',
			title: i18n.ts.somethingHappened,
			text: i18n.ts.emailVerificationFailedError,
		});
	});
}
</script>

<style lang="scss" module>
.formContainer {
	min-height: 100svh;
	padding: 32px 32px 64px 32px;
	box-sizing: border-box;
	display: grid;
	place-content: center;
}

.form {
	position: relative;
	z-index: 10;
	border-radius: var(--MI-radius);
	box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
	overflow: clip;
	max-width: 500px;
}

.banner {
	padding: 16px;
	text-align: center;
	font-size: 26px;
	background-color: var(--MI_THEME-accentedBg);
	color: var(--MI_THEME-accent);
}
</style>
