<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div>
	<div v-if="game.ready" :class="$style.game">
		<div :class="$style.cps" class="">{{ number(cps) }}cps</div>
		<div :class="$style.count" class="" data-testid="count"><i class="ti ti-cookie" style="font-size: 70%;"></i> {{ number(puddings) }}</div>
		<button v-click-anime class="_button" @click="onClick">
			<img src="/client-assets/pudding.png" :class="$style.img">
		</button>
	</div>
	<div v-else>
		<MkLoading/>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import MkPlusOneEffect from '@/components/MkPlusOneEffect.vue';
import * as os from '@/os.js';
import { useInterval } from '@@/js/use-interval.js';
import * as game from '@/scripts/clicker-game.js';
import number from '@/filters/number.js';
import { claimAchievement } from '@/scripts/achievements.js';

const saveData = game.saveData;
const puddings = computed(() => saveData.value?.puddings);
let cps = ref(0);
let prevPuddings = ref(0);

function onClick(ev: MouseEvent) {
	const x = ev.clientX;
	const y = ev.clientY;
	const { dispose } = os.popup(MkPlusOneEffect, { x, y }, {
		end: () => dispose(),
	});

	saveData.value!.puddings++;
	saveData.value!.totalPuddings++;
	saveData.value!.totalHandmadePuddings++;
	saveData.value!.clicked++;

	if (puddings.value === 1) {
		claimAchievement('puddingClicked');
	}
}

useInterval(() => {
	const diff = saveData.value!.puddings - prevPuddings.value;
	cps.value = diff;
	prevPuddings.value = saveData.value!.puddings;
}, 1000, {
	immediate: false,
	afterMounted: true,
});

useInterval(game.save, 1000 * 5, {
	immediate: false,
	afterMounted: true,
});

onMounted(async () => {
	await game.load();
	prevPuddings.value = saveData.value!.puddings;
});

onUnmounted(() => {
	game.save();
});
</script>

<style lang="scss" module>
.game {
	padding: 16px;
	text-align: center;
}

.cps {
	position: absolute;
	top: 12px;
	left: 12px;
	opacity: 0.5;
}

.count {
	font-size: 1.3em;
	margin-bottom: 6px;
}

.img {
	max-width: 90px;
}
</style>
