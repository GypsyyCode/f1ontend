# Prompt: F1-Tipspiel Admin-Frontend mit Vuetify

## Rolle & Aufgabe

Du baust das **Admin-Frontend** für ein F1-Tippspiel ("F1-Tipspiel"). Es ist eine eigenständige Vue-3-Anwendung, getrennt von der Public-App, und nutzt **Vuetify 3** als Komponenten-Bibliothek.

Ziel: Ein funktionsfähiges, gut strukturiertes Admin-Interface, mit dem ein Spielleiter Stammdaten pflegt, Wettscheine konfiguriert, Ergebnisse einträgt und die Auswertung anstößt.

---

## Sprach- und Namenskonventionen (verbindlich)

- **Code, JSON, Types, Datei- und Variablennamen: immer Englisch**
- **Sichtbare UI-Texte: Deutsch** (Labels, Buttons, Fehlermeldungen, Tabellenüberschriften)
- **Erklärungen und Kommentare im Chat: Deutsch**
- Vue-Komponenten in PascalCase, Composables mit `use`-Präfix

Beispiel: Eine Komponente heißt `DriverTable.vue`, die Spaltenüberschrift darin lautet `Fahrer`.

---

## Technischer Stack (fest vorgegeben)

| Bereich | Technologie |
|---|---|
| Framework | Vue 3, **ausschließlich Composition API in `<script setup>`** |
| Build | Vite |
| State | Pinia (Setup-Stores, kein Options-Style) |
| UI | Vuetify 3 |
| Sprache | JavaScript in Vue-Komponenten/Stores, TypeScript im `shared/`-Ordner |
| Routing | Vue Router 4 |

Wichtig: In der Admin-App wird **Vuetify für das Styling verwendet** – hier also keine eigenen CSS-Dateien pro Komponente, sondern Vuetify-Komponenten, deren Props und ein zentrales Theme. (Die Public-App nutzt custom CSS – die ist hier aber nicht Thema.)

---

## Projektstruktur

Die Admin-App liegt parallel zur Public-App und teilt sich mit ihr einen `shared/`-Ordner:

```
f1-tipspiel/
├── shared/                     # geteilt mit der Public-App
│   ├── api/
│   │   ├── client.ts           # existiert bereits
│   │   ├── teams.ts
│   │   ├── drivers.ts
│   │   └── favoriteTeam.ts
│   └── types/
│       ├── team.ts
│       └── driver.ts
│
└── admin/                      # DIESE App
    ├── src/
    │   ├── components/
    │   ├── composables/
    │   ├── layouts/
    │   ├── plugins/
    │   │   └── vuetify.js
    │   ├── router/
    │   ├── stores/
    │   ├── views/
    │   ├── App.vue
    │   └── main.js
    └── vite.config.js
```

Vite-Aliases: `@` → `admin/src`, `@shared` → `shared`.

Neue API-Funktionen und Types, die beide Apps brauchen könnten, gehören nach `shared/`. Rein administrative Endpunkte (z.B. Ergebnis-Import) dürfen in `admin/src/api/` liegen.

---

## Bestehende Types (aus dem Go-Backend abgeleitet)

```ts
// shared/types/team.ts
export interface Team {
  id: number
  name: string
  shortName: string      // z.B. "RBR", "MER"
  colour: string         // Hex, z.B. "#3671C6"
  season: number
  logoUrl?: string | null
}

// shared/types/driver.ts
export interface Driver {
  id: number
  driverNumber: number
  firstName: string
  lastName: string
  fullName: string
  nameAcronym: string    // z.B. "VER", "HAM"
  countryCode: string
  headshotUrl?: string | null
  teamId: number
}
```

Ergänze passende Types für `Race`, `Session`, `BetSlip` und `Bet` selbst – orientiere dich am Datenmodell unten und halte dich an denselben Stil.

---

## Fachliches Datenmodell (Hintergrund)

Das Backend ist Go + GORM + PostgreSQL. Relevante Struktur:

**`WETTSCHEIN` (BetSlip)** – Single-Table mit Diskriminator-Spalte `typ`:
- `typ` ∈ `race` | `season` | `team`
- Je nach Typ ist ein anderer FK gesetzt (nullable): Race-FK, Season-FK, Team-FK
- Ein Wettschein bündelt mehrere Wetten und hat eine Abgabefrist (Deadline)

**`WETTE` (Bet)** – die einzelne Tipp-Position:
- Enthält eine **JSON-Spalte (`jsonb`)** für die typspezifischen Parameter der Wettart
- Es gibt **24 Wettarten**, verteilt auf die Kategorien Race, Team und Season
- Beispiele für Wettarten-Shapes: Ranking (Reihenfolge von Fahrern), Driver-Pick (ein Fahrer), Yes/No, Bracket/Bereich, Exact Value (Zahl), Range Containment (Wert liegt in Intervall), Both Drivers (beide Fahrer eines Teams), Rank with Tolerance

**Lieblingsteam-Mechanik:** Jeder Spieler wählt pro Saison genau ein Lieblingsteam. Daraus entsteht eine zweite, separate Wertung.

**Scoring:** Eine TypeScript-Scoring-Engine bewertet Wetten anhand ihrer Datenform (`scoreRanking`, `scoreDriverPick`, `scoreYesNo`, `scoreBracket`, `scoreExactValue`, `scoreRangeContainment`, `scoreBothDrivers`, `scoreRankWithTolerance`).

**Datenquellen:** OpenF1 API (Live-Telemetrie, ~3s Latenz), Jolpica-F1 (historische Daten).

---

## Zu bauende Screens

Baue diese Views, jeweils mit Vuetify-Komponenten:

### 1. Dashboard (`/`)
Überblick: nächstes Rennen, offene Wettscheine, Anzahl abgegebener Tipps, Status der letzten Datensynchronisation. Nutze `v-card`-Kacheln.

### 2. Stammdaten – Teams (`/teams`)
`v-data-table` mit allen Teams einer Saison. Saison per `v-select` filterbar. Spalten: Name, Kürzel, Farbe (als Farb-Chip mit `colour`-Wert), Logo. CRUD über `v-dialog`-Formulare. Farbwahl per Color-Picker.

### 3. Stammdaten – Fahrer (`/drivers`)
`v-data-table` mit Fahrern, Team-Zuordnung als Chip in Teamfarbe. Filter nach Saison und Team. CRUD über Dialog. Feld `driverNumber` numerisch validiert.

### 4. Rennkalender (`/races`)
Liste der Rennen einer Saison mit Datum, Strecke, Land, Session-Typen. Möglichkeit, ein Rennen als "abgeschlossen" zu markieren.

### 5. Wettscheine (`/bet-slips`)
Übersicht aller Wettscheine mit Typ-Chip (`race`/`season`/`team`), Deadline und Status. Detail-/Editieransicht, in der die enthaltenen Wetten konfiguriert werden: Wettart auswählen, Parameter im JSON-Schema-Formular pflegen, Punktwert festlegen.

**Das ist der anspruchsvollste Screen.** Die 24 Wettarten haben unterschiedliche Parameter-Shapes. Baue dafür eine Formular-Komponente, die abhängig von der gewählten Wettart die passenden Felder rendert (z.B. Fahrer-Mehrfachauswahl bei Ranking, Zahlenfeld bei Exact Value, Intervall-Felder bei Range Containment). Definiere die Wettarten in einer zentralen Konfigurationsdatei (`betTypes.js`), die pro Wettart Key, Kategorie, deutsches Label und Parameter-Schema enthält.

### 6. Ergebnisse eintragen (`/results`)
Formular zum Erfassen der offiziellen Rennergebnisse pro Rennen. Option, Ergebnisse aus der OpenF1/Jolpica-API zu importieren statt manuell einzugeben. Danach: Button "Auswertung starten", der die Scoring-Engine anstößt, mit Bestätigungsdialog.

### 7. Spieler (`/players`)
Tabelle aller Teilnehmer mit Punktestand, gewähltem Lieblingsteam und Anzahl abgegebener Tipps.

---

## Layout & UX

- Persistente `v-navigation-drawer` links mit Icon-Navigation, `v-app-bar` oben
- **Dark Theme als Standard**, thematisch an F1-Live-Timing angelehnt (dunkler Hintergrund, kräftige Akzentfarben). Konfiguriere das über das Vuetify-Theme in `plugins/vuetify.js`, nicht per Override-CSS.
- Teamfarben (`team.colour`) sollen dort, wo Teams auftauchen, als visueller Anker dienen – etwa als Chip-Farbe oder farbiger Rand
- Loading-States über `v-skeleton-loader` oder `loading`-Props, Fehler über `v-alert`
- Bestätigungsdialoge bei destruktiven Aktionen (Löschen, Auswertung starten)
- Responsive bis Tablet-Breite; Mobile hat für den Admin niedrige Priorität
- Formularvalidierung über Vuetify-Rules, deutschsprachige Fehlermeldungen

---

## Pinia Stores

Lege pro Domäne einen Setup-Store an: `teamStore`, `driverStore`, `raceStore`, `betSlipStore`, `playerStore`, `resultStore`.

Muster, an dem du dich orientieren sollst (bereits vorhanden in der Public-App):

```js
export const useTeamStore = defineStore('team', () => {
  const teams = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function loadTeams(season) {
    loading.value = true
    error.value = null
    try {
      teams.value = await fetchTeams(season)
    } catch (err) {
      error.value = err.message ?? 'Teams konnten nicht geladen werden.'
    } finally {
      loading.value = false
    }
  }

  return { teams, loading, error, loadTeams }
})
```

Bei schreibenden Operationen: optimistisches Update mit Rollback im Fehlerfall.

---

## Backend-Endpunkte (Annahme, ggf. anpassbar)

```
GET    /api/teams?season=
POST   /api/teams
PUT    /api/teams/:id
DELETE /api/teams/:id

GET    /api/drivers?season=&teamId=
POST   /api/drivers
PUT    /api/drivers/:id
DELETE /api/drivers/:id

GET    /api/races?season=
GET    /api/bet-slips?season=
POST   /api/bet-slips
PUT    /api/bet-slips/:id
GET    /api/players?season=
POST   /api/results/:raceId
POST   /api/results/:raceId/import
POST   /api/scoring/run
```

---

## Vorgehen

1. Lege zuerst die Projektstruktur, `vite.config.js`, `main.js`, das Vuetify-Plugin mit Theme und den Router an
2. Dann Types und API-Funktionen
3. Dann die Stores
4. Dann Layout und Navigation
5. Dann die Views – beginne mit Teams und Drivers, danach Bet Slips
6. Erkläre kurz auf Deutsch, welche Designentscheidungen du getroffen hast, insbesondere beim dynamischen Wettarten-Formular

Wenn dir Informationen fehlen (etwa das genaue Parameter-Schema einer Wettart), triff eine begründete Annahme, markiere sie als solche und mach weiter – frag nicht bei jedem Detail nach.
