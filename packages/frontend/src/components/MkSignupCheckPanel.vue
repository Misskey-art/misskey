<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!-- misskey.art独自: エントランスから開く、審査状況の確認のサイドパネル -->
<template>
<Transition
	:enterActiveClass="prefer.s.animation ? $style.transition_x_enterActive : ''"
	:leaveActiveClass="prefer.s.animation ? $style.transition_x_leaveActive : ''"
	:enterFromClass="prefer.s.animation ? $style.transition_x_enterFrom : ''"
	:leaveToClass="prefer.s.animation ? $style.transition_x_leaveTo : ''"
	:duration="300" appear @afterLeave="emit('closed')"
>
	<div v-show="showing" v-hotkey="keymap" :class="$style.root" :style="{ zIndex }">
		<div :class="$style.bg" :style="{ zIndex }" @click="closePanel()"></div>
		<div :class="$style.content" :style="{ zIndex }" role="dialog" aria-modal="true" :aria-labelledby="titleId">
			<div :class="$style.header">
				<button ref="closeButton" :class="$style.close" class="_button" :aria-label="i18n.ts.close" @click="closePanel()"><i class="ti ti-x"></i></button>
				<h1 :id="titleId" :class="$style.title">{{ i18n.ts._signupCheck.title }}</h1>
				<div :class="$style.spacer"></div>
			</div>
			<div :class="$style.body">
				<MkSignupCheckForm/>
			</div>
		</div>
	</div>
</Transition>
</template>

<script lang="ts" setup>
import { onMounted, ref, useId, useTemplateRef } from 'vue';
import type { Keymap } from '@/utility/hotkey.js';
import MkSignupCheckForm from '@/components/MkSignupCheckForm.vue';
import { i18n } from '@/i18n.js';
import { claimZIndex } from '@/os.js';
import { prefer } from '@/preferences.js';

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

// 'low'にしておく。ここから開くログインのダイアログやエラーのダイアログは後から(同じかより高い優先度で)z-indexを取るので、このパネルより手前に出る
const zIndex = claimZIndex('low');
const showing = ref(true);
const titleId = useId();
const closeButton = useTemplateRef('closeButton');

// globalにすると、手前に開いたダイアログでEscを押したときにもこのパネルが閉じてしまうため、パネルの中にフォーカスがあるときだけ効かせる
const keymap = {
	'esc': {
		allowRepeat: true,
		callback: () => closePanel(),
	},
} as const satisfies Keymap;

onMounted(() => {
	closeButton.value?.focus();
});

function closePanel() {
	showing.value = false;
}
</script>

<style lang="scss" module>
.transition_x_enterActive,
.transition_x_leaveActive {
	> .bg {
		transition: opacity 0.3s !important;
	}

	> .content {
		transition: transform 0.3s cubic-bezier(0,0,.25,1) !important;
	}
}

.transition_x_enterFrom,
.transition_x_leaveTo {
	> .bg {
		opacity: 0;
	}

	> .content {
		pointer-events: none;
		transform: translateX(100%);
	}
}

.root {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	overflow: clip;
}

.bg {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background: var(--MI_THEME-modalBg);
}

.content {
	position: fixed;
	top: 0;
	right: 0;
	bottom: 0;
	width: 100%;
	max-width: 480px;
	box-sizing: border-box;
	padding-bottom: env(safe-area-inset-bottom, 0px);
	background: var(--MI_THEME-bg);
	box-shadow: 0px 4px 32px var(--MI_THEME-shadow);
	overflow: auto;
	overscroll-behavior: contain;

	// 幅の狭い画面では、サイドパネルではなく全体に出す
	@media (max-width: 500px) {
		max-width: 100%;
	}
}

.header {
	--height: 48px;

	position: sticky;
	top: 0;
	left: 0;
	height: var(--height);
	z-index: 1;
	display: flex;
	align-items: center;
	background: color(from var(--MI_THEME-panel) srgb r g b / 0.75);
	-webkit-backdrop-filter: var(--MI-blur, blur(15px));
	backdrop-filter: var(--MI-blur, blur(15px));
	border-bottom: solid 0.5px var(--MI_THEME-divider);
}

.close {
	display: flex;
	align-items: center;
	justify-content: center;
	width: var(--height);
	height: var(--height);
	font-size: 16px;
	color: var(--MI_THEME-accent);
}

.title {
	margin: 0 auto;
	font-size: 1em;
	font-weight: normal;
	white-space: nowrap;
	text-overflow: ellipsis;
	overflow: hidden;
}

.spacer {
	width: var(--height);
	height: var(--height);
}

.body {
	padding: 24px;
}
</style>
