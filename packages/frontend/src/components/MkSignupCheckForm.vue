<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!-- misskey.art独自: 承認制の新規登録の審査状況を、確認コードで確かめるフォーム -->
<template>
<div class="_gaps_m">
	<div>{{ i18n.ts._signupCheck.description }}</div>

	<div v-if="entries.length > 0" class="_gaps_s">
		<div v-for="entry in entries" :key="entry.code" :class="$style.entry">
			<div :class="$style.entryHeader">
				<span :class="$style.entryCode" class="_selectable">{{ entry.code }}</span>
				<button class="_button" :class="$style.entryRemove" :title="i18n.ts.remove" :aria-label="i18n.ts.remove" @click="removeEntry(entry.code)"><i class="ti ti-x"></i></button>
			</div>
			<div aria-live="polite">
				<MkLoading v-if="entry.checking" mini/>
				<template v-else>
					<MkInfo v-if="entry.status === 'pending'" warn>{{ i18n.ts._signupCheck.statusPending }}</MkInfo>
					<MkInfo v-else-if="entry.status === 'approved'">
						{{ i18n.ts._signupCheck.statusApproved }}
						<MkButton style="margin-top: 8px;" @click="openSignin()">{{ i18n.ts._signupCheck.goToSignin }}</MkButton>
					</MkInfo>
					<MkInfo v-else-if="entry.status === 'declined'" warn>
						{{ i18n.ts._signupCheck.statusDeclined }}
						<div v-if="entry.reason" class="_selectable" style="margin-top: 4px;">{{ i18n.ts._signupCheck.declineReason }}: {{ entry.reason }}</div>
					</MkInfo>
					<MkInfo v-else-if="entry.status === 'notFound'" warn>{{ i18n.ts._signupCheck.statusNotFound }}</MkInfo>
					<MkInfo v-else-if="entry.status === 'error'" warn>{{ errorText(entry.errorCode) }}</MkInfo>
				</template>
			</div>
		</div>
	</div>

	<FormSection>
		<template #label>{{ i18n.ts._signupCheck.addCode }}</template>
		<form class="_gaps_s" @submit.prevent="addAndCheck()">
			<MkInput v-model="newCode" type="text" :spellcheck="false">
				<template #label>{{ i18n.ts._signupCheck.codeLabel }}</template>
				<template #prefix><i class="ti ti-key"></i></template>
			</MkInput>
			<MkCaptcha v-if="instance.enableHcaptcha" ref="hcaptcha" v-model="hCaptchaResponse" provider="hcaptcha" :sitekey="instance.hcaptchaSiteKey"/>
			<MkCaptcha v-if="instance.enableMcaptcha" ref="mcaptcha" v-model="mCaptchaResponse" provider="mcaptcha" :sitekey="instance.mcaptchaSiteKey" :instanceUrl="instance.mcaptchaInstanceUrl"/>
			<MkCaptcha v-if="instance.enableRecaptcha" ref="recaptcha" v-model="reCaptchaResponse" provider="recaptcha" :sitekey="instance.recaptchaSiteKey"/>
			<MkCaptcha v-if="instance.enableTurnstile" ref="turnstile" v-model="turnstileResponse" provider="turnstile" :sitekey="instance.turnstileSiteKey"/>
			<MkCaptcha v-if="instance.enableTestcaptcha" ref="testcaptcha" v-model="testcaptchaResponse" provider="testcaptcha" :sitekey="null"/>
			<MkButton type="submit" gradate large rounded :disabled="shouldDisableAdding" style="margin: 0 auto;">
				<template v-if="adding">{{ i18n.ts.processing }}<MkEllipsis/></template>
				<template v-else>{{ i18n.ts._signupCheck.check }}</template>
			</MkButton>
		</form>
	</FormSection>
</div>
</template>

<script lang="ts" setup>
import { computed, ref, onMounted } from 'vue';
import type { Captcha } from '@/components/MkCaptcha.vue';
import FormSection from '@/components/form/section.vue';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkCaptcha from '@/components/MkCaptcha.vue';
import XSigninDialog from '@/components/MkSigninDialog.vue';
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';
import { instance } from '@/instance.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { addSignupApprovalCheckCode, getSignupApprovalCheckCodes, removeSignupApprovalCheckCode } from '@/utility/signup-approval-check-codes.js';

type Status = 'pending' | 'approved' | 'declined' | 'notFound' | 'error';

type Entry = {
	code: string;
	status: Status | null;
	reason: string | null;
	errorCode: string | null;
	checking: boolean;
};

type CheckResult = {
	status: Status;
	reason: string | null;
	errorCode: string | null;
};

const entries = ref<Entry[]>([]);
const newCode = ref('');
const adding = ref(false);

// captchaは、新しいコードを追加するときだけ求める(この端末に保存したコードを確かめ直すときは求めない)
const hcaptcha = ref<Captcha | undefined>();
const mcaptcha = ref<Captcha | undefined>();
const recaptcha = ref<Captcha | undefined>();
const turnstile = ref<Captcha | undefined>();
const testcaptcha = ref<Captcha | undefined>();
const hCaptchaResponse = ref<string | null>(null);
const mCaptchaResponse = ref<string | null>(null);
const reCaptchaResponse = ref<string | null>(null);
const turnstileResponse = ref<string | null>(null);
const testcaptchaResponse = ref<string | null>(null);

const shouldDisableAdding = computed((): boolean => {
	return adding.value || newCode.value.trim() === '' ||
		instance.enableHcaptcha && !hCaptchaResponse.value ||
		instance.enableMcaptcha && !mCaptchaResponse.value ||
		instance.enableRecaptcha && !reCaptchaResponse.value ||
		instance.enableTurnstile && !turnstileResponse.value ||
		instance.enableTestcaptcha && !testcaptchaResponse.value;
});

function resetCaptchas() {
	hcaptcha.value?.reset?.();
	mcaptcha.value?.reset?.();
	recaptcha.value?.reset?.();
	turnstile.value?.reset?.();
	testcaptcha.value?.reset?.();
}

// 保存したコードをまとめて確かめ直すとき、通信エラーのたびにダイアログが重ならないよう、
// ここでは例外を投げずに'error'として返し、それぞれの欄に出す
async function checkStatus(code: string, isNewSubmission = false): Promise<CheckResult> {
	try {
		const res = await misskeyApi('signup-check-status', {
			code,
			isNewSubmission,
			'hcaptcha-response': isNewSubmission ? hCaptchaResponse.value : undefined,
			'm-captcha-response': isNewSubmission ? mCaptchaResponse.value : undefined,
			'g-recaptcha-response': isNewSubmission ? reCaptchaResponse.value : undefined,
			'turnstile-response': isNewSubmission ? turnstileResponse.value : undefined,
			'testcaptcha-response': isNewSubmission ? testcaptchaResponse.value : undefined,
		});
		return { status: res.status, reason: res.reason, errorCode: null };
	} catch (err) {
		const errorCode = typeof err === 'object' && err != null && 'code' in err && typeof err.code === 'string' ? err.code : null;
		return { status: 'error', reason: null, errorCode };
	}
}

// 回数の制限やcaptchaの失敗は、何をすればよいか分かるよう、それぞれの文言を出す
function errorText(errorCode: string | null): string {
	switch (errorCode) {
		case 'RATE_LIMIT_EXCEEDED': return i18n.ts._signupCheck.rateLimitExceeded;
		case 'CAPTCHA_FAILED': return i18n.ts._signupCheck.captchaFailed;
		default: return i18n.ts.somethingHappened;
	}
}

// pleaseLogin()は、ほかのアカウントでサインインしていると何もしないため、サインインのダイアログを直接開く
function openSignin() {
	const { dispose } = os.popup(XSigninDialog, {
		autoSet: true,
	}, {
		closed: () => dispose(),
	});
}

async function refreshEntry(entry: Entry) {
	entry.checking = true;
	const { status, reason, errorCode } = await checkStatus(entry.code);
	entry.status = status;
	entry.reason = reason;
	entry.errorCode = errorCode;
	entry.checking = false;
}

function removeEntry(code: string) {
	removeSignupApprovalCheckCode(code);
	entries.value = entries.value.filter(entry => entry.code !== code);
}

async function addAndCheck() {
	if (shouldDisableAdding.value) return;
	const code = newCode.value.trim();
	adding.value = true;

	const { status, reason, errorCode } = await checkStatus(code, true);

	if (status === 'error') {
		os.alert({
			type: 'error',
			text: errorText(errorCode),
		});
	} else if (status === 'notFound') {
		// 見つからなかったコードは保存しない(打ち間違えたコードが一覧に残らないように)
		os.alert({
			type: 'warning',
			text: i18n.ts._signupCheck.statusNotFound,
		});
	} else {
		addSignupApprovalCheckCode(code);
		const existing = entries.value.find(entry => entry.code === code);
		if (existing) {
			existing.status = status;
			existing.reason = reason;
			existing.errorCode = null;
		} else {
			entries.value.unshift({ code, status, reason, errorCode: null, checking: false });
		}
		newCode.value = '';
	}

	// captchaのトークンは1回しか使えないため、結果に関係なく次に備えてリセットする
	resetCaptchas();
	adding.value = false;
}

onMounted(() => {
	entries.value = getSignupApprovalCheckCodes().map(code => ({ code, status: null, reason: null, errorCode: null, checking: false }));
	for (const entry of entries.value) {
		refreshEntry(entry);
	}
});
</script>

<style lang="scss" module>
.entry {
	padding: 12px;
	border-radius: 8px;
	background: var(--MI_THEME-bg);
	border: 1px solid var(--MI_THEME-divider);
}

.entryHeader {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 8px;
}

.entryCode {
	flex: 1;
	font-family: monospace;
	word-break: break-all;
}

.entryRemove {
	width: 24px;
	height: 24px;
	display: flex;
	align-items: center;
	justify-content: center;
	opacity: 0.7;

	&:hover {
		opacity: 1;
	}
}
</style>
