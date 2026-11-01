<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!-- misskey.art独自: 承認制の新規登録で申請を受け付けたときに、確認コードと一緒に出すダイアログ -->
<template>
<MkModal ref="modal" :preferType="'dialog'" :zPriority="'high'" @click="closeDialog()" @closed="emit('closed')" @esc="closeDialog()">
	<div :class="$style.root">
		<div :class="$style.icon">
			<MkSystemIcon :class="$style.iconInner" style="width: 45px;" type="success"/>
		</div>
		<header :class="$style.title" class="_selectable">{{ i18n.ts._signup.applicationReceived }}</header>
		<div :class="$style.text" class="_selectable">{{ text }}</div>
		<div :class="$style.codeRow">
			<div :class="$style.codeLabel">{{ i18n.ts._signupCheck.codeLabel }}</div>
			<div :class="$style.codeValue" class="_selectable">{{ code }}</div>
			<MkButton rounded inline @click="copy()"><i class="ti ti-copy"></i> {{ i18n.ts.copy }}</MkButton>
			<div :class="$style.codeCaption">{{ i18n.ts._signupCheck.codeCaption }}</div>
		</div>
		<div :class="$style.buttons">
			<MkButton inline rounded @click="checkStatus()">{{ i18n.ts._signupCheck.title }}</MkButton>
			<MkButton inline primary rounded autofocus @click="closeDialog()">{{ i18n.ts.gotIt }}</MkButton>
		</div>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import { useTemplateRef } from 'vue';
import MkModal from '@/components/MkModal.vue';
import MkButton from '@/components/MkButton.vue';
import { copyToClipboard } from '@/utility/copy-to-clipboard.js';
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';

const props = defineProps<{
	text: string;
	code: string;
}>();

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

const modal = useTemplateRef('modal');

function copy() {
	copyToClipboard(props.code);
}

// 審査状況の確認ページを、このダイアログからも開けるようにする
function checkStatus() {
	os.pageWindow('/signup-check');
	closeDialog();
}

function closeDialog() {
	modal.value?.close();
}
</script>

<style lang="scss" module>
.root {
	position: relative;
	margin: auto;
	padding: 32px;
	min-width: 320px;
	max-width: 480px;
	box-sizing: border-box;
	text-align: center;
	background: var(--MI_THEME-panel);
	border-radius: var(--MI-radius);
}

.icon {
	font-size: 24px;
}

.iconInner {
	display: block;
	margin: 0 auto;
}

.title {
	margin: 8px 0 0 0;
	font-weight: bold;
	font-size: 1.1em;
}

.text {
	margin: 16px 0 0 0;
}

.codeRow {
	margin: 16px 0 0 0;
	padding: 12px;
	border-radius: 8px;
	background: var(--MI_THEME-bg);
	border: 1px solid var(--MI_THEME-divider);
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
}

.codeLabel {
	font-size: 0.85em;
	opacity: 0.7;
}

.codeValue {
	font-family: monospace;
	word-break: break-all;
}

.codeCaption {
	font-size: 0.85em;
	opacity: 0.7;
}

.buttons {
	margin-top: 16px;
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
	justify-content: center;
}
</style>
