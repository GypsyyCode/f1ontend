# MD3-Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Material-Design-3-basiertes Theming-System einführen: 4 Farb-Presets × Light/Dark/System, App-Bar mit Switcher, konsistente Typo/Shape/Density/Elevation-Tokens, Migration der 5 Komponenten mit `taupe-*`-Rückständen.

**Architecture:** Palette-Generation einmalig via `@material/material-color-utilities` → statische JSONs ins Repo. Vuetify bekommt alle 8 Themes (`<preset>-<mode>`) plus Komponenten-Defaults. Tailwind-`@theme` wird um MD3-Rollenfarben + Shape- + Typo-Utilities erweitert. Neuer Pinia-`theme`-Store (auto-persistiert via bestehendem `piniaIdbPlugin`) steuert Vuetify's `theme.global.name`. Neue `AppBar.vue` oben rechts beherbergt Dark-Toggle + Theme-Menü + Login. Dann rollierende Migration der betroffenen 5 Komponenten.

**Tech Stack:**
- Vue 3 (Composition API), Vuetify 4, Pinia 3, TypeScript, Vuetify 3-/4-Themes-API
- Tailwind v4 (`@theme`-Block, `@utility`), MDI-Icons
- `@material/material-color-utilities` (devDep, nur Script)
- Gate: `npm run type-check` — **keine** `npm run lint`/`:fix`-Aufrufe (würde Formatierung repo-weit umbrechen; Projekt nutzt TABs)

> **WICHTIG — FE-Code-Stil:** Mit **TABs** einrücken. `catch (e)` beibehalten. Niemals `eslint`/`:fix` ausführen. Einziges Gate: `npm run type-check`.

---

## File Structure

### Create
- `scripts/generate-md3-palettes.mjs` — Node-Script (einmalig lokal) → generiert `src/themes/*.json` aus den 4 Seed-Hex-Werten
- `src/themes/f1-red.json`, `taupe.json`, `racing-green.json`, `midnight.json` — generierte Vuetify-Theme-Rollen (light + dark)
- `src/themes/index.ts` — exportiert `PresetName`-Union-Type, `PRESETS`-Array, `themes`-Record für Vuetify
- `src/stores/theme.ts` — Pinia-Setup-Store: `preset`, `mode`, Getter `vuetifyThemeName`, Action `init()` + `matchMedia`-Listener
- `src/components/app-bar/AppBar.vue` — v-app-bar mit Dark-Toggle + Theme-Menü + Login/Avatar

### Modify
- `package.json` — devDep `@material/material-color-utilities`, Script `generate-themes`
- `src/plugins/vuetify.ts` — 8 Themes registrieren, Komponenten-Defaults setzen
- `src/styles/tailwind.css` — MD3-Rollenfarben als `--color-*`, Shape-Utilities, Typo-Utilities
- `src/App.vue` — AppBar einbauen, Login aus Drawer in AppBar ziehen, `bg-taupe-*` → `bg-surface-container` / `bg-surface`
- `src/components/bet-card/bet-card.vue` — `bg-taupe-500 text-taupe-100` → MD3-Rollenfarben
- `src/components/list/list.vue` — `bg-taupe-200` → `bg-surface-container`
- `src/components/list/list-item.vue` — `bg-taupe-200` → `bg-surface-container`
- `src/pages/punkteliste.vue` — `bg-taupe-200` / `bg-taupe-500 text-taupe-100` → Rollenfarben
- `src/pages/constructorChampionship.vue` — `bg-taupe-500 text-taupe-100` → Rollenfarbe

---

## Pre-Flight

- [ ] **PF-1:** `node --version` — Expected: ≥ v18 (für `@material/material-color-utilities` + ESM).
- [ ] **PF-2:** `grep -n "defaultTheme" src/plugins/vuetify.ts` — Expected: Zeile `defaultTheme: 'system'`. Wird in Task 2 überschrieben.
- [ ] **PF-3:** `grep -rn "taupe-" src/ | wc -l` — Expected: 9 Fundstellen (siehe File Structure). Falls höher: neue Fundstellen in Task 7/8/9 ergänzen.
- [ ] **PF-4:** `grep -n "IGNORED_STORES" src/plugins/piniaIdb.ts` — Expected: `IGNORED_STORES = new Set<string>(['season'])`. Wir fügen hier **nichts** hinzu — der neue `theme`-Store wird auto-persistiert.
- [ ] **PF-5:** Backup der aktuellen `src/plugins/vuetify.ts` und `src/styles/tailwind.css` ist implizit durch Git gegeben; keine extra Aktion.

Falls einer der Checks fehlschlägt: stop und mit dem User klären.

---

## Task 1: Palette-Script + 4 Theme-JSONs

**Files:**
- Modify: `package.json`
- Create: `scripts/generate-md3-palettes.mjs`
- Create: `src/themes/f1-red.json`, `taupe.json`, `racing-green.json`, `midnight.json`
- Create: `src/themes/index.ts`

- [ ] **Step 1: Dependency installieren**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
npm install --save-dev @material/material-color-utilities
```

Expected: Paket in `devDependencies` von `package.json`, kein Fehler.

- [ ] **Step 2: Palette-Script schreiben**

Create `scripts/generate-md3-palettes.mjs`:

```js
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
	// scheme = @material scheme (Hct → ARGB). palettes = tonal palettes
	// für surface-container-Töne (die Vuetify nicht nativ im Scheme hat).
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

		// surface-container-Töne via neutral palette (MD3 Expressive):
		//   lowest=100, low=96, container=94, high=92, highest=90 (light)
		//   lowest=4,   low=10, container=12, high=17, highest=22 (dark)
		// Vuetify nimmt sie als eigene color-tokens an.
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
	// isDark-Marker für surface-container-Berechnung
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
```

- [ ] **Step 3: NPM-Script registrieren**

In `package.json` den `"scripts"`-Block erweitern:

```json
"scripts": {
	"dev": "vite",
	"build": "run-p type-check \"build-only {@}\" --",
	"preview": "vite preview",
	"build-only": "vite build",
	"type-check": "vue-tsc --build --force",
	"lint": "eslint",
	"lint:fix": "eslint --fix",
	"generate-themes": "node scripts/generate-md3-palettes.mjs"
}
```

- [ ] **Step 4: Script ausführen**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
mkdir -p src/themes
npm run generate-themes
```

Expected: 4 Zeilen `✓ <name>.json`, Dateien `src/themes/{f1-red,taupe,racing-green,midnight}.json` angelegt.

- [ ] **Step 5: `src/themes/index.ts` schreiben**

Create `src/themes/index.ts`:

```ts
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

// vuetifyThemes: fertige Themes-Map für createVuetify({ theme: { themes }})
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
```

- [ ] **Step 6: TypeScript JSON-Import freischalten**

Prüfe `tsconfig.app.json`:

```bash
grep -n "resolveJsonModule" tsconfig.app.json tsconfig.node.json 2>/dev/null
```

Falls **nicht** gesetzt: In `tsconfig.app.json` → `compilerOptions` ergänzen:
```json
"resolveJsonModule": true,
```

- [ ] **Step 7: Type-Check**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
npm run type-check
```

Expected: kein Fehler.

- [ ] **Step 8: Commit**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
git add package.json package-lock.json scripts/generate-md3-palettes.mjs src/themes/ tsconfig.app.json
git commit -m "feat(themes): MD3 palette generator + 4 theme JSONs"
```

---

## Task 2: Vuetify-Config auf 8 Themes + Komponenten-Defaults

**Files:**
- Modify: `src/plugins/vuetify.ts`

- [ ] **Step 1: Vuetify-Plugin erweitern**

Replace `src/plugins/vuetify.ts` content:

```ts
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
		defaultTheme: 'f1-red-light',   // Default; theme-Store überschreibt beim Boot
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
		VDialog:     { },
		VMenu:       { },
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
```

- [ ] **Step 2: Type-Check**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
npm run type-check
```

Expected: kein Fehler.

- [ ] **Step 3: Smoketest (App startet)**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
npm run dev
```

Expected: Dev-Server startet, Browser zeigt App im F1-Rot-Light-Theme (statt des alten „taupe"-Nicht-Looks). Button/Card-Formen folgen den neuen Defaults.

Stop den Server (`Ctrl+C`) nach dem Smoketest.

- [ ] **Step 4: Commit**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
git add src/plugins/vuetify.ts
git commit -m "feat(vuetify): register 8 MD3 themes + component defaults"
```

---

## Task 3: Tailwind — MD3-Rollen + Shape + Typografie

**Files:**
- Modify: `src/styles/tailwind.css`

- [ ] **Step 1: Erweiterte `tailwind.css` schreiben**

Replace `src/styles/tailwind.css` content:

```css
@import "tailwindcss/theme" layer(tailwind-theme);
@import "tailwindcss/preflight" layer(tailwind-reset);
@import "tailwindcss/utilities" layer(tailwind-utilities);

@theme {
	--font-heading: "Roboto", sans-serif;
	--font-body: "Roboto", sans-serif;
	--font-mono: "Roboto Mono", monospace;

	/* MD3 role colors — gespeist aus Vuetify's --v-theme-* Variablen,
	   damit ein Theme-Wechsel automatisch alle Tailwind-Utilities neu
	   bindet. */
	--color-background:                 rgb(var(--v-theme-background));
	--color-on-background:              rgb(var(--v-theme-on-background));
	--color-surface:                    rgb(var(--v-theme-surface));
	--color-on-surface:                 rgb(var(--v-theme-on-surface));
	--color-surface-variant:            rgb(var(--v-theme-surface-variant));
	--color-on-surface-variant:         rgb(var(--v-theme-on-surface-variant));
	--color-surface-container-lowest:   rgb(var(--v-theme-surface-container-lowest));
	--color-surface-container-low:      rgb(var(--v-theme-surface-container-low));
	--color-surface-container:          rgb(var(--v-theme-surface-container));
	--color-surface-container-high:     rgb(var(--v-theme-surface-container-high));
	--color-surface-container-highest:  rgb(var(--v-theme-surface-container-highest));

	--color-primary:                    rgb(var(--v-theme-primary));
	--color-on-primary:                 rgb(var(--v-theme-on-primary));
	--color-primary-container:          rgb(var(--v-theme-primary-container));
	--color-on-primary-container:       rgb(var(--v-theme-on-primary-container));

	--color-secondary:                  rgb(var(--v-theme-secondary));
	--color-on-secondary:               rgb(var(--v-theme-on-secondary));
	--color-secondary-container:        rgb(var(--v-theme-secondary-container));
	--color-on-secondary-container:     rgb(var(--v-theme-on-secondary-container));

	--color-tertiary:                   rgb(var(--v-theme-tertiary));
	--color-on-tertiary:                rgb(var(--v-theme-on-tertiary));
	--color-tertiary-container:         rgb(var(--v-theme-tertiary-container));
	--color-on-tertiary-container:      rgb(var(--v-theme-on-tertiary-container));

	--color-error:                      rgb(var(--v-theme-error));
	--color-on-error:                   rgb(var(--v-theme-on-error));
	--color-error-container:            rgb(var(--v-theme-error-container));
	--color-on-error-container:         rgb(var(--v-theme-on-error-container));

	--color-outline:                    rgb(var(--v-theme-outline));
	--color-outline-variant:            rgb(var(--v-theme-outline-variant));

	/* Nicht löschen — bestehende shortcuts die Code benutzt */
	--color-success:                    rgb(var(--v-theme-success));
	--color-info:                       rgb(var(--v-theme-info));
	--color-warning:                    rgb(var(--v-theme-warning));

	--breakpoint-*: initial;
	--breakpoint-xs: 0px;
	--breakpoint-sm: 600px;
	--breakpoint-md: 840px;
	--breakpoint-lg: 1145px;
	--breakpoint-xl: 1545px;
	--breakpoint-xxl: 2138px;
}

@custom-variant light (&:where(.v-theme--f1-red-light, .v-theme--taupe-light, .v-theme--racing-green-light, .v-theme--midnight-light, .v-theme--f1-red-light *, .v-theme--taupe-light *, .v-theme--racing-green-light *, .v-theme--midnight-light *));
@custom-variant dark  (&:where(.v-theme--f1-red-dark,  .v-theme--taupe-dark,  .v-theme--racing-green-dark,  .v-theme--midnight-dark,  .v-theme--f1-red-dark *,  .v-theme--taupe-dark *,  .v-theme--racing-green-dark *,  .v-theme--midnight-dark *));

/* safelist to ensure variables are always available */
@source inline('font-heading');
@source inline('font-body');
@source inline('font-mono');

/*
  Shape — MD3-Scale (Mixed, Entscheidung D aus Frage 9).
  Rolle → Utility:
     Cards:   shape-lg (16px)
     Dialog:  shape-xl (28px)
     Buttons: rounded-pill (bestehend)
     Chips:   rounded-pill
     Inputs:  shape-xs (4px)
*/
@utility shape-none { border-radius: 0 }
@utility shape-xs   { border-radius: 4px }
@utility shape-sm   { border-radius: 8px }
@utility shape-md   { border-radius: 12px }
@utility shape-lg   { border-radius: 16px }
@utility shape-xl   { border-radius: 28px }
@utility shape-full { border-radius: 9999px }

@utility rounded-pill   { border-radius: 9999px }
@utility rounded-circle { border-radius: 50%    }
@utility rounded-shaped { border-radius: 24px 0 }

@source inline('rounded'); /* .25rem */
@source inline('rounded-{none,sm,md,lg,xl,2xl,3xl,full,pill,circle,shaped}');
@source inline('shape-{none,xs,sm,md,lg,xl,full}');

/*
  MD3 Type-Scale — Roboto. Jede Rolle setzt Size/Line-Height/Weight/Tracking.
  Verwendung: <h1 class="text-headline-large">...</h1>
*/
@utility text-display-large    { font-size: 57px; line-height: 64px; font-weight: 400; letter-spacing: -0.25px }
@utility text-display-medium   { font-size: 45px; line-height: 52px; font-weight: 400; letter-spacing: 0 }
@utility text-display-small    { font-size: 36px; line-height: 44px; font-weight: 400; letter-spacing: 0 }
@utility text-headline-large   { font-size: 32px; line-height: 40px; font-weight: 400; letter-spacing: 0 }
@utility text-headline-medium  { font-size: 28px; line-height: 36px; font-weight: 400; letter-spacing: 0 }
@utility text-headline-small   { font-size: 24px; line-height: 32px; font-weight: 400; letter-spacing: 0 }
@utility text-title-large      { font-size: 22px; line-height: 28px; font-weight: 500; letter-spacing: 0 }
@utility text-title-medium     { font-size: 16px; line-height: 24px; font-weight: 500; letter-spacing: 0.15px }
@utility text-title-small      { font-size: 14px; line-height: 20px; font-weight: 500; letter-spacing: 0.1px }
@utility text-body-large       { font-size: 16px; line-height: 24px; font-weight: 400; letter-spacing: 0.5px }
@utility text-body-medium      { font-size: 14px; line-height: 20px; font-weight: 400; letter-spacing: 0.25px }
@utility text-body-small       { font-size: 12px; line-height: 16px; font-weight: 400; letter-spacing: 0.4px }
@utility text-label-large      { font-size: 14px; line-height: 20px; font-weight: 500; letter-spacing: 0.1px }
@utility text-label-medium     { font-size: 12px; line-height: 16px; font-weight: 500; letter-spacing: 0.5px }
@utility text-label-small      { font-size: 11px; line-height: 16px; font-weight: 500; letter-spacing: 0.5px }

@source inline('text-{display,headline,title,body,label}-{large,medium,small}');

/* MD3 elevation — unverändert */
@utility elevation-0 {
	box-shadow: 0px 0px 0px 0px rgba(var(--v-shadow-color), var(--v-shadow-key-opacity, 0.3)), 0px 0px 0px 0px rgba(var(--v-shadow-color), var(--v-shadow-ambient-opacity, 0.15));
	--v-elevation-overlay: color-mix(in srgb, var(--v-elevation-overlay-color) 0%, transparent);
}
@utility elevation-1 {
	box-shadow: 0px 1px 2px 0px rgba(var(--v-shadow-color), var(--v-shadow-key-opacity, 0.3)), 0px 1px 3px 1px rgba(var(--v-shadow-color), var(--v-shadow-ambient-opacity, 0.15));
	--v-elevation-overlay: color-mix(in srgb, var(--v-elevation-overlay-color) 2%, transparent);
}
@utility elevation-2 {
	box-shadow: 0px 1px 2px 0px rgba(var(--v-shadow-color), var(--v-shadow-key-opacity, 0.3)), 0px 2px 6px 2px rgba(var(--v-shadow-color), var(--v-shadow-ambient-opacity, 0.15));
	--v-elevation-overlay: color-mix(in srgb, var(--v-elevation-overlay-color) 4%, transparent);
}
@utility elevation-3 {
	box-shadow: 0px 1px 3px 0px rgba(var(--v-shadow-color), var(--v-shadow-key-opacity, 0.3)), 0px 4px 8px 3px rgba(var(--v-shadow-color), var(--v-shadow-ambient-opacity, 0.15));
	--v-elevation-overlay: color-mix(in srgb, var(--v-elevation-overlay-color) 6%, transparent);
}
@utility elevation-4 {
	box-shadow: 0px 2px 3px 0px rgba(var(--v-shadow-color), var(--v-shadow-key-opacity, 0.3)), 0px 6px 10px 4px rgba(var(--v-shadow-color), var(--v-shadow-ambient-opacity, 0.15));
	--v-elevation-overlay: color-mix(in srgb, var(--v-elevation-overlay-color) 8%, transparent);
}
@utility elevation-5 {
	box-shadow: 0px 4px 4px 0px rgba(var(--v-shadow-color), var(--v-shadow-key-opacity, 0.3)), 0px 8px 12px 6px rgba(var(--v-shadow-color), var(--v-shadow-ambient-opacity, 0.15));
	--v-elevation-overlay: color-mix(in srgb, var(--v-elevation-overlay-color) 10%, transparent);
}
@utility elevation-overlay {
	background-image: linear-gradient(var(--v-elevation-overlay), var(--v-elevation-overlay));
}

@source inline('elevation-{0,1,2,3,4,5}');
```

- [ ] **Step 2: Type-Check**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
npm run type-check
```

Expected: kein Fehler.

- [ ] **Step 3: Smoketest**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
npm run dev
```

Browser: `/` zeigt App. Keine Konsolen-Fehler. Vorhandene `bg-surface`-/`text-primary`-Nutzung rendert korrekt. Stop den Dev-Server.

- [ ] **Step 4: Commit**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
git add src/styles/tailwind.css
git commit -m "feat(tailwind): MD3 role colors + shape + typography utilities"
```

---

## Task 4: Theme-Pinia-Store

**Files:**
- Create: `src/stores/theme.ts`

- [ ] **Step 1: Store schreiben**

Create `src/stores/theme.ts`:

```ts
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
 * ein matchMedia-Listener triggert bei OS-Wechsel. Der Store ruft Vuetify's
 * theme.global.name self-sync in watchEffect — Konsumenten (App.vue) müssen
 * nur init() nach Pinia-Hydration aufrufen.
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
		// Normalisiere nach Hydration: wenn piniaIdb Müll geladen hat, Defaults.
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

	// Vuetify-Theme live sync — wird aktiv, sobald useTheme() in einem
	// Vue-Setup-Kontext erreichbar ist. Außerhalb (SSR, Tests) überspringen.
	function bindVuetify () {
		try {
			const vuetifyTheme = useTheme()
			watch(vuetifyThemeName, name => {
				vuetifyTheme.global.name.value = name
			}, { immediate: true })
		} catch {
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
```

- [ ] **Step 2: Type-Check**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
npm run type-check
```

Expected: kein Fehler.

- [ ] **Step 3: Commit**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
git add src/stores/theme.ts
git commit -m "feat(stores): theme store with preset + mode + system watch"
```

---

## Task 5: AppBar-Komponente (Dark-Toggle + Theme-Menü + Login)

**Files:**
- Create: `src/components/app-bar/AppBar.vue`

- [ ] **Step 1: Komponente schreiben**

Create `src/components/app-bar/AppBar.vue`:

```vue
<template>
	<v-app-bar :elevation="0" color="surface" height="64" density="comfortable">
		<template #prepend>
			<v-app-bar-nav-icon
				v-if="mobile"
				@click="emit('toggle-drawer')"
			/>
		</template>

		<v-app-bar-title class="text-title-large">
			F1 Tipp
		</v-app-bar-title>

		<v-spacer />

		<!-- Dark-Mode-Toggle: cycles light → system → dark -->
		<v-btn
			:icon="modeIcon"
			variant="text"
			:aria-label="`Dark Mode: ${theme.mode}`"
			@click="cycleMode"
		/>

		<!-- Theme-Picker -->
		<v-menu location="bottom end">
			<template #activator="{ props }">
				<v-btn icon="mdi-palette" variant="text" v-bind="props" aria-label="Theme wählen" />
			</template>
			<v-list density="comfortable" min-width="220">
				<v-list-subheader class="text-label-medium">Farbthema</v-list-subheader>
				<v-list-item
					v-for="p in PRESETS"
					:key="p.name"
					:active="theme.preset === p.name"
					@click="theme.setPreset(p.name)"
				>
					<template #prepend>
						<div
							class="swatch"
							:style="{ background: p.seed }"
							aria-hidden="true"
						/>
					</template>
					<v-list-item-title>{{ p.label }}</v-list-item-title>
				</v-list-item>
			</v-list>
		</v-menu>

		<!-- Login / Logout -->
		<template v-if="auth.isAuthenticated">
			<v-btn
				variant="text"
				prepend-icon="mdi-logout"
				@click="onLogout"
			>
				{{ auth.player?.display_name || auth.player?.username || 'Abmelden' }}
			</v-btn>
		</template>
		<v-btn v-else variant="text" prepend-icon="mdi-login" to="/login">
			Anmelden
		</v-btn>
	</v-app-bar>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useDisplay } from 'vuetify'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { PRESETS, type ThemeMode } from '@/themes'

const emit = defineEmits<{ 'toggle-drawer': [] }>()

const auth = useAuthStore()
const theme = useThemeStore()
const router = useRouter()
const { mobile } = useDisplay()

const modeIcon = computed(() => {
	if (theme.mode === 'light') return 'mdi-white-balance-sunny'
	if (theme.mode === 'dark')  return 'mdi-weather-night'
	return 'mdi-theme-light-dark'
})

function cycleMode () {
	const order: ThemeMode[] = ['light', 'system', 'dark']
	const idx = order.indexOf(theme.mode as ThemeMode)
	const next = order[(idx + 1) % order.length]
	theme.setMode(next)
}

function onLogout () {
	auth.logout()
	router.push('/login')
}
</script>

<style scoped>
.swatch {
	width: 20px;
	height: 20px;
	border-radius: 50%;
	border: 1px solid rgb(var(--v-theme-outline-variant));
}
</style>
```

- [ ] **Step 2: Type-Check**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
npm run type-check
```

Expected: kein Fehler.

- [ ] **Step 3: Commit**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
git add src/components/app-bar/AppBar.vue
git commit -m "feat(app-bar): MD3 app-bar with theme picker + dark toggle + login"
```

---

## Task 6: App.vue — AppBar einbauen, Drawer verschlanken, taupe raus

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: App.vue umbauen**

Replace `src/App.vue` content:

```vue
<template>
	<v-app>
		<AppBar @toggle-drawer="drawerOpen = !drawerOpen" />

		<v-navigation-drawer
			v-model="drawerOpen"
			:permanent="!mobile"
			:temporary="mobile"
			width="260"
			color="surface-container"
		>
			<div class="px-5 pt-5 pb-3">
				<div class="text-label-small text-on-surface-variant">F1 TIPSPIEL</div>
				<div class="text-title-large mt-1">Wetten</div>
			</div>

			<v-divider />

			<v-list nav>
				<template v-for="group in navGroups" :key="group.title">
					<v-list-subheader class="text-title-small">{{ group.title }}</v-list-subheader>
					<v-list-item
						v-for="item in group.items"
						:key="item.to"
						:to="item.to"
						:exact="item.exact"
						:prepend-icon="item.icon"
						:title="item.label"
					/>
				</template>

				<v-divider class="my-2" />

				<v-list-subheader class="text-title-small">Übersicht</v-list-subheader>
				<v-list-item
					to="/wettschein"
					prepend-icon="mdi-grid"
					title="Wettschein"
				/>
				<v-list-item
					to="/starting-grid"
					prepend-icon="mdi-flag-checkered"
					title="Startaufstellung"
				/>
			</v-list>
		</v-navigation-drawer>

		<v-main>
			<router-view />
		</v-main>
	</v-app>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'

import AppBar from '@/components/app-bar/AppBar.vue'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()
const { mobile } = useDisplay()
const drawerOpen = ref<boolean>(!mobile.value)

watch(mobile, isMobile => {
	// Beim Resize: auf Mobile schließen, auf Desktop öffnen.
	drawerOpen.value = !isMobile
})

onMounted(() => {
	theme.init()
	theme.bindVuetify()
})

onBeforeUnmount(() => {
	theme.destroy()
})

const navGroups = [
	{
		title: 'Mein Fahrer',
		items: [
			{ to: '/punkteliste', exact: false, label: 'Punkteliste', icon: 'mdi-trophy-award' },
			{ to: '/mein-fahrer', exact: false, label: 'Mein Fahrer', icon: 'mdi-account-star' },
			{ to: '/driver-championship', exact: false, label: 'Fahrer-WM', icon: 'mdi-trophy' },
			{ to: '/constructor-championship', exact: false, label: 'Konstrukteurs-WM', icon: 'mdi-car-sports' },
		],
	},
	{
		title: 'Renn-Wetten',
		items: [
			{ to: '/', exact: true, label: 'Top 3', icon: 'mdi-podium' },
			{ to: '/top10', exact: false, label: 'Top 10', icon: 'mdi-format-list-numbered' },
			{ to: '/pole', exact: false, label: 'Pole Position', icon: 'mdi-timer-outline' },
			{ to: '/fastest-lap', exact: false, label: 'Schnellste Runde', icon: 'mdi-speedometer' },
			{ to: '/first-dnf', exact: false, label: 'Erster Ausfall', icon: 'mdi-car-brake-alert' },
			{ to: '/driver-of-the-day', exact: false, label: 'Fahrer des Tages', icon: 'mdi-star-circle' },
		],
	},
	{
		title: 'Saison-Wetten',
		items: [
			{ to: '/team-duell', exact: false, label: 'Team-Duell', icon: 'mdi-sword-cross' },
		],
	},
]
</script>
```

- [ ] **Step 2: Type-Check**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
npm run type-check
```

Expected: kein Fehler.

- [ ] **Step 3: Smoketest**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
npm run dev
```

Browser:
1. App-Bar oben rechts zeigt Dark-Toggle + Palette-Icon + Login/User.
2. Palette-Icon öffnet Menü mit 4 Farbkacheln. Klick wechselt sichtbar das Theme.
3. Dark-Toggle cycelt 3 Zustände (Icon ändert sich: `☀` → `🌓` → `🌙`).
4. Reload: letzte Wahl wird wiederhergestellt (via piniaIdb).
5. Browser-Fenster unter 840px schrumpfen: App-Bar bekommt Hamburger links, Drawer schließt.

Stop den Dev-Server.

- [ ] **Step 4: Commit**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
git add src/App.vue
git commit -m "feat(app): wire theme store + app-bar + mobile drawer"
```

---

## Task 7: Migration `bet-card.vue`

**Files:**
- Modify: `src/components/bet-card/bet-card.vue`

- [ ] **Step 1: Datei lesen und `taupe-*`-Stellen identifizieren**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
grep -n "taupe-\|rounded-3xl" src/components/bet-card/bet-card.vue
```

Expected: Zeile 40 `class="bg-taupe-500 text-taupe-100"`, Zeile 1 `rounded-3xl`.

- [ ] **Step 2: Ersetzen**

In `src/components/bet-card/bet-card.vue`:

- `bg-taupe-500 text-taupe-100` → `bg-primary text-on-primary` (Haupt-Button-/Hero-Element: Primary-Rolle)
- `rounded-3xl` → `shape-lg` (Card)

Alle Fundstellen prüfen und per Edit anpassen.

- [ ] **Step 3: Type-Check + Dev-Smoketest**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
npm run type-check
```

Expected: kein Fehler.

```bash
npm run dev
```

Browser: Jede Seite, die eine `bet-card` nutzt (z. B. `/`, `/top10`, `/pole`), rendert sauber. Das ehemalige dunkle Taupe-Element ist jetzt in Primary-Farbe. Theme-Wechsel passt die Farbe live an.

Stop den Server.

- [ ] **Step 4: Commit**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
git add src/components/bet-card/bet-card.vue
git commit -m "refactor(bet-card): taupe-500 → primary + rounded-3xl → shape-lg"
```

---

## Task 8: Migration `list.vue` + `list-item.vue`

**Files:**
- Modify: `src/components/list/list.vue`
- Modify: `src/components/list/list-item.vue`

- [ ] **Step 1: `list.vue` anpassen**

In `src/components/list/list.vue`:

- Outer `<div class="bg-taupe-200 v-card v-theme--light v-card--density-default v-card--variant-flat coupon font-mono text-neutral-900 mb-6">`
  → `<div class="bg-surface-container coupon font-mono text-on-surface mb-6 shape-lg">`
  (Die hartcodierten `v-card`-Klassen entfernen — Vuetify generiert sie, wenn man das Element durch `<v-card>` ersetzt. Hier reicht ein normales `div`, das Visual-Grid steuert die Card-Semantik eh. Theme-Variante `v-theme--light` **immer** rausnehmen — bricht Dark-Mode.)
- Inner `<v-list lines="two" class="bg-taupe-200 mx-4 px-4 py-1 rounded-2xl">`
  → `<v-list lines="two" bg-color="surface-container" class="mx-4 px-4 py-1 shape-lg">`

Finaler Head:
```vue
<template>
	<div class="bg-surface-container coupon font-mono text-on-surface mb-6 shape-lg">
		<v-list lines="two" bg-color="surface-container" class="mx-4 px-4 py-1 shape-lg">
			<!-- ... Rest unverändert ... -->
```

- [ ] **Step 2: `list-item.vue` anpassen**

In `src/components/list/list-item.vue`:

- `<v-list-item class="font-mono bg-taupe-200" :subtitle="subtitle" :title="title">`
  → `<v-list-item class="font-mono bg-surface-container" :subtitle="subtitle" :title="title">`

- [ ] **Step 3: Type-Check + Dev-Smoketest**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
npm run type-check
```

Expected: kein Fehler.

```bash
npm run dev
```

Browser: `/` (Top3-Wettschein-Liste) und `/top10` zeigen Listen in `surface-container`-Farbe. Theme-/Dark-Wechsel ändert Hintergrund live. Stop den Server.

- [ ] **Step 4: Commit**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
git add src/components/list/list.vue src/components/list/list-item.vue
git commit -m "refactor(list): taupe-200 → surface-container + remove hardcoded v-theme--light"
```

---

## Task 9: Migration `punkteliste.vue` + `constructorChampionship.vue`

**Files:**
- Modify: `src/pages/punkteliste.vue`
- Modify: `src/pages/constructorChampionship.vue`

- [ ] **Step 1: `punkteliste.vue` — alle taupe-Stellen finden**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
grep -n "taupe-\|rounded-3xl" src/pages/punkteliste.vue
```

Expected (nach PF-3-Zählung):
- Zeile ~120: `:class="{ 'bg-taupe-200': isMe(row) }"`
- Zeile ~239: `class="bg-taupe-500 text-taupe-100"`
- Zwei `rounded-3xl`

Ersetzen:
- `'bg-taupe-200': isMe(row)` → `'bg-primary-container text-on-primary-container': isMe(row)` (eigene Zeile hervorheben = Primary-Container-Rolle)
- `bg-taupe-500 text-taupe-100` → `bg-primary text-on-primary` (Admin-Call-to-Action)
- `rounded-3xl` → `shape-lg`

- [ ] **Step 2: `constructorChampionship.vue` — Stellen finden**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
grep -n "taupe-\|rounded-3xl" src/pages/constructorChampionship.vue
```

Expected:
- Zeile ~36: `class="bg-taupe-500 text-taupe-100"`
- Zwei `rounded-3xl`

Ersetzen:
- `bg-taupe-500 text-taupe-100` → `bg-primary text-on-primary`
- `rounded-3xl` → `shape-lg`

- [ ] **Step 3: Rest-Scan auf übrige `taupe-`-Fundstellen**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
grep -rn "taupe-" src/
```

Expected: **leer** (0 Zeilen). Falls doch noch was auftaucht: analog zu Primary/Surface-Container ersetzen (Semantik anhand des Kontexts entscheiden — Hero/CTA = Primary, Row-Highlight = Primary-Container, Panel = Surface-Container).

- [ ] **Step 4: Type-Check + Dev-Smoketest**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
npm run type-check
```

Expected: kein Fehler.

```bash
npm run dev
```

Browser:
1. `/punkteliste`: Eigene Zeile ist durch Primary-Container hervorgehoben, Admin-Buttons in Primary.
2. `/constructor-championship`: CTA-Element in Primary.
3. Theme-Switch wechselt alle Farben live. Dark-Mode zeigt korrekte Kontraste.

Stop den Server.

- [ ] **Step 5: Commit**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
git add src/pages/punkteliste.vue src/pages/constructorChampionship.vue
git commit -m "refactor(pages): remove last taupe-* references, use MD3 roles"
```

---

## Task 10: End-to-End-Verifikation + Spec-Status-Update

**Files:**
- Modify: `docs/superpowers/specs/2026-10-24-md3-redesign-design.md` (Status-Block anhängen)

- [ ] **Step 1: Full Type-Check**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
npm run type-check
```

Expected: kein Fehler.

- [ ] **Step 2: Grep-Rest-Check**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
grep -rn "taupe-" src/ && echo "FAIL — noch taupe-Reste" || echo "OK — kein taupe-Rest"
grep -rn "rounded-3xl" src/ | wc -l
```

Expected:
- „OK — kein taupe-Rest"
- Zählung `rounded-3xl` reduziert gegenüber Pre-Flight (PF-3 nennt 1+1+3+1+1+2+1+2 = 12 Vorkommen, nach den Migrationen bleiben nur die in **nicht** touched files — `login.vue`, `startingGrid.vue`, `meinFahrer.vue`, `wettschein.vue`, `single-driver-bet-card.vue`). **Diese bleiben bewusst** — ihre Migration ist nicht Scope dieser Phase.

- [ ] **Step 3: Manuelles QA-Protokoll (Dev-Server)**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
npm run dev
```

Durchklicken:

1. **Theme-Wechsel**: alle 4 Presets (F1-Rot, Taupe, Racing Green, Midnight) ausprobieren. Jedes Preset × Dark/Light sichtbar unterschiedlich und lesbar.
2. **Dark-Toggle**: Icon cycelt ☀ → 🌓 → 🌙. „System" folgt OS-Theme (OS-Dark-Mode einschalten → App wechselt).
3. **Persistenz**: Preset + Mode wählen, Reload — Wahl überlebt.
4. **Mobile**: Fenster unter 840 px: Drawer schließt, Hamburger erscheint, Click öffnet Drawer als Overlay.
5. **Seiten durchklicken**: `/`, `/top10`, `/pole`, `/fastest-lap`, `/first-dnf`, `/driver-of-the-day`, `/team-duell`, `/driver-championship`, `/constructor-championship`, `/punkteliste`, `/mein-fahrer`, `/wettschein`, `/starting-grid` — keiner krasst aus, nirgends mehr unresolved `bg-taupe-*`.
6. **Admin-Flow** (als Admin eingeloggt): `/punkteliste` Admin-Section-Buttons in Primary-Farbe.

Falls ein Issue auftaucht: Fix als Hotfix-Task hier anhängen, dann weiter.

Stop den Server.

- [ ] **Step 4: Spec-Status-Block anhängen**

An `docs/superpowers/specs/2026-10-24-md3-redesign-design.md` ans Ende:

```markdown

---

> **Status:** umgesetzt gemäß `docs/superpowers/plans/2026-10-24-md3-redesign.md`.
```

- [ ] **Step 5: Final-Commit**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
git add docs/superpowers/specs/2026-10-24-md3-redesign-design.md
git commit -m "docs(specs): mark MD3-Redesign complete"
```

---

## Offene Punkte (nicht Teil dieser Phase)

- `rounded-3xl`-Vorkommen in `login.vue`, `startingGrid.vue`, `meinFahrer.vue`, `wettschein.vue`, `single-driver-bet-card.vue` bleiben bestehen. Separate Migrations-Phase, wenn Zeit ist — Mapping ist trivial (`shape-lg` oder `shape-xl` je nach Rolle).
- Rohe Tailwind-Typografie (`text-sm`, `text-lg`, `text-[10px]`) im Repo: bleibt vorerst, die neuen `text-{display,headline,title,body,label}-*`-Utilities stehen zur Verfügung, aber kein Big-Bang-Ersetzen.
- Expressive-MD3-Variante (dyn. Hero-Shapes, Pattern-BGs, Motion-Tokens): bewusst nicht in dieser Phase.
- `/standings`-Public-Page (siehe Phase 5 Offene Punkte): weiterhin offen, unabhängig.
- Preset-Namen-Lokalisierung via `i18n.ts`: der Switcher nutzt derzeit statische deutsche Labels in `src/themes/index.ts`. Falls EN-Support kommt: `PRESETS[i].label` auf `t('theme.presets.<name>')` umstellen.
