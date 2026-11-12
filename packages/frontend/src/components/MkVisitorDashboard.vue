<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="instance" :class="$style.root">
	<div :class="[$style.main, $style.panel]">
		<img :src="instance.iconUrl || '/favicon.ico'" alt="" :class="$style.mainIcon"/>
		<button class="_button _acrylic" :class="$style.mainMenu" @click="showMenu"><i class="ti ti-dots"></i></button>
		<div :class="$style.mainFg">
			<h1 :class="$style.mainTitle">
				<!-- 背景色によってはロゴが見えなくなるのでとりあえず無効に -->
				<!-- <img class="logo" v-if="instance.logoImageUrl" :src="instance.logoImageUrl"><span v-else class="text">{{ instanceName }}</span> -->
				<MkA to="/">{{ instanceName }}</MkA>
			</h1>
			<div :class="$style.mainAbout">
				<!-- eslint-disable-next-line vue/no-v-html -->
				<div v-html="instance.description || i18n.ts.headlineMisskey"></div>
			</div>
			<div v-if="instance.disableRegistration || instance.approvalRequiredForSignup || instance.federation !== 'all'" :class="$style.mainWarn" class="_gaps_s">
				<!-- misskey.art独自: 承認制の新規登録がオンなら、招待コードが無くても申請できるので、招待制の案内の代わりに承認制の案内を出す -->
				<MkInfo v-if="instance.disableRegistration && !instance.approvalRequiredForSignup" warn>{{ i18n.ts.invitationRequiredToRegister }}</MkInfo>
				<MkInfo v-if="instance.approvalRequiredForSignup" warn>{{ i18n.ts._signup.approvalNotice }}</MkInfo>
				<MkInfo v-if="instance.federation === 'specified'" warn>{{ i18n.ts.federationSpecified }}</MkInfo>
				<MkInfo v-else-if="instance.federation === 'none'" warn>{{ i18n.ts.federationDisabled }}</MkInfo>
			</div>
			<div class="_gaps_s" :class="$style.mainActions">
				<!-- misskey.art独自: 承認制の新規登録がオンなら、登録のボタンを「参加を申請する」にする -->
				<MkButton :class="$style.mainAction" full rounded gradate data-testid="signup" style="margin-right: 12px;" @click="signup()">{{ instance.approvalRequiredForSignup ? i18n.ts._signup.applyToJoin : i18n.ts.joinThisServer }}<span v-if="instance.approvalRequiredForSignup" class="_art" :class="$style.artOnGradate">ART</span></MkButton>
				<MkButton :class="$style.mainAction" full rounded type="a" target="_blank" rel="noopener" href="https://misskey-hub.net/servers/">{{ i18n.ts.exploreOtherServers }}</MkButton>
				<MkButton :class="$style.mainAction" full rounded data-testid="signin" @click="signin()">{{ i18n.ts.login }}</MkButton>
			</div>
			<!-- misskey.art独自: 申請した人が、審査状況を確かめられるようにする -->
			<div v-if="instance.approvalRequiredForSignup" :class="$style.mainSignupCheck">
				<MkButton :class="$style.mainAction" full rounded data-testid="signup-check" @click="openSignupCheck()">{{ i18n.ts._signupCheck.title }}<span class="_art">ART</span></MkButton>
			</div>
		</div>
	</div>
	<div v-if="stats && instance.clientOptions.showActivitiesForVisitor !== false" :class="$style.stats">
		<div :class="[$style.statsItem, $style.panel]">
			<div :class="$style.statsItemLabel">{{ i18n.ts.users }}</div>
			<div :class="$style.statsItemCount"><MkNumber :value="stats.originalUsersCount"/></div>
		</div>
		<div :class="[$style.statsItem, $style.panel]">
			<div :class="$style.statsItemLabel">{{ i18n.ts.notes }}</div>
			<div :class="$style.statsItemCount"><MkNumber :value="stats.originalNotesCount"/></div>
		</div>
	</div>
	<div v-if="instance.policies.ltlAvailable && instance.clientOptions.showTimelineForVisitor !== false" :class="[$style.tl, $style.panel]">
		<div :class="$style.tlHeader">{{ i18n.ts.letsLookAtTimeline }}</div>
		<div :class="$style.tlBody">
			<MkStreamingNotesTimeline src="local"/>
		</div>
	</div>
	<div v-if="instance.clientOptions.showActivitiesForVisitor !== false" :class="$style.panel">
		<XActiveUsersChart/>
	</div>
</div>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, ref } from 'vue';
import * as Misskey from 'misskey-js';
import { instanceName } from '@@/js/config.js';
import MkButton from '@/components/MkButton.vue';
import MkStreamingNotesTimeline from '@/components/MkStreamingNotesTimeline.vue';
import MkInfo from '@/components/MkInfo.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { instance } from '@/instance.js';
import MkNumber from '@/components/MkNumber.vue';
import { openInstanceMenu } from '@/ui/_common_/common.js';

const XActiveUsersChart = defineAsyncComponent(() => import('@/components/MkVisitorDashboard.ActiveUsersChart.vue'));

const stats = ref<Misskey.entities.StatsResponse | null>(null);

if (instance.clientOptions.showActivitiesForVisitor !== false) {
	misskeyApi('stats', {}).then((res) => {
		stats.value = res;
	});
}

async function signin() {
	const { dispose } = await os.popupAsyncWithDialog(import('@/components/MkSigninDialog.vue').then((x) => x.default), {
		autoSet: true,
	}, {
		closed: () => dispose(),
	});
}

async function signup() {
	const { dispose } = await os.popupAsyncWithDialog(import('@/components/MkSignupDialog.vue').then((x) => x.default), {
		autoSet: true,
	}, {
		closed: () => dispose(),
	});
}

function openSignupCheck() {
	const { dispose } = os.popup(defineAsyncComponent(() => import('@/components/MkSignupCheckPanel.vue')), {}, {
		closed: () => dispose(),
	});
}

function showMenu(ev: PointerEvent) {
	openInstanceMenu(ev);
}
</script>

<style lang="scss" module>
.root {
	position: relative;
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 32px 0 0 0;
}

.panel {
	position: relative;
	background: var(--MI_THEME-panel);
	border-radius: var(--MI-radius);
	box-shadow: 0 12px 32px rgb(0 0 0 / 25%);
}

.main {
	text-align: center;
}

.mainIcon {
	width: 85px;
	margin-top: -47px;
	vertical-align: bottom;
	filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.5));
}

.mainMenu {
	position: absolute;
	top: 16px;
	right: 16px;
	width: 32px;
	height: 32px;
	border-radius: 8px;
	font-size: 18px;
	z-index: 50;
}

.mainFg {
	position: relative;
	z-index: 1;
}

.mainTitle {
	display: block;
	margin: 0;
	padding: 16px 32px 24px 32px;
	font-size: 1.4em;
}

.mainLogo {
	vertical-align: bottom;
	max-height: 120px;
	max-width: min(100%, 300px);
}

.mainAbout {
	padding: 0 32px;
}

.mainWarn {
	padding: 32px 32px 0 32px;
}

.mainActions {
	padding: 32px;
}

.mainAction {
	line-height: 28px;
}

/* misskey.art独自: 色の付いたボタン(gradate)の上のARTバッジは、ボタンの文字の色で塗りつぶして、ボタンの色の字にする(ボタンの色によっては、紫の枠が見えにくいため) */
.artOnGradate.artOnGradate {
	color: var(--MI_THEME-accent);
	background: var(--MI_THEME-fgOnAccent);
	border-color: var(--MI_THEME-fgOnAccent);
}

.mainSignupCheck {
	padding: 0 32px 32px 32px;
}

.stats {
	display: grid;
	grid-template-columns: 1fr 1fr;
	grid-gap: 16px;
}

.statsItem {
	overflow: clip;
	padding: 16px 20px;
}

.statsItemLabel {
	color: color(from var(--MI_THEME-fg) srgb r g b / 0.75);
	font-size: 0.9em;
}

.statsItemCount {
	font-weight: bold;
	font-size: 1.2em;
	color: var(--MI_THEME-accent);
}

.tl {
	overflow: clip;
}

.tlHeader {
	padding: 12px 16px;
	border-bottom: solid 1px var(--MI_THEME-divider);
}

.tlBody {
	height: 350px;
	overflow: auto;
}
</style>
