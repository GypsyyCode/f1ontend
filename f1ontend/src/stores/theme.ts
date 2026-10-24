/**
 * stores/theme.ts
 *
 * Pinia-Setup-Store für MD3-Theme-Wahl.
 *
 *   preset: welche Farbpalette ('f1-red' | 'taupe' | 'racing-green' | 'midnight')
 *   mode:   Dark-Mode-Wahl ('light' | 'dark' | 'system')
 *
 * Persistenz: automatisch via piniaIdbPlugin (nicht in IGNORED_STORES).
 *
 * Getter effectiveMode löst 'system' live gegen prefers-color-scheme auf;
 * ein matchMedia-Listener triggert bei OS-Wechsel. bindVuetify() verbindet
 * den Store mit Vuetify's theme.global.name — Konsumenten (App.vue) rufen
 * init() + bindVuetify() nach Pinia-Hydration auf.
 */
import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useTheme } from 'vuetify'

import {
	isPresetName,
	isThemeMode,
	themeNameFor,
	type PresetName,
	type ThemeMode,
} from '@/themes'

export const useThemeStore = defineStore('theme', () => {
	const preset = ref<PresetName>('f1-red')
	const mode = ref<ThemeMode>('system')
	const systemPrefersDark = ref<boolean>(false)
	let mediaCleanup: (() => void) | null = null

	const effectiveMode = computed<'light' | 'dark'>(() => {
		if (mode.value === 'system') return systemPrefersDark.value ? 'dark' : 'light'
		return mode.value
	})

	const vuetifyThemeName = computed(() => themeNameFor(preset.value, effectiveMode.value))

	function setPreset (p: PresetName) {
		if (!isPresetName(p)) return
		preset.value = p
	}

	function setMode (m: ThemeMode) {
		if (!isThemeMode(m)) return
		mode.value = m
	}

	function init () {
		if (mediaCleanup) {
			mediaCleanup()
			mediaCleanup = null
		}

		if (!isPresetName(preset.value)) preset.value = 'f1-red'
		if (!isThemeMode(mode.value))    mode.value = 'system'

		if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
			systemPrefersDark.value = false
			return
		}
		const mql = window.matchMedia('(prefers-color-scheme: dark)')
		systemPrefersDark.value = mql.matches
		const onChange = (e: MediaQueryListEvent) => {
			systemPrefersDark.value = e.matches
		}
		mql.addEventListener('change', onChange)
		mediaCleanup = () => mql.removeEventListener('change', onChange)
	}

	function destroy () {
		if (mediaCleanup) {
			mediaCleanup()
			mediaCleanup = null
		}
	}

	function bindVuetify () {
		try {
			const vuetifyTheme = useTheme()
			watch(vuetifyThemeName, name => {
				vuetifyTheme.global.name.value = name
			}, { immediate: true })
		} catch (e) {
			// useTheme nicht verfügbar (z. B. außerhalb createVuetify-Kontext)
		}
	}

	return {
		preset,
		mode,
		effectiveMode,
		vuetifyThemeName,
		setPreset,
		setMode,
		init,
		destroy,
		bindVuetify,
	}
})
