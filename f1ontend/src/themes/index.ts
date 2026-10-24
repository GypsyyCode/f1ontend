import f1Red from './f1-red.json'
import taupe from './taupe.json'
import racingGreen from './racing-green.json'
import midnight from './midnight.json'

export type PresetName = 'f1-red' | 'taupe' | 'racing-green' | 'midnight'
export type ThemeMode = 'light' | 'dark' | 'system'

export const PRESETS: ReadonlyArray<{ name: PresetName; label: string; seed: string }> = [
	{ name: 'f1-red',        label: 'F1-Rot',         seed: f1Red.seed },
	{ name: 'taupe',         label: 'Taupe',          seed: taupe.seed },
	{ name: 'racing-green',  label: 'Racing Green',   seed: racingGreen.seed },
	{ name: 'midnight',      label: 'Midnight',       seed: midnight.seed },
]

type ColorRecord = Record<string, string>
type ThemeFile = { seed: string; light: ColorRecord; dark: ColorRecord }

const sources: Record<PresetName, ThemeFile> = {
	'f1-red':        f1Red as ThemeFile,
	'taupe':         taupe as ThemeFile,
	'racing-green':  racingGreen as ThemeFile,
	'midnight':      midnight as ThemeFile,
}

export type VuetifyThemeName =
	| 'f1-red-light'      | 'f1-red-dark'
	| 'taupe-light'       | 'taupe-dark'
	| 'racing-green-light' | 'racing-green-dark'
	| 'midnight-light'    | 'midnight-dark'

export const vuetifyThemes: Record<VuetifyThemeName, { dark: boolean; colors: ColorRecord }> = {
	'f1-red-light':       { dark: false, colors: sources['f1-red'].light },
	'f1-red-dark':        { dark: true,  colors: sources['f1-red'].dark },
	'taupe-light':        { dark: false, colors: sources['taupe'].light },
	'taupe-dark':         { dark: true,  colors: sources['taupe'].dark },
	'racing-green-light': { dark: false, colors: sources['racing-green'].light },
	'racing-green-dark':  { dark: true,  colors: sources['racing-green'].dark },
	'midnight-light':     { dark: false, colors: sources['midnight'].light },
	'midnight-dark':      { dark: true,  colors: sources['midnight'].dark },
}

export function themeNameFor (preset: PresetName, mode: 'light' | 'dark'): VuetifyThemeName {
	return `${preset}-${mode}` as VuetifyThemeName
}

export function isPresetName (v: unknown): v is PresetName {
	return v === 'f1-red' || v === 'taupe' || v === 'racing-green' || v === 'midnight'
}

export function isThemeMode (v: unknown): v is ThemeMode {
	return v === 'light' || v === 'dark' || v === 'system'
}
