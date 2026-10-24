#!/usr/bin/env node
/**
 * Generiert MD3-Theme-JSONs aus den vier Seed-Farben.
 * Einmalig lokal ausführen: `npm run generate-themes`.
 * Output: src/themes/<preset>.json mit { light: {colors}, dark: {colors} }.
 *
 * Die MD3-Rollen folgen Vuetify's color-API-Namen. Es werden auch die
 * "surface-container"-Töne gesetzt, die MD3-Expressive für tonale
 * Hierarchie nutzt (statt harter Schatten).
 */
import { argbFromHex, hexFromArgb, themeFromSourceColor } from '@material/material-color-utilities'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, '../src/themes')
mkdirSync(outDir, { recursive: true })

const PRESETS = {
	'f1-red':        '#E10600',
	'taupe':         '#8A7B6E',
	'racing-green':  '#1F4D3A',
	'midnight':      '#1A2744',
}

function toVuetifyColors (scheme, palettes) {
	const h = argb => hexFromArgb(argb)
	const neutralTone = tone => h(palettes.neutral.tone(tone))

	return {
		primary:                     h(scheme.primary),
		'on-primary':                h(scheme.onPrimary),
		'primary-container':         h(scheme.primaryContainer),
		'on-primary-container':      h(scheme.onPrimaryContainer),

		secondary:                   h(scheme.secondary),
		'on-secondary':              h(scheme.onSecondary),
		'secondary-container':       h(scheme.secondaryContainer),
		'on-secondary-container':    h(scheme.onSecondaryContainer),

		tertiary:                    h(scheme.tertiary),
		'on-tertiary':               h(scheme.onTertiary),
		'tertiary-container':        h(scheme.tertiaryContainer),
		'on-tertiary-container':     h(scheme.onTertiaryContainer),

		background:                  h(scheme.background),
		'on-background':             h(scheme.onBackground),
		surface:                     h(scheme.surface),
		'on-surface':                h(scheme.onSurface),
		'surface-variant':           h(scheme.surfaceVariant),
		'on-surface-variant':        h(scheme.onSurfaceVariant),

		'surface-container-lowest':  neutralTone(scheme.isDark ? 4  : 100),
		'surface-container-low':     neutralTone(scheme.isDark ? 10 : 96),
		'surface-container':         neutralTone(scheme.isDark ? 12 : 94),
		'surface-container-high':    neutralTone(scheme.isDark ? 17 : 92),
		'surface-container-highest': neutralTone(scheme.isDark ? 22 : 90),

		error:                       h(scheme.error),
		'on-error':                  h(scheme.onError),
		'error-container':           h(scheme.errorContainer),
		'on-error-container':        h(scheme.onErrorContainer),

		outline:                     h(scheme.outline),
		'outline-variant':           h(scheme.outlineVariant),
	}
}

for (const [name, hex] of Object.entries(PRESETS)) {
	const theme = themeFromSourceColor(argbFromHex(hex))
	const schemes = { light: theme.schemes.light, dark: theme.schemes.dark }
	schemes.light.isDark = false
	schemes.dark.isDark  = true

	const out = {
		seed: hex,
		light: toVuetifyColors(schemes.light, theme.palettes),
		dark:  toVuetifyColors(schemes.dark,  theme.palettes),
	}
	writeFileSync(
		resolve(outDir, `${name}.json`),
		JSON.stringify(out, null, '\t') + '\n',
	)
	console.log(`✓ ${name}.json`)
}
