<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 32px;">
		<SearchMarker path="/admin/security" :label="i18n.ts.security" :keywords="['security']" icon="ti ti-lock" :inlining="['botProtection']">
			<div class="_gaps_m">
				<XBotProtection/>

				<SearchMarker v-slot="slotProps" :keywords="['sensitive', 'media', 'detection']">
					<MkFolder :defaultOpen="slotProps.isParentOfTarget">
						<template #icon><SearchIcon><i class="ti ti-eye-off"></i></SearchIcon></template>
						<template #label><SearchLabel>{{ i18n.ts.sensitiveMediaDetection }}</SearchLabel></template>
						<template v-if="sensitiveMediaDetectionForm.savedState.sensitiveMediaDetection === 'all'" #suffix>{{ i18n.ts.all }}</template>
						<template v-else-if="sensitiveMediaDetectionForm.savedState.sensitiveMediaDetection === 'local'" #suffix>{{ i18n.ts.localOnly }}</template>
						<template v-else-if="sensitiveMediaDetectionForm.savedState.sensitiveMediaDetection === 'remote'" #suffix>{{ i18n.ts.remoteOnly }}</template>
						<template v-else #suffix>{{ i18n.ts.none }}</template>
						<template v-if="sensitiveMediaDetectionForm.modified.value" #footer>
							<MkFormFooter :form="sensitiveMediaDetectionForm"/>
						</template>

						<div class="_gaps_m">
							<div><SearchText>{{ i18n.ts._sensitiveMediaDetection.description }}</SearchText></div>

							<MkInfo warn><SearchText>{{ i18n.ts._sensitiveMediaDetection.externalServiceInfo }}</SearchText></MkInfo>

							<MkRadios
								v-model="sensitiveMediaDetectionForm.state.sensitiveMediaDetection"
								:options="[
									{ value: 'none', label: i18n.ts.none },
									{ value: 'all', label: i18n.ts.all },
									{ value: 'local', label: i18n.ts.localOnly },
									{ value: 'remote', label: i18n.ts.remoteOnly },
								]"
							>
							</MkRadios>

							<SearchMarker :keywords="['api', 'url', 'endpoint', 'sensitive']">
								<MkInput v-model="sensitiveMediaDetectionForm.state.sensitiveMediaDetectionApiUrl" type="url">
									<template #label><SearchLabel>{{ i18n.ts._sensitiveMediaDetection.apiUrl }}</SearchLabel></template>
									<template #caption><SearchText>{{ i18n.ts._sensitiveMediaDetection.apiUrlDescription }}</SearchText></template>
								</MkInput>
							</SearchMarker>

							<SearchMarker :keywords="['api', 'key', 'token', 'sensitive']">
								<MkInput v-model="sensitiveMediaDetectionForm.state.sensitiveMediaDetectionApiKey" type="password" autocomplete="new-password">
									<template #prefix><i class="ti ti-key"></i></template>
									<template #label><SearchLabel>{{ i18n.ts._sensitiveMediaDetection.apiKey }}</SearchLabel></template>
									<template #caption><SearchText>{{ i18n.ts._sensitiveMediaDetection.apiKeyDescription }}</SearchText></template>
								</MkInput>
							</SearchMarker>

							<SearchMarker :keywords="['timeout', 'sensitive']">
								<MkInput v-model="sensitiveMediaDetectionForm.state.sensitiveMediaDetectionTimeout" type="number" :min="1">
									<template #label><SearchLabel>{{ i18n.ts._sensitiveMediaDetection.timeout }}</SearchLabel></template>
									<template #caption><SearchText>{{ i18n.ts._sensitiveMediaDetection.timeoutDescription }}</SearchText></template>
								</MkInput>
							</SearchMarker>

							<SearchMarker :keywords="['max', 'images', 'chunk', 'sensitive']">
								<MkInput v-model="sensitiveMediaDetectionForm.state.sensitiveMediaDetectionMaxImagesPerRequest" type="number" :min="1">
									<template #label><SearchLabel>{{ i18n.ts._sensitiveMediaDetection.maxImagesPerRequest }}</SearchLabel></template>
									<template #caption><SearchText>{{ i18n.ts._sensitiveMediaDetection.maxImagesPerRequestDescription }}</SearchText></template>
								</MkInput>
							</SearchMarker>

							<SearchMarker :keywords="['sensitivity']">
								<MkRange v-model="sensitiveMediaDetectionForm.state.sensitiveMediaDetectionSensitivity" :min="0" :max="4" :step="1" :textConverter="(v) => `${v + 1}`">
									<template #label><SearchLabel>{{ i18n.ts._sensitiveMediaDetection.sensitivity }}</SearchLabel></template>
									<template #caption><SearchText>{{ i18n.ts._sensitiveMediaDetection.sensitivityDescription }}</SearchText></template>
								</MkRange>
							</SearchMarker>

							<SearchMarker :keywords="['video', 'analyze']">
								<MkSwitch v-model="sensitiveMediaDetectionForm.state.enableSensitiveMediaDetectionForVideos">
									<template #label><SearchLabel>{{ i18n.ts._sensitiveMediaDetection.analyzeVideos }}</SearchLabel><span class="_beta">{{ i18n.ts.beta }}</span></template>
									<template #caption><SearchText>{{ i18n.ts._sensitiveMediaDetection.analyzeVideosDescription }}</SearchText></template>
								</MkSwitch>
							</SearchMarker>

							<SearchMarker :keywords="['flag', 'automatically']">
								<MkSwitch v-model="sensitiveMediaDetectionForm.state.setSensitiveFlagAutomatically">
									<template #label><SearchLabel>{{ i18n.ts._sensitiveMediaDetection.setSensitiveFlagAutomatically }}</SearchLabel> ({{ i18n.ts.notRecommended }})</template>
									<template #caption><SearchText>{{ i18n.ts._sensitiveMediaDetection.setSensitiveFlagAutomaticallyDescription }}</SearchText></template>
								</MkSwitch>
							</SearchMarker>

							<!-- 現状 false positive が多すぎて実用に耐えない
					<MkSwitch v-model="disallowUploadWhenPredictedAsPorn">
						<template #label>{{ i18n.ts._sensitiveMediaDetection.disallowUploadWhenPredictedAsPorn }}</template>
					</MkSwitch>
					-->
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker v-slot="slotProps" :keywords="['email', 'validation']">
					<MkFolder :defaultOpen="slotProps.isParentOfTarget">
						<template #label><SearchLabel>Active Email Validation</SearchLabel></template>
						<template v-if="emailValidationForm.savedState.enableActiveEmailValidation" #suffix>Enabled</template>
						<template v-else #suffix>Disabled</template>
						<template v-if="emailValidationForm.modified.value" #footer>
							<MkFormFooter :form="emailValidationForm"/>
						</template>

						<div class="_gaps_m">
							<div><SearchText>{{ i18n.ts.activeEmailValidationDescription }}</SearchText></div>

							<SearchMarker>
								<MkSwitch v-model="emailValidationForm.state.enableActiveEmailValidation">
									<template #label><SearchLabel>Enable</SearchLabel></template>
								</MkSwitch>
							</SearchMarker>

							<SearchMarker>
								<MkSwitch v-model="emailValidationForm.state.enableVerifymailApi">
									<template #label><SearchLabel>Use Verifymail.io API</SearchLabel></template>
								</MkSwitch>
							</SearchMarker>

							<SearchMarker>
								<MkInput v-model="emailValidationForm.state.verifymailAuthKey">
									<template #prefix><i class="ti ti-key"></i></template>
									<template #label><SearchLabel>Verifymail.io API Auth Key</SearchLabel></template>
								</MkInput>
							</SearchMarker>

							<SearchMarker>
								<MkSwitch v-model="emailValidationForm.state.enableTruemailApi">
									<template #label><SearchLabel>Use TrueMail API</SearchLabel></template>
								</MkSwitch>
							</SearchMarker>

							<SearchMarker>
								<MkInput v-model="emailValidationForm.state.truemailInstance">
									<template #prefix><i class="ti ti-key"></i></template>
									<template #label><SearchLabel>TrueMail API Instance</SearchLabel></template>
								</MkInput>
							</SearchMarker>

							<SearchMarker>
								<MkInput v-model="emailValidationForm.state.truemailAuthKey">
									<template #prefix><i class="ti ti-key"></i></template>
									<template #label><SearchLabel>TrueMail API Auth Key</SearchLabel></template>
								</MkInput>
							</SearchMarker>
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker v-slot="slotProps" :keywords="['banned', 'email', 'domains', 'blacklist']">
					<MkFolder :defaultOpen="slotProps.isParentOfTarget">
						<template #label><SearchLabel>Banned Email Domains</SearchLabel></template>
						<template v-if="bannedEmailDomainsForm.modified.value" #footer>
							<MkFormFooter :form="bannedEmailDomainsForm"/>
						</template>

						<div class="_gaps_m">
							<SearchMarker>
								<MkTextarea v-model="bannedEmailDomainsForm.state.bannedEmailDomains">
									<template #label><SearchLabel>Banned Email Domains List</SearchLabel></template>
								</MkTextarea>
							</SearchMarker>
						</div>
					</MkFolder>
				</SearchMarker>

				<!-- misskey.art独自: 使い捨てメールアドレスと、メールアドレスの別名(Gmailのドット・+タグ)で登録できないようにする -->
				<SearchMarker v-slot="slotProps" :keywords="['disposable', 'email', 'alias', 'gmail', 'signup']">
					<MkFolder :defaultOpen="slotProps.isParentOfTarget">
						<template #label><SearchLabel>{{ i18n.ts._serverSettings.signupEmailRestrictions }}</SearchLabel><span class="_art">ART</span></template>
						<template v-if="signupEmailRestrictionsForm.modified.value" #footer>
							<MkFormFooter :form="signupEmailRestrictionsForm"/>
						</template>

						<div class="_gaps_m">
							<div><SearchText>{{ i18n.ts._serverSettings.signupEmailRestrictionsDescription }}</SearchText></div>

							<SearchMarker>
								<MkSwitch v-model="signupEmailRestrictionsForm.state.disposableEmailBlocklistEnabled">
									<template #label><SearchLabel>{{ i18n.ts._serverSettings.disposableEmailBlocklistEnabled }}</SearchLabel></template>
									<template #caption>
										{{ i18n.ts._serverSettings.disposableEmailBlocklistEnabledCaption }}
										<a href="https://github.com/disposable-email-domains/disposable-email-domains" target="_blank" rel="noopener" class="_link">disposable-email-domains</a>
										<br>
										<template v-if="disposableEmailBlocklistStatus.fetchedAt != null">{{ i18n.tsx._serverSettings.disposableEmailBlocklistStatus({ n: disposableEmailBlocklistStatus.count }) }} <MkTime :time="disposableEmailBlocklistStatus.fetchedAt" mode="detail"/></template>
										<template v-else-if="signupEmailRestrictionsForm.savedState.disposableEmailBlocklistEnabled">{{ i18n.ts._serverSettings.disposableEmailBlocklistFetchFailed }}</template>
										<template v-else>{{ i18n.ts._serverSettings.disposableEmailBlocklistNotFetched }}</template>
									</template>
								</MkSwitch>
							</SearchMarker>

							<SearchMarker>
								<MkTextarea v-model="signupEmailRestrictionsForm.state.disposableEmailAllowDomains">
									<template #label><SearchLabel>{{ i18n.ts._serverSettings.disposableEmailAllowDomains }}</SearchLabel></template>
									<template #caption>{{ i18n.ts._serverSettings.disposableEmailAllowDomainsCaption }}</template>
								</MkTextarea>
							</SearchMarker>

							<SearchMarker>
								<MkSwitch v-model="signupEmailRestrictionsForm.state.blockEmailDotAliasRegistration">
									<template #label><SearchLabel>{{ i18n.ts._serverSettings.blockEmailDotAliasRegistration }}</SearchLabel></template>
									<template #caption>{{ i18n.ts._serverSettings.blockEmailDotAliasRegistrationCaption }}</template>
								</MkSwitch>
							</SearchMarker>

							<SearchMarker>
								<MkSwitch v-model="signupEmailRestrictionsForm.state.blockEmailPlusAliasRegistration">
									<template #label><SearchLabel>{{ i18n.ts._serverSettings.blockEmailPlusAliasRegistration }}</SearchLabel></template>
									<template #caption>{{ i18n.ts._serverSettings.blockEmailPlusAliasRegistrationCaption }}</template>
								</MkSwitch>
							</SearchMarker>
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker v-slot="slotProps" :keywords="['log', 'ipAddress']">
					<MkFolder :defaultOpen="slotProps.isParentOfTarget">
						<template #label><SearchLabel>Log IP address</SearchLabel></template>
						<template v-if="ipLoggingForm.savedState.enableIpLogging" #suffix>Enabled</template>
						<template v-else #suffix>Disabled</template>
						<template v-if="ipLoggingForm.modified.value" #footer>
							<MkFormFooter :form="ipLoggingForm"/>
						</template>

						<div class="_gaps_m">
							<SearchMarker>
								<MkSwitch v-model="ipLoggingForm.state.enableIpLogging">
									<template #label><SearchLabel>Enable</SearchLabel></template>
								</MkSwitch>
							</SearchMarker>
						</div>
					</MkFolder>
				</SearchMarker>
			</div>
		</SearchMarker>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import XBotProtection from './bot-protection.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkRadios from '@/components/MkRadios.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkRange from '@/components/MkRange.vue';
import MkInput from '@/components/MkInput.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import MkInfo from '@/components/MkInfo.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { fetchInstance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { useForm } from '@/composables/use-form.js';
import MkFormFooter from '@/components/MkFormFooter.vue';

const meta = await misskeyApi('admin/meta');

const sensitiveMediaDetectionForm = useForm({
	sensitiveMediaDetection: meta.sensitiveMediaDetection,
	sensitiveMediaDetectionSensitivity: meta.sensitiveMediaDetectionSensitivity === 'veryLow' ? 0 :
	meta.sensitiveMediaDetectionSensitivity === 'low' ? 1 :
	meta.sensitiveMediaDetectionSensitivity === 'medium' ? 2 :
	meta.sensitiveMediaDetectionSensitivity === 'high' ? 3 :
	meta.sensitiveMediaDetectionSensitivity === 'veryHigh' ? 4 : 0,
	setSensitiveFlagAutomatically: meta.setSensitiveFlagAutomatically,
	enableSensitiveMediaDetectionForVideos: meta.enableSensitiveMediaDetectionForVideos,
	sensitiveMediaDetectionApiUrl: meta.sensitiveMediaDetectionApiUrl,
	sensitiveMediaDetectionApiKey: meta.sensitiveMediaDetectionApiKey,
	sensitiveMediaDetectionTimeout: meta.sensitiveMediaDetectionTimeout,
	sensitiveMediaDetectionMaxImagesPerRequest: meta.sensitiveMediaDetectionMaxImagesPerRequest,
}, async (state) => {
	await os.apiWithDialog('admin/update-meta', {
		sensitiveMediaDetection: state.sensitiveMediaDetection,
		sensitiveMediaDetectionSensitivity:
			state.sensitiveMediaDetectionSensitivity === 0 ? 'veryLow' :
			state.sensitiveMediaDetectionSensitivity === 1 ? 'low' :
			state.sensitiveMediaDetectionSensitivity === 2 ? 'medium' :
			state.sensitiveMediaDetectionSensitivity === 3 ? 'high' :
			state.sensitiveMediaDetectionSensitivity === 4 ? 'veryHigh' :
			null as never,
		setSensitiveFlagAutomatically: state.setSensitiveFlagAutomatically,
		enableSensitiveMediaDetectionForVideos: state.enableSensitiveMediaDetectionForVideos,
		sensitiveMediaDetectionApiUrl: state.sensitiveMediaDetectionApiUrl,
		sensitiveMediaDetectionApiKey: state.sensitiveMediaDetectionApiKey,
		sensitiveMediaDetectionTimeout: state.sensitiveMediaDetectionTimeout,
		sensitiveMediaDetectionMaxImagesPerRequest: state.sensitiveMediaDetectionMaxImagesPerRequest,
	});
	fetchInstance(true);
});

const ipLoggingForm = useForm({
	enableIpLogging: meta.enableIpLogging,
}, async (state) => {
	await os.apiWithDialog('admin/update-meta', {
		enableIpLogging: state.enableIpLogging,
	});
	fetchInstance(true);
});

const emailValidationForm = useForm({
	enableActiveEmailValidation: meta.enableActiveEmailValidation,
	enableVerifymailApi: meta.enableVerifymailApi,
	verifymailAuthKey: meta.verifymailAuthKey,
	enableTruemailApi: meta.enableTruemailApi,
	truemailInstance: meta.truemailInstance,
	truemailAuthKey: meta.truemailAuthKey,
}, async (state) => {
	await os.apiWithDialog('admin/update-meta', {
		enableActiveEmailValidation: state.enableActiveEmailValidation,
		enableVerifymailApi: state.enableVerifymailApi,
		verifymailAuthKey: state.verifymailAuthKey,
		enableTruemailApi: state.enableTruemailApi,
		truemailInstance: state.truemailInstance,
		truemailAuthKey: state.truemailAuthKey,
	});
	fetchInstance(true);
});

const bannedEmailDomainsForm = useForm({
	bannedEmailDomains: meta.bannedEmailDomains?.join('\n') || '',
}, async (state) => {
	await os.apiWithDialog('admin/update-meta', {
		bannedEmailDomains: state.bannedEmailDomains.split('\n'),
	});
	fetchInstance(true);
});

// misskey.art独自: 許可するドメインは1行に1つで入れる(空白・カンマで区切って並べてもよい)。上限はadmin/update-metaのparamDefと合わせる
function parseDomainLines(input: string): string[] {
	return input.split(/[\s,]+/).filter(x => x.length > 0 && x.length <= 253).slice(0, 1000);
}

// 一覧の状態(件数と取得した日時)。保存した後に読み直す
const disposableEmailBlocklistStatus = ref({ count: meta.disposableEmailBlocklistCount, fetchedAt: meta.disposableEmailBlocklistFetchedAt });

const signupEmailRestrictionsForm = useForm({
	disposableEmailBlocklistEnabled: meta.disposableEmailBlocklistEnabled,
	disposableEmailAllowDomains: meta.disposableEmailAllowDomains.join('\n'),
	blockEmailDotAliasRegistration: meta.blockEmailDotAliasRegistration,
	blockEmailPlusAliasRegistration: meta.blockEmailPlusAliasRegistration,
}, async (state) => {
	await os.apiWithDialog('admin/update-meta', {
		disposableEmailBlocklistEnabled: state.disposableEmailBlocklistEnabled,
		disposableEmailAllowDomains: parseDomainLines(state.disposableEmailAllowDomains),
		blockEmailDotAliasRegistration: state.blockEmailDotAliasRegistration,
		blockEmailPlusAliasRegistration: state.blockEmailPlusAliasRegistration,
	});
	// 許可するドメインは、サーバーが形の正しいものだけにそろえて保存する。保存されなかったものに気付けるよう、欄にも反映する
	const saved = await misskeyApi('admin/meta');
	signupEmailRestrictionsForm.state.disposableEmailAllowDomains = saved.disposableEmailAllowDomains.join('\n');
	disposableEmailBlocklistStatus.value = { count: saved.disposableEmailBlocklistCount, fetchedAt: saved.disposableEmailBlocklistFetchedAt };
	fetchInstance(true);
});

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.security,
	icon: 'ti ti-lock',
}));
</script>
