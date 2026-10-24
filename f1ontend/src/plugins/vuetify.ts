/**
 * plugins/vuetify.ts
 *
 * Registriert alle 8 Themes (4 Presets × light/dark) und setzt
 * MD3-konforme Komponenten-Defaults (Shape, Density, Variants).
 * Die aktive Theme-Wahl erfolgt zur Laufzeit durch den theme-Store.
 */
import { createVuetify } from 'vuetify'
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

import { vuetifyThemes } from '@/themes'

export default createVuetify({
	theme: {
		defaultTheme: 'f1-red-light',
		utilities: false,
		themes: vuetifyThemes,
	},
	defaults: {
		VBtn:        { rounded: 'pill',    variant: 'flat' },
		VChip:       { rounded: 'pill' },
		VCard:       { rounded: 'lg',      elevation: 0,     variant: 'flat' },
		VList:       { density: 'comfortable' },
		VListItem:   { rounded: 'md' },
		VTextField:  { density: 'comfortable', rounded: 'sm', variant: 'outlined' },
		VSelect:     { density: 'comfortable', rounded: 'sm', variant: 'outlined' },
	},
	display: {
		mobileBreakpoint: 'md',
		thresholds: {
			xs: 0,
			sm: 600,
			md: 840,
			lg: 1145,
			xl: 1545,
			xxl: 2138,
		},
	},
})
