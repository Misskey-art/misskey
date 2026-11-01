<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!-- misskey.art独自: 承認制の新規登録の審査状況を確かめるページ -->
<template>
<PageWithAnimBg>
	<div :class="$style.formContainer">
		<div :class="$style.form" class="_panel">
			<div :class="$style.banner">
				<i class="ti ti-checkup-list" aria-hidden="true"></i>
				<h1 :class="$style.title">{{ i18n.ts._signupCheck.title }}</h1>
			</div>
			<div style="padding: 32px;">
				<MkSignupCheckForm/>
			</div>
		</div>
	</div>
</PageWithAnimBg>
</template>

<script lang="ts" setup>
import MkSignupCheckForm from '@/components/MkSignupCheckForm.vue';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';

definePage(() => ({
	title: i18n.ts._signupCheck.title,
	icon: 'ti ti-checkup-list',
}));
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
	box-shadow: 0 8px 16px var(--MI_THEME-shadow);
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

.title {
	margin: 8px 0 0 0;
	font-size: 1rem;
	font-weight: bold;
}
</style>
