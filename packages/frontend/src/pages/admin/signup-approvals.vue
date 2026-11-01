<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!-- misskey.art独自: 承認制の新規登録の審査 -->
<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 800px;">
		<div class="_gaps">
			<MkSelect v-model="state" :items="stateDef">
				<template #label>{{ i18n.ts.state }}</template>
			</MkSelect>

			<MkPagination v-if="state === 'pending'" :paginator="pendingPaginator">
				<template #empty><MkResult type="empty" :text="i18n.ts._signupApprovals.noPending"/></template>
				<template #default="{ items }">
					<div class="_gaps">
						<MkSignupApproval v-for="signup in items" :key="signup.id" :signup="signup" @resolved="resolved"/>
					</div>
				</template>
			</MkPagination>
			<MkPagination v-else :paginator="historyPaginator">
				<template #empty><MkResult type="empty" :text="i18n.ts._signupApprovals.noHistory"/></template>
				<template #default="{ items }">
					<div class="_gaps">
						<MkSignupApprovalHistoryItem v-for="entry in items" :key="entry.id" :entry="entry"/>
					</div>
				</template>
			</MkPagination>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, markRaw } from 'vue';
import MkSelect from '@/components/MkSelect.vue';
import MkPagination from '@/components/MkPagination.vue';
import MkSignupApproval from '@/components/MkSignupApproval.vue';
import MkSignupApprovalHistoryItem from '@/components/MkSignupApprovalHistoryItem.vue';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { useMkSelect } from '@/composables/use-mkselect.js';
import { Paginator } from '@/utility/paginator.js';

const {
	model: state,
	def: stateDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts._signupApprovals.statusPending, value: 'pending' },
		{ label: i18n.ts._signupApprovals.statusApproved, value: 'approved' },
		{ label: i18n.ts._signupApprovals.statusDeclined, value: 'declined' },
	],
	initialValue: 'pending',
});

// 審査待ちは、まだあるアカウントを承認・却下するため、審査した履歴とは別のエンドポイントで取る
const pendingPaginator = markRaw(new Paginator('admin/signup-approvals/pending', {
	limit: 10,
}));

const historyPaginator = markRaw(new Paginator('admin/signup-approvals/history', {
	limit: 10,
	// 審査待ちを選んでいるときは、こちらは表示しないので取得しない。型を合わせるため、approvedにしておく
	computedParams: computed(() => ({
		state: state.value === 'declined' ? 'declined' as const : 'approved' as const,
	})),
}));

function resolved(userId: string) {
	pendingPaginator.removeItem(userId);
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts._signupApprovals.title,
	icon: 'ti ti-user-question',
}));
</script>
