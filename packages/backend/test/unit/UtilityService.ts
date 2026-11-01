/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { UtilityService } from '@/core/UtilityService.js';
import type { Config } from '@/config.js';
import type { MiMeta } from '@/models/Meta.js';

// misskey.art独自: normalizeEmailForDedupはConfig/MiMetaに依存しないため、DIコンテナを使わず直接インスタンス化する
const utilityService = new UtilityService({} as Config, {} as MiMeta);

const BOTH = { foldDots: true, stripPlusTag: true };
const DOTS_ONLY = { foldDots: true, stripPlusTag: false };
const PLUS_ONLY = { foldDots: false, stripPlusTag: true };
const NEITHER = { foldDots: false, stripPlusTag: false };

describe('UtilityService.normalizeEmailForDedup', () => {
	test('lowercases the whole address regardless of options', () => {
		expect(utilityService.normalizeEmailForDedup('Example@Example.com', NEITHER)).toBe('example@example.com');
	});

	test('is a no-op for an address with no @', () => {
		expect(utilityService.normalizeEmailForDedup('not-an-email', BOTH)).toBe('not-an-email');
	});

	describe('foldDots', () => {
		test('strips dots from the local part on gmail.com when enabled', () => {
			expect(utilityService.normalizeEmailForDedup('ex.ample@gmail.com', DOTS_ONLY)).toBe('example@gmail.com');
		});

		test('strips dots from the local part on googlemail.com when enabled', () => {
			expect(utilityService.normalizeEmailForDedup('ex.ample@googlemail.com', DOTS_ONLY)).toBe('example@googlemail.com');
		});

		test('does NOT strip dots on non-gmail domains even when enabled', () => {
			expect(utilityService.normalizeEmailForDedup('ex.ample@example.com', DOTS_ONLY)).toBe('ex.ample@example.com');
		});

		test('does NOT strip dots on gmail.com when disabled', () => {
			expect(utilityService.normalizeEmailForDedup('ex.ample@gmail.com', PLUS_ONLY)).toBe('ex.ample@gmail.com');
		});

		test('treats gmail.com and googlemail.com as different domains (domain itself is not normalized)', () => {
			expect(utilityService.normalizeEmailForDedup('example@gmail.com', BOTH))
				.not.toBe(utilityService.normalizeEmailForDedup('example@googlemail.com', BOTH));
		});
	});

	describe('stripPlusTag', () => {
		test('strips a +tag suffix on gmail.com when enabled', () => {
			expect(utilityService.normalizeEmailForDedup('example+work@gmail.com', PLUS_ONLY)).toBe('example@gmail.com');
		});

		test('strips a +tag suffix on non-gmail domains too when enabled', () => {
			expect(utilityService.normalizeEmailForDedup('example+work@example.com', PLUS_ONLY)).toBe('example@example.com');
		});

		test('does NOT strip a +tag suffix when disabled', () => {
			expect(utilityService.normalizeEmailForDedup('example+work@example.com', DOTS_ONLY)).toBe('example+work@example.com');
		});
	});

	describe('both enabled', () => {
		test('combines dot-folding and +tag stripping on gmail.com', () => {
			expect(utilityService.normalizeEmailForDedup('ex.ample+work@gmail.com', BOTH)).toBe('example@gmail.com');
		});

		test('treats heavily aliased and plain addresses as equivalent on gmail.com', () => {
			expect(utilityService.normalizeEmailForDedup('e.x.a.m.p.l.e+anything@gmail.com', BOTH))
				.toBe(utilityService.normalizeEmailForDedup('example@gmail.com', BOTH));
		});
	});

	describe('neither enabled', () => {
		test('returns only the lowercased address unchanged', () => {
			expect(utilityService.normalizeEmailForDedup('Ex.Ample+Work@Gmail.com', NEITHER)).toBe('ex.ample+work@gmail.com');
		});
	});
});
