<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!-- misskey.art独自: 審査した新規登録の申請1件(承認済み・却下済み) -->
<template>
<MkFolder>
	<template #icon><i class="ti ti-user-question"></i></template>
	<template #label>{{ entry.username != null ? `@${entry.username}` : i18n.ts.unknown }}</template>
	<template #suffix>
		<span :class="[$style.status, entry.status === 'approved' ? $style.statusApproved : $style.statusDeclined]">{{ statusLabel }}</span>
	</template>

	<div class="_gaps_s">
		<div>{{ i18n.ts._signupApprovals.reason }}</div>
		<div class="_selectable" :class="$style.text">{{ entry.signupReason ?? i18n.ts.none }}</div>
		<div v-if="entry.status === 'declined'" class="_selectable" :class="$style.text">{{ i18n.ts._signupApprovals.declineReason }}: {{ entry.reason ?? i18n.ts.none }}</div>
		<div v-if="entry.reviewer">{{ i18n.ts._signupApprovals.reviewedBy }}: <MkAcct :user="entry.reviewer"/><template v-if="entry.reviewedAt"> (<MkTime :time="entry.reviewedAt"/>)</template></div>
	</div>
</MkFolder>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import * as Misskey from 'misskey-js';
import MkFolder from '@/components/MkFolder.vue';
import { i18n } from '@/i18n.js';

const props = defineProps<{
	entry: Misskey.entities.AdminSignupApprovalsHistoryResponse[number];
}>();

const statusLabel = computed(() => props.entry.status === 'approved' ? i18n.ts._signupApprovals.statusApproved : i18n.ts._signupApprovals.statusDeclined);
</script>

<style lang="scss" module>
.status {
	display: inline-block;
	padding: 2px 8px;
	border-radius: 999px;
	font-size: 85%;
}

.statusApproved {
	background: var(--MI_THEME-success);
	color: var(--MI_THEME-fgOnAccent);
}

.statusDeclined {
	background: var(--MI_THEME-error);
	color: var(--MI_THEME-fgOnAccent);
}

.text {
	white-space: pre-wrap;
	word-break: break-word;
}
</style>
