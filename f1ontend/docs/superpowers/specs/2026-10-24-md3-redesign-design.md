# MD3-Redesign (F1-Tipp FE) — Design Spec

**Datum:** 2026-10-24
**Scope:** Frontend-weites Theming-System auf Basis von Material Design 3 (MD3).
**Status:** brainstormed, zur Umsetzung freigegeben → Implementation-Plan folgt.

---

## 1. Ziel & Motivation

Die aktuelle App nutzt rohe Tailwind-Utilities (`rounded-3xl`, `text-sm`, `bg-taupe-200`) ohne System. Die `taupe-*`-Klassen sind nirgendwo definiert — der sichtbare Look ist faktisch Vuetify-Default-Surface mit uneinheitlicher Typografie und Rundung. Diese Spec etabliert ein konsistentes MD3-basiertes Design-System mit vier austauschbaren Farbthemes, Dark-Mode-Steuerung und einer definierten Type-/Shape-/Density-Hierarchie.

**Nicht-Ziel dieser Phase:** Komponenten-Refactor über das hinaus, was nötig ist, um das neue System einzuführen. Einzelne Seiten (Punkteliste, Wettschein) bleiben strukturell gleich.

---

## 2. Design-Entscheidungen (Brainstorming-Ergebnis)

| # | Thema | Entscheidung |
|---|---|---|
| 2 | Farb-Seed (Default) | **F1-Rot** `#E10600` |
| 3 | Theme-Presets im Switcher | F1-Rot (Default), Taupe, Racing Green, Midnight |
| 4 | Switcher-Ort | App-Bar oben rechts, Theme-Icon öffnet Menü |
| 5 | Dark Mode | Manuell: **Light / Dark / System** (Default: System) |
| 6 | Nav-Pattern (Desktop) | Permanenter Nav-Drawer, 260 px (bleibt) |
| 7 | Nav-Pattern (Mobile) | Drawer wird `temporary` (Vuetify-Overlay via Breakpoint) |
| 8 | Typografie | Roboto über MD3 Type-Scale (Display/Headline/Title/Body/Label) |
| 9 | Shape-Scale | **D — Mixed:** flache Cards (lg · 16 px) + Pill-Buttons/Chips (full) |
| 10 | Density + Elevation | **A — Comfortable + Tonal:** großzügiges Padding, tonale Surfaces, kaum Shadows |

---

## 3. Design-Tokens

Alle Tokens werden als CSS-Custom-Properties exportiert und sind sowohl für Vuetify (`v-theme--*`) als auch für Tailwind (`@theme`-Block) verfügbar.

### 3.1 Farbe

Pro Preset × Modus (Light/Dark) ein MD3-Tonal-Palette-Set, generiert aus einem Seed-Hex-Wert. Vier Presets:

| Preset | Seed | Charakter |
|---|---|---|
| `f1-red` (Default) | `#E10600` | Branding, hoher Kontrast, Tech-Look |
| `taupe` | `#8A7B6E` | Warm-neutral, zurückhaltend (aktueller App-Vibe) |
| `racing-green` | `#1F4D3A` | Klassisch, Heritage-Feel |
| `midnight` | `#1A2744` | Dunkel-Blau, Night-Race-Flair |

Pro Set werden folgende MD3-Rollen gesetzt:
`primary`, `on-primary`, `primary-container`, `on-primary-container`, `secondary`, `on-secondary`, `secondary-container`, `on-secondary-container`, `tertiary`, `on-tertiary`, `tertiary-container`, `on-tertiary-container`, `surface`, `on-surface`, `surface-container`, `surface-container-high`, `surface-container-highest`, `error`, `on-error`, `outline`, `outline-variant`.

**Erzeugung:** einmalig per `@material/material-color-utilities` (NPM-Paket) → statische JSON pro Preset ins Repo einchecken. **Keine** Runtime-Palette-Generation.

### 3.2 Typografie

Roboto (bereits via `unplugin-fonts` eingebunden). MD3 Type-Scale als Tailwind-Utilities + Vuetify-SCSS-Settings:

| Rolle | Größe | Line-Height | Weight | Letter-Spacing | Verwendung |
|---|---|---|---|---|---|
| `display-large` | 57 px | 64 px | 400 | -0.25 | Hero (nur Login/Landing) |
| `display-medium` | 45 px | 52 px | 400 | 0 | – |
| `display-small` | 36 px | 44 px | 400 | 0 | – |
| `headline-large` | 32 px | 40 px | 400 | 0 | Seitentitel |
| `headline-medium` | 28 px | 36 px | 400 | 0 | Kartenüberschriften |
| `headline-small` | 24 px | 32 px | 400 | 0 | Section-Headings |
| `title-large` | 22 px | 28 px | 500 | 0 | Dialog-Titel |
| `title-medium` | 16 px | 24 px | 500 | 0.15 | Card-Header |
| `title-small` | 14 px | 20 px | 500 | 0.1 | List-Group-Header |
| `body-large` | 16 px | 24 px | 400 | 0.5 | Fließtext |
| `body-medium` | 14 px | 20 px | 400 | 0.25 | Standard-Body |
| `body-small` | 12 px | 16 px | 400 | 0.4 | Captions |
| `label-large` | 14 px | 20 px | 500 | 0.1 | Button-Text |
| `label-medium` | 12 px | 16 px | 500 | 0.5 | Chip-Text, Tags |
| `label-small` | 11 px | 16 px | 500 | 0.5 | Overline, Metadata |

**Mono-Font** (Roboto Mono) bleibt für Timing-Daten/Code reserviert (bereits via `--font-mono`).

### 3.3 Shape

Mixed-Scale (Entscheidung D aus Frage 9):

| Rolle | Radius | Tailwind-Utility |
|---|---|---|
| Cards | 16 px | `rounded-2xl` (bzw. neue `shape-lg`) |
| Dialog | 28 px | `rounded-[28px]` (bzw. `shape-xl`) |
| Buttons | full (pill) | `rounded-pill` *(bereits vorhanden)* |
| Chips | full (pill) | `rounded-pill` |
| Inputs | 4 px | `rounded` |
| Sheets | 0 px | – |

Neue Semantik-Utilities werden als `@utility shape-{none,xs,sm,md,lg,xl,full}` eingeführt und ersetzen die ad-hoc `rounded-3xl` im Code. Mapping zu MD3-Tokens: `shape-xs=4`, `shape-sm=8`, `shape-md=12`, `shape-lg=16`, `shape-xl=28`.

### 3.4 Density

Vuetify-Density auf **`comfortable`** als globaler Default (`v-list`, `v-btn`, `v-text-field`, `v-chip`). Keine App-weite `compact`-Umschaltung — die Entscheidung ist bewusst „A" (Comfortable).

### 3.5 Elevation

Tonal (MD3-Expressive). Nutzung der bereits definierten `elevation-{0..5}`-Utilities:

| Rolle | Level | Umsetzung |
|---|---|---|
| Static Cards | 0 | tonale Surface (`surface-container` statt Shadow) |
| List-Items | 0 | tonal |
| Buttons (resting) | 0 | tonal |
| Buttons (hover/focus) | 1 | subtiler Shadow |
| Dialog / Menu | 3 | sichtbarer Shadow |
| FAB / SnackBar | 3 | sichtbarer Shadow |

**Flache App als Grundton**, nur Floating-Elements kriegen echten Shadow.

---

## 4. Theme-Switcher

### 4.1 UI-Position

Neue **`AppBar`** (Vuetify `v-app-bar`) oben, Höhe 64 px, `elevation="0"`, Background `surface`. Rechts drei Elemente:

1. **Dark-Mode-Toggle** (Icon-Button, cycles ☀/🌓/🌙 → Light/System/Dark)
2. **Theme-Picker** (Icon-Button `mdi-palette`, öffnet `v-menu` mit vier Farbkacheln)
3. **User-Avatar / Login-Button** (statt des aktuellen Buttons unten im Drawer; der Drawer behält nur Navigation)

### 4.2 Datenfluss

Neuer Pinia-Store `src/stores/theme.ts`:

```ts
state: {
  preset: 'f1-red' | 'taupe' | 'racing-green' | 'midnight'   // Default: 'f1-red'
  mode:   'light' | 'dark' | 'system'                        // Default: 'system'
}
getters: {
  effectiveMode(): 'light' | 'dark'   // resolved against prefers-color-scheme
  vuetifyThemeName(): string           // z. B. 'f1-red-light'
}
actions: {
  setPreset(p), setMode(m)
}
```

Beide Felder werden automatisch via `piniaIdbPlugin` persistiert — der Plugin hydratisiert jeden Store aus IndexedDB (Debounce 120 ms), außer er steht in `IGNORED_STORES`. Der `theme`-Store wird **nicht** ignoriert; `season` dient hier als Negativ-Referenz (dort explizit ausgenommen). Beim App-Start lädt der Store den Wert und setzt Vuetify's `theme.global.name` entsprechend.

**System-Mode-Reaktivität:** `window.matchMedia('(prefers-color-scheme: dark)')`-Listener aktualisiert `effectiveMode` live.

### 4.3 Vuetify-Theme-Config

`src/plugins/vuetify.ts` wird erweitert:

```ts
createVuetify({
  theme: {
    defaultTheme: 'f1-red-light',   // wird durch Store überschrieben
    themes: {
      'f1-red-light':      { dark: false, colors: {...} },
      'f1-red-dark':       { dark: true,  colors: {...} },
      'taupe-light':       { dark: false, colors: {...} },
      'taupe-dark':        { dark: true,  colors: {...} },
      'racing-green-light':{ dark: false, colors: {...} },
      'racing-green-dark': { dark: true,  colors: {...} },
      'midnight-light':    { dark: false, colors: {...} },
      'midnight-dark':     { dark: true,  colors: {...} },
    },
  },
  display: { /* unverändert */ },
  defaults: {
    VBtn:  { rounded: 'pill' },
    VChip: { rounded: 'pill' },
    VCard: { rounded: 'lg', elevation: 0, variant: 'flat' },
    VList: { density: 'comfortable' },
    VTextField: { density: 'comfortable', rounded: 'sm', variant: 'outlined' },
  },
})
```

Acht Themes = 4 Presets × 2 Modi. Farben kommen aus statischen JSON-Dateien unter `src/themes/*.json`.

### 4.4 Tailwind-Integration

`src/styles/tailwind.css` wird ergänzt um:

- MD3-Rollen als CSS-Variablen aus Vuetify (`rgb(var(--v-theme-primary-container))` etc.) — kompletter Rollen-Satz.
- Shape-Utilities (`shape-{none,xs,sm,md,lg,xl,full}`).
- Typography-Utilities (`text-display-large`, `text-body-medium`, `text-label-small`, …) — als `@utility`-Blöcke mit Font-Size + Line-Height + Weight + Letter-Spacing.

Bestehende generische Tailwind-Klassen (`text-sm`, `rounded-3xl`) bleiben funktional, werden aber im Code schrittweise durch Semantik-Klassen ersetzt (siehe Rollout).

---

## 5. Navigation (Desktop + Mobile)

### 5.1 Desktop (≥ 840 px)

- Permanent-Drawer 260 px (unverändert).
- Neue App-Bar oben über `v-main` + Drawer.
- Login-Button wandert aus Drawer-Footer in App-Bar.

### 5.2 Mobile (< 840 px)

- Drawer wird `temporary` (Vuetify-Standard-Verhalten über Breakpoint).
- App-Bar bekommt links `mdi-menu`-Button zum Öffnen des Drawers.
- Scrim deckt Content ab, Click außerhalb schließt.

### 5.3 Keine Rail-Variante

Bewusster Verzicht trotz MD3-Rail-Option — Drawer-Breite reicht für die Section-Titel („Mein Fahrer", „Renn-Wetten", „Saison-Wetten"), eine Rail würde die Gliederung opfern.

---

## 6. Persistenz & Boot-Sequenz

1. `main.ts`: Vuetify-Plugin wird mit allen 8 Themes registriert.
2. `App.vue` `onBeforeMount`: Theme-Store wird aus IndexedDB geladen.
3. Store berechnet `vuetifyThemeName` und ruft `theme.global.name.value = …`.
4. `matchMedia`-Listener wird registriert und reagiert auf OS-Theme-Wechsel.
5. UI rendert mit korrektem Theme — kein FOUC, weil Default (`f1-red-light`) bereits beim Plugin-Init gesetzt ist.

**Edge Case:** Bei leerer IndexedDB wird `preset='f1-red'`, `mode='system'` genommen (expliziter Default).

---

## 7. Rollout / Migration

Reihenfolge (kein Big-Bang):

1. **Tokens einführen:** Farben-JSONs, Shape-/Typo-Utilities, Vuetify-Theme-Config, Tailwind-Erweiterungen. Noch keine UI-Änderung sichtbar außer: Default-Theme `f1-red-light` ersetzt den „taupe"-Nicht-Look.
2. **Theme-Store + App-Bar:** Switcher + Dark-Toggle wirken.
3. **App-Shell:** App.vue bekommt App-Bar, Drawer-Hintergrund wechselt von `bg-taupe-300` auf `surface-container`.
4. **Komponenten-Migration:** `bet-card.vue`, `list.vue`, `list-item.vue`, `punkteliste.vue`, `constructorChampionship.vue` — ad-hoc `taupe-*`-Klassen werden durch Rollenfarben ersetzt. Rounded-3xl → shape-lg bzw. shape-xl. Rohe `text-sm`/`text-lg` → Typo-Utilities.
5. **QA:** Alle 8 Theme-Kombinationen durchklicken, Kontrast-Werte prüfen (MD3-generierte Palette garantiert WCAG AA innerhalb Preset × Mode).

Jeder Schritt ist eigenständig deploybar; falls Phase 4 ins Stocken gerät, bleibt die App mit altem Markup auf neuem Theme nutzbar.

---

## 8. Fehlerfälle & Fallbacks

- **IndexedDB nicht verfügbar** (Private Mode, alte Browser): Store fällt auf In-Memory-State zurück, Preset+Mode-Wahl überlebt den Reload nicht. Kein User-sichtbarer Fehler.
- **Fehlende Theme-JSON:** Vuetify fällt auf `defaultTheme` zurück (`f1-red-light`). Store-Logik validiert Preset-Namen gegen ein hartcodiertes Enum, unbekannte Werte werden auf `f1-red` normalisiert.
- **System-Preference nicht lesbar** (`matchMedia` nicht verfügbar): `effectiveMode` fällt auf `light`.

---

## 9. Testing

- Kein neuer Unit-Test-Runner im FE (konsistent mit Projekt-Konvention: `npm run type-check` ist das Gate).
- Manuelles QA-Protokoll:
  1. Preset-Switch wirkt sofort und persistiert über Reload.
  2. Dark-Toggle cycelt in 3 Zuständen; „System" folgt OS live.
  3. App-Bar bleibt bei Mobile sichtbar, Drawer öffnet via Hamburger.
  4. Alle 4 Presets × 2 Modi = 8 Kombinationen zeigen lesbare Kontraste auf `/`, `/punkteliste`, `/constructor-championship`, `/wettschein`.

---

## 10. Scope / Nicht-Scope

**In Scope:**
- Alle 10 Design-Entscheidungen oben.
- Vuetify + Tailwind-Tokens.
- Theme-Store + App-Bar.
- Migration der 5 Komponenten mit `taupe-*`-Rückständen.

**Nicht Scope (eigene Phasen):**
- Umbau einzelner Pages auf MD3-Komponenten-Patterns (z. B. `v-list` vs. Custom-Listen in `list.vue`).
- Animations/Motion-Tokens (MD3 Motion-System).
- Icon-Set-Konsistenz-Audit (bleibt bei MDI).
- Expressive-Variante (dyn. Hero-Shapes, Pattern-BGs).
- Accessibility-Audit über WCAG-Kontrast hinaus (Focus-Rings, Reduced-Motion).

---

## 11. Offene Punkte für Follow-ups

- Entscheidung, ob die MD3-Palette-Generation einmalig lokal läuft (Script in `scripts/`) oder als Build-Step — pragmatisch für Phase 1: einmalig lokal, Ergebnis einchecken.
- Preset-Namen in UI: aktuell technisch (`racing-green`), eventuell Lokalisierung über `i18n.ts` nötig.
- Eventuell weitere Presets später („Monaco-White", „Monza-Red") — Switcher-UI muss auf > 4 skalieren können (Grid statt feste Zeile).

---

> **Status:** umgesetzt gemäß `docs/superpowers/plans/2026-10-24-md3-redesign.md`.
