# Saison-Wetten-Scoring — Design Spec

**Datum:** 2026-10-24
**Status:** **umgesetzt** auf Branch `phase5-season-scoring` in beiden Repos (`f1-tip-game` + `f1ontend`). Siehe Implementation-Plan `docs/superpowers/plans/2026-10-24-saison-wetten-scoring.md`.
**Vorgänger:** Phase 3b (`2026-10-21-scoring-leaderboard.md`), Phase 4 (`2026-10-23-phase4-remaining-race-scorings.md`)
**Nachfolger:** separate Implementation-Pläne (BE + FE), erzeugt via `writing-plans`

**Nebenbefund aus der Umsetzung:** Bei der Verifikation von Task 7 ist aufgefallen, dass die bereits existierenden JSONB-Queries aus Phase 3b (`ScoreSession`, Leaderboard-Repository) den Pfad `schema::jsonb -> 'data' ->> …` benutzten — aber `coupons.Schema[T].Value()` serialisiert nur `Data` ohne `{"data": …}`-Wrapper. Die Queries hatten also nie Zeilen getroffen. Alle drei Call-Sites sind in Commit `00e2be5` auf `schema::jsonb ->> …` korrigiert.

---

## Ziel

Scoring für die drei bisher nicht gewerteten Saison-Wettarten umsetzen:

- `teamDuell` — zwei Fahrer, Sieger-Pick muss am Saisonende in der Fahrer-WM vor dem Verlierer-Pick stehen.
- `driverChampionshipRank` — ein Fahrer-Pick + prognostizierter WM-Rang (1–20+).
- `constructorChampionshipRank` — ein Team-Pick + prognostizierter Konstrukteurs-Rang (1–10).

Phase 3b/4 hat die Infrastruktur für Session-gebundenes Scoring geschaffen (Dispatcher in `coupons/scoring`, `session_aggregates`, Admin-Buttons auf `/punkteliste`). Diese Spec hebt diese Mechanik auf Saison-Ebene.

## Nicht-Ziele

- Keine neue öffentliche Transparenz-Seite für Saison-Standings. (Admin-UI reicht fürs MVP.)
- Keine automatische Benachrichtigung an Spieler nach Scoring.
- Keine historischen Saisons im Admin-Dropdown (nur aktuelle Saison im MVP).
- Kein Tie-Break nach FIA-Regeln (Punktgleichheit → komplexes Count-Back nach Siegen/Zweiten/…). MVP nutzt lexikografischen Sekundär-Sort und dokumentiert das.

---

## Zentrale Entscheidungen (aus Brainstorming)

| # | Thema | Entscheidung | Begründung |
|---|---|---|---|
| 1 | Scope | Alle drei Saison-Wetten in einer Spec/Phase | Viel geteilte Infrastruktur (Trigger, Admin-UI, Scheduler). |
| 2 | Datenquelle | **Hybrid**: Compute aus `models.Result` + Admin-Override möglich | Zero Manual-Entry als Default, aber korrigierbar wenn Sync lückenhaft. |
| 3a | Scoring Driver/Constructor-WM | Exakt → **5 Pkt**, ±1 → **2 Pkt**, sonst 0 | Höhere Gewichtung als Session-Wetten (Jahr im Voraus schwerer). |
| 3b | Scoring Team-Duell | Binär **3 Pkt** / 0 | Konsistent mit Phase-4-Einzelwerten; Duell ist Yes/No. |
| 4 | Saison-Zuordnung | `season_year` ins Schema (BE+FE) **+** Pinia-Store `season` | Explizit und typisiert, parallel zu Phase 1 `session_key`. |
| 5 | Lock | Sobald **erste Session der Saison** begonnen hat | Konsistent mit Phase 1, keine Admin-Arbeit, semantisch korrekt. |
| 6 | Admin-Flow | **2 Buttons**: „Standings berechnen" + „Saison-Scoring auslösen", Editing-UI dazwischen | Identisches Muster zu Phase 4. |
| 7 | Automatisierung | **Scheduler (Daily 03:00 UTC, `time.Ticker`)** löst Compute + Score automatisch aus, sobald alle Race-Sessions der Saison abgeschlossen sind. Admin-Buttons bleiben als Override. | Erfüllt den Wunsch nach Vollautomatik ohne neue Scheduler-Infrastruktur. |
| 7a | Team-Identifier für Constructor-Championship | **Teams-Mapping-Tabelle** im BE (`teams: id, name`), FE sendet Team-ID | Saubere Reinigung des aktuellen „`driver_id` als Team-ID"-Hacks. |
| 7b | „Aktuelle Saison" im FE | **Aus erstem Session-Datum ableiten** (ein Server-Roundtrip beim Mount) | Robuster als `getUTCFullYear()`-Default, kostet eine Request. |

---

## Architektur-Überblick

```
Rennresultate (models.Result, bereits synchronisiert)
         │
         ▼ POST /api/v1/season-results/:year/compute        (Admin oder Scheduler)
         ▼
┌────────────────────────────────────────────────────┐
│  season_results (neue Tabelle, PK: season_year)    │
│  - driver_standings       []int   (DriverNumbers)  │
│  - constructor_standings  []int   (Team-IDs)       │
│  - computed_at, overridden_at, scored_at           │
└────────────────────────────────────────────────────┘
         │                   ▲
         │                   │ PUT /api/v1/season-results/:year   (Override, Admin)
         ▼
POST /api/v1/scoring/season/:year                   (Admin oder Scheduler)
         ▼
Dispatcher-Erweiterung in coupons/scoring/service.go:
   case "teamDuell" | "driverChampionshipRank" | "constructorChampionshipRank"
         ▼
Coupon.score gesetzt → Punkteliste zeigt Saison-Punkte

Parallel: Daily-Ticker im BE prüft Kriterium → ruft Compute + Score selbst auf.
```

**Fünf Baustellen:**
1. BE: Neue Models + Repos + Services (`season_results`, `teams`) + 4 Endpoints
2. BE: Schema-Erweiterungen (`season_year` auf `teamDuell`, `driverChampionshipRank`, `constructorChampionshipRank`); `constructorChampionshipRank` auf neues `team_id`-Feld statt `driver_id`-Hack
3. BE: 3 neue Pure Scoring Functions + Dispatcher-Fall + Scheduler-Goroutine
4. FE: Pinia-Store `season` + `isSeasonStarted`-Lock + Schema/Composable-Erweiterungen
5. FE: Punkteliste erweitert um Saison-Admin-Section (Compute/Edit/Score)

---

## Backend-Design

### Neue Tabelle `teams`

```go
type Team struct {
    ID        uint      `gorm:"primaryKey"`
    Name      string    `gorm:"uniqueIndex;not null"`   // z. B. "McLaren", "Red Bull Racing"
    CreatedAt time.Time
    UpdatedAt time.Time
}
```

**Seed-Daten (2026-Saison):**

```go
var seedTeams = []string{
    "McLaren", "Mercedes", "Ferrari", "Red Bull Racing", "Williams",
    "Haas F1 Team", "Aston Martin", "Racing Bulls", "Alpine", "Kick Sauber",
}
```

Seed via GORM-Migration-Hook (`gorm:"onCreate"`-Pattern bzw. simpler `AutoSeed()` nach `AutoMigrate`). **Teamnamen folgen OpenF1-Konvention** (`models.Result.team_name`) — damit das Compute-Mapping ohne Normalisierung funktioniert.

**Endpoint:** `GET /api/v1/teams` → `[{id, name}]`, public, für den FE-Picker.

### Neue Tabelle `season_results`

```go
type SeasonResults struct {
    SeasonYear           int        `gorm:"primaryKey"`
    DriverStandings      []int      `gorm:"type:integer[]"`    // DriverNumbers in Reihenfolge Rang 1..N
    ConstructorStandings []int      `gorm:"type:integer[]"`    // Team-IDs in Reihenfolge Rang 1..M
    ComputedAt           *time.Time
    OverriddenAt         *time.Time
    ScoredAt             *time.Time
    CreatedAt            time.Time
    UpdatedAt            time.Time
}
```

**Nullable Timestamps:**
- `computed_at` NULL = noch nie berechnet
- `overridden_at` NULL = Admin hat nach Compute nichts geändert
- `scored_at` NULL = Scheduler/Admin hat noch nicht gescored (Scheduler nutzt dieses Feld als Idempotenz-Guard)

**Postgres `integer[]`** statt separater Join-Tabelle: Reihenfolge ist Teil des Werts; GORM 2 kann native Arrays mit `pq` oder dem jsonb-Workaround serialisieren. (Falls das Setup Probleme macht: Fallback auf `jsonb`-Spalte mit `[]int`-Serialisierung — in der Implementation entscheiden.)

### Compute-Algorithmus

```go
// ComputeSeasonResults aggregiert Season-Standings aus bereits synchronisierten
// models.Result-Einträgen. Nutzt alle Race- und Sprint-Sessions des Jahres.
func (s *Service) ComputeSeasonResults(ctx context.Context, year int) (*SeasonResults, error) {
    // 1. Lade alle Race- und Sprint-Sessions des Jahres via sessionRepo.
    sessions, err := s.sessions.FindByYear(year, []string{"Race", "Sprint"})
    if err != nil { return nil, err }
    if len(sessions) == 0 {
        return nil, fmt.Errorf("no race/sprint sessions found for year %d", year)
    }

    // 2. Für jede Session: lade models.Result.
    var allResults []models.Result
    for _, sess := range sessions {
        res, err := s.results.FindBySession(sess.SessionKey)
        if err != nil { return nil, err }
        allResults = append(allResults, res...)
    }

    // 3. Aggregiere Punkte je driver_number (-> Fahrer-WM).
    driverPoints := map[int]int{}
    teamPoints   := map[string]int{}
    for _, r := range allResults {
        driverPoints[r.DriverNumber] += r.Points
        teamPoints[r.TeamName]       += r.Points
    }

    // 4. Sortiere absteigend; Tie-Break: driver_number asc / team-name asc.
    driverStandings := sortedKeysByValueDesc(driverPoints)
    teamNamesRanked := sortedKeysByValueDesc(teamPoints)

    // 5. Map Team-Namen → Team-IDs via teamRepo (unbekannter Name = Error).
    teamIDs, err := s.teams.FindIDsByNames(teamNamesRanked)
    if err != nil { return nil, err }

    // 6. Upsert in season_results (ComputedAt = now, OverriddenAt/ScoredAt NICHT touchen).
    //    Dadurch kann Re-Compute laufen ohne Overrides zu verlieren — Entscheidung dazu unten.
    sr := &SeasonResults{
        SeasonYear:           year,
        DriverStandings:      driverStandings,
        ConstructorStandings: teamIDs,
        ComputedAt:           ptrTime(now),
    }
    return s.repo.Upsert(sr)
}
```

**Entscheidung Re-Compute vs. Override:** Compute **überschreibt** bestehende Standings. Admin, der overriden will, überschreibt *nach* Compute via PUT. Falls Compute nach einem Override erneut läuft, geht das Override verloren — der Admin wird in der UI klar darauf hingewiesen (Toast nach Compute: „Overrides wurden überschrieben, falls vorhanden"). Das ist eine bewusste MVP-Vereinfachung; eine „merge"-Semantik wäre überengineered.

### Scoring-Pure-Functions

**Package:** `coupons/scoring` (bestehend).

```go
// Hilfsfunktion (DRY mit Phase 3b)
// Returns 1-based rank of want in standings, or -1 if not found.
func rankOf[T comparable](standings []T, want T) int

// ScoreTeamDuell: Sieger (placements[0]) muss vor Verlierer (placements[1]) in driverStandings stehen.
// Returns 3 wenn ja, 0 sonst. Fehlende Picks → 0.
func ScoreTeamDuell(data TeamDuellData, driverStandings []int) int

// ScoreDriverChampionship: 5 bei exaktem Rang-Match, 2 bei ±1, sonst 0.
// Fahrer nicht in Standings → 0.
func ScoreDriverChampionship(data DriverChampionshipData, driverStandings []int) int

// ScoreConstructorChampionship: Analog, aber über constructorStandings ([]int = Team-IDs).
func ScoreConstructorChampionship(data ConstructorChampionshipData, constructorStandings []int) int
```

**TDD-Test-Matrix** (mindestens 12 Tests):

| Fn | Testfall | Erwartet |
|---|---|---|
| TeamDuell | Sieger-Pick vor Verlierer-Pick | 3 |
| TeamDuell | Verlierer-Pick vor Sieger-Pick | 0 |
| TeamDuell | Sieger-Pick fehlt in Standings | 0 |
| TeamDuell | Verlierer-Pick fehlt in Standings | 0 |
| DriverChampionship | Exakter Rang | 5 |
| DriverChampionship | Rang +1 | 2 |
| DriverChampionship | Rang −1 | 2 |
| DriverChampionship | Rang ±2 | 0 |
| DriverChampionship | Fahrer fehlt | 0 |
| ConstructorChampionship | Exakter Rang | 5 |
| ConstructorChampionship | Rang +1 | 2 |
| ConstructorChampionship | Rang −1 | 2 |

### Dispatcher-Erweiterung

```go
// coupons/scoring/service.go — scoreOne()
case "teamDuell":
    var d TeamDuellData
    if err := json.Unmarshal(raw, &d); err != nil { return 0, false }
    year := d.SeasonYear
    sr, err := s.seasonResults.Get(year)
    if err != nil || sr == nil { return 0, false }
    return ScoreTeamDuell(d, sr.DriverStandings), true

case "driverChampionshipRank":
    // analog
case "constructorChampionshipRank":
    // analog
```

**Service-Struct bekommt neue Dependency** `seasonResults SeasonResultsLoader` (kleines Interface analog zu `ResultsLoader`).

### Scoring-Scope-Endpoint

```
POST /api/v1/scoring/season/:year     (Admin)
```

Logik:
1. Lade alle Coupons mit `data.season_year = :year` AND `schema_name IN ('teamDuell', 'driverChampionshipRank', 'constructorChampionshipRank')` via JSONB-Query:
   ```sql
   WHERE schema::jsonb -> 'data' ->> 'season_year' = ?
     AND schema_name IN (?, ?, ?)
   ```
2. Dispatcher für jede Zeile.
3. `UPDATE coupons SET score = ? WHERE id = ?`.
4. Setze `season_results.scored_at = now()` (für Scheduler-Idempotenz).

Response: `{season_year, scored_coupons}`.

### Scheduler

**Design:** einfache Goroutine in `main.go`, gestartet nach Repo-Init:

```go
go func() {
    const target = 3 * time.Hour // 03:00 UTC
    for {
        now := time.Now().UTC()
        next := time.Date(now.Year(), now.Month(), now.Day(), 3, 0, 0, 0, time.UTC)
        if !next.After(now) { next = next.Add(24 * time.Hour) }
        time.Sleep(time.Until(next))
        if err := runSeasonAutoScoring(ctx); err != nil {
            log.Printf("season auto-scoring tick: %v", err)
        }
    }
}()
```

**Auto-Scoring-Entscheidung (`runSeasonAutoScoring`):**

```go
func runSeasonAutoScoring(ctx context.Context) error {
    year := time.Now().UTC().Year()

    // Guard 1: schon gescored?
    sr, _ := seasonResultsRepo.Get(year)
    if sr != nil && sr.ScoredAt != nil { return nil }

    // Guard 2: alle Race-Sessions des Jahres abgeschlossen?
    sessions, err := sessionRepo.FindByYear(year, []string{"Race"})
    if err != nil || len(sessions) == 0 { return err }
    maxEnd := time.Time{}
    for _, s := range sessions {
        if s.DateEnd.After(maxEnd) { maxEnd = s.DateEnd }
    }
    if maxEnd.After(time.Now().UTC()) { return nil } // letzte Session liegt in Zukunft

    // Guard 3: alle Sessions haben Results-Einträge?
    for _, s := range sessions {
        count, err := resultsRepo.CountBySession(s.SessionKey)
        if err != nil { return err }
        if count == 0 { return nil } // noch nicht alle synced
    }

    // Alle Guards ok → compute + score.
    if _, err := seasonResultsService.ComputeSeasonResults(ctx, year); err != nil { return err }
    if _, err := scoringService.ScoreSeason(ctx, year); err != nil { return err }
    return nil
}
```

**Testbarkeit:** Die Entscheidungsfunktion wird so refaktoriert, dass `time.Now`, `FindByYear`, `CountBySession`, `ComputeSeasonResults`, `ScoreSeason` als Interfaces/Funktionsparameter übergeben werden können — Scheduler-Tests laufen gegen Mocks.

### Endpoint-Zusammenfassung (BE)

| Method | Path | Auth | Zweck |
|---|---|---|---|
| `GET`  | `/api/v1/teams` | Public | Liste Teams (für FE-Picker). |
| `GET`  | `/api/v1/sessions/season-start?year=:year` | Public | Erste Session des Jahres (date_start asc, limit 1). |
| `GET`  | `/api/v1/season-results/:year` | Public | Standings + Timestamps lesen. |
| `POST` | `/api/v1/season-results/:year/compute` | Admin | Compute aus `models.Result`. |
| `PUT`  | `/api/v1/season-results/:year` | Admin | Override setzen (Body `{driver_standings, constructor_standings}`). |
| `POST` | `/api/v1/scoring/season/:year` | Admin | Scoring aller Season-Coupons dieses Jahres. |

---

## Frontend-Design

### Neuer Pinia-Store `src/stores/season.ts`

```ts
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getSeasonStart, type SessionInfo } from '@/plugins/startingGrid'

export const useSeasonStore = defineStore('season', () => {
    const year = ref<number>(0)                               // 0 = nicht initialisiert
    const firstSession = ref<SessionInfo | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)

    const isStarted = computed(() => {
        if (!firstSession.value) return false
        const start = new Date(firstSession.value.date_start).getTime()
        return !Number.isNaN(start) && start <= Date.now()
    })

    async function loadCurrent() {
        loading.value = true
        error.value = null
        try {
            const session = await getSeasonStart(new Date().getUTCFullYear())
            firstSession.value = session
            year.value = new Date(session.date_start).getUTCFullYear()
        } catch (e) {
            error.value = e instanceof Error ? e.message : String(e)
        } finally {
            loading.value = false
        }
    }

    return { year, firstSession, loading, error, isStarted, loadCurrent }
})
```

**Persistenz:** über das bestehende `piniaIdb`-Plugin (analog zu `session`-Store).

### Schema-Erweiterungen (3 Plugins + 3 Composables)

**`src/plugins/coupon.ts`:**
```ts
export type CouponContext = {
    sessionKey?: number
    seasonYear?: number    // NEU
}
```

**`src/plugins/coupons/teamDuell.ts`:**
```ts
export type TeamDuellData = {
    placements: Placement[]
    season_year?: number
}

export default function createTeamDuellCoupon(
    placements: Placement[],
    ctx: CouponContext = {},
): Coupon<TeamDuellData> {
    return {
        name: 'Team Duell Wette',
        category: 'season',
        schemaName: 'teamDuell',
        data: {
            placements,
            ...(ctx.seasonYear ? { season_year: ctx.seasonYear } : {}),
        },
    }
}
```

**`src/plugins/coupons/driverChampionship.ts`** — analog mit `placement: Placement` + `season_year?: number`.

**`src/plugins/coupons/constructorChampionship.ts`** — Schema-Reinigung:
```ts
export type ConstructorChampionshipData = {
    placement: {
        team_id: number     // NEU: statt driver_id
        position: number
    }
    season_year?: number
}
```

Die bisherige „`driver_id` als Team-ID"-Krücke wird durch ein echtes `team_id`-Feld ersetzt. BE-Schema `constructorChampionshipRank` zieht gleichzeitig nach. Alte Coupons mit `driver_id`-Form werden beim Scoring ignoriert (dispatcher gibt `(0, false)` für fehlendes `team_id` zurück).

**Composables:** jedes zieht den aktiven Jahr-Getter aus `useSeasonStore`:

```ts
export function useTeamDuell(initialPicks: [PodiumDriver, PodiumDriver]) {
    const season = useSeasonStore()
    const { picks, submitting, error, createdId, placedAt, submit, swapPicks, reset }
        = useCoupon('teamDuell', initialPicks, createTeamDuellCoupon, undefined, () => season.year || undefined)
    return { picks, submitting, error, createdId, placedAt, submit, swapPicks, reset }
}
```

**`useCoupon`-Signatur** wird um einen fünften Parameter `getSeasonYear?: () => number | undefined` erweitert und reicht beide Werte durchs `CouponContext` an den Builder.

### BetCard-Lock

Alle drei Season-Pages (`teamDuell.vue`, `driverChampionship.vue`, `constructorChampionship.vue`) laden den Season-Store beim Mount und binden `isStarted` an `BetCard`:

```vue
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted } from 'vue'
import { useSeasonStore } from '@/stores/season'

const seasonStore = useSeasonStore()
const { firstSession, isStarted } = storeToRefs(seasonStore)
onMounted(() => seasonStore.loadCurrent())
// ...
</script>
```

Die existierenden `BetCard`-Props (`session`, `locked`) reichen aus. Für Season-Pages setzen wir `session` auf das `firstSession`-Objekt, damit der Banner „Saison 2026" sichtbar ist.

**Alternative (klarer in der UX):** `BetCard` bekommt neue Props `season?: SeasonInfo` + `seasonBannerLabel?: string`. Entscheidung in der Implementation; MVP geht mit vorhandenen Props.

### Neuer FE-API-Client `src/plugins/season.ts`

Pattern wie `scores.ts`:

```ts
export type SeasonResults = {
    season_year: number
    driver_standings: number[]           // Driver-Numbers
    constructor_standings: number[]      // Team-IDs
    computed_at?: string
    overridden_at?: string
    scored_at?: string
}

export type SeasonResultsPayload = {
    driver_standings: number[]
    constructor_standings: number[]
}

export async function getSeasonResults(year: number): Promise<SeasonResults | null>
export async function computeSeasonResults(year: number, token: string): Promise<SeasonResults>
export async function overrideSeasonResults(year: number, body: SeasonResultsPayload, token: string): Promise<SeasonResults>
export async function triggerSeasonScoring(year: number, token: string): Promise<ScoringResult>
export async function listTeams(): Promise<Array<{id: number, name: string}>>
```

### Admin-UI auf `/punkteliste`

Neue Section unter den Phase-3b/4-Controls, nur für `auth.player?.role === 'admin'`:

```
┌─ Admin · Saison-Scoring ─────────────────────────────────┐
│                                                            │
│ Saison [ 2026 ▼ ]  (im MVP fix auf aktuelles Jahr, als    │
│                     Dropdown vorbereitet für spätere Jahre)│
│                                                            │
│ ① [ Standings berechnen ]  Zuletzt: 2026-10-23 14:02       │
│                                                            │
│ Fahrer-WM                   Konstrukteurs-WM               │
│ ┌──────────────────┐        ┌──────────────────────┐       │
│ │ 1. #1  Verstappen│↕       │ 1. McLaren           │↕      │
│ │ 2. #4  Norris    │↕       │ 2. Mercedes          │↕      │
│ │ 3. #16 Leclerc   │↕       │ 3. Red Bull Racing   │↕      │
│ │ ...              │        │ ...                  │       │
│ └──────────────────┘        └──────────────────────┘       │
│  [ Reset ]      [ Overrides speichern ]                    │
│                                                            │
│ ② [ Saison-Scoring auslösen ]  Zuletzt: nie                │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Interaktion:**
- Mount: `getSeasonResults(year)` + `listTeams()` + `listDrivers()` parallel laden. Teams/Drivers für Name-Rendering (die beiden Listen enthalten nur IDs/Numbers; der FE löst zur Anzeige auf). Falls Netzwerk fehlschlägt, zeigt die Liste rohe IDs mit Fallback-Label „Team #ID"/„Fahrer #N".
- „Standings berechnen" → `computeSeasonResults` → Reload. Toast: „Standings für 2026 berechnet (20 Fahrer, 10 Teams)".
- Listen sind reorderable (Vuetify `v-list` + `vuedraggable` wie Starting Grid). Draft-State lokal; „Reset" setzt auf Server-Snapshot, „Overrides speichern" → `overrideSeasonResults`.
- „Saison-Scoring auslösen" → `triggerSeasonScoring` → Toast + `load()` der Punkteliste.
- `scored_at` als Statuszeile; wenn gesetzt, Button-Label wird zu „Saison-Scoring erneut auslösen".

### Nav + Routing

Keine neuen Routen (alles unter `/punkteliste`). Keine neuen Nav-Einträge.

---

## Testing

### Backend

**TDD-Pflicht:**
- `coupons/scoring/scoring_test.go`: ≥12 Tests für die 3 neuen Score-Funktionen (siehe Matrix oben).
- `season_results/service_test.go`: Compute-Algorithmus gegen Fixture-Daten (2 Rennen + 1 Sprint, bekannte Erwartungen für Fahrer- + Konstrukteurs-Reihenfolge).
- `scheduler_test.go`: Entscheidungslogik isoliert — `now()`, `FindByYear`, `CountBySession` als Interface-Mocks; alle Guards decken (schon gescored, Session in Zukunft, Session unsynced, alles ok).

**Integration (manuell/cURL):**
1. Seed `teams` prüfen: `GET /api/v1/teams` liefert 10 Einträge.
2. `GET /api/v1/season-results/2026` → 404 oder empty.
3. `POST /api/v1/season-results/2026/compute` als Admin → 200 mit Standings.
4. `PUT /api/v1/season-results/2026` als Admin mit tauschten Rängen → `overridden_at` gesetzt.
5. `POST /api/v1/scoring/season/2026` als Admin → `scored_at` gesetzt, Coupons haben `score`.

### Frontend

Kein Unit-Test-Runner im Projekt → `npm run type-check` als Pflicht-Gate.

**Manuelles QA:**
- `/teamDuell`, `/driverChampionship`, `/constructorChampionship`:
  - Banner „Saison 2026 · Erstes Rennen am …" sichtbar.
  - Netzwerk-Tab: POST-Body enthält `season_year: 2026`.
  - Nach erstem Rennen: Lock + Warnung, Submit disabled.
- `/constructorChampionship`: Team-Picker zeigt Namen (nicht Driver-Namen); Payload hat `placement.team_id`.
- `/punkteliste` als Admin:
  - Section sichtbar.
  - Compute → beide Listen gefüllt (sortierte DriverNumbers + Teamnamen).
  - Reorder lokal + Save → GET nach Reload matcht.
  - Scoring → Punkteliste refreshed; Teamduell/Championship-Coupons haben erwartete Punkte.
- End-to-End: `teamDuell`-Tipp vor Saisonstart → Compute → Score → in Punkteliste mit erwarteten 0/3 Pkt sichtbar.

### Verifikations-Reihenfolge in der Spec

1. BE: `go test ./...` grün.
2. BE: cURL-Durchlauf (siehe oben).
3. FE: `npm run type-check` grün.
4. FE: Browser-Checks oben.
5. Scheduler-Validierung: `scored_at` manuell auf NULL setzen, Tick simulieren (z. B. via neuem `debug/trigger-season-scheduler`-Endpoint hinter Admin-Auth — optional, nur falls einfach umsetzbar).

---

## Risiken & offene Punkte

- **`models.Result.points` und `.team_name` müssen vorhanden sein.** Falls aktuell nicht gespeichert, braucht Phase 0 einen OpenF1-Sync-Patch. In der ersten Implementation-Phase prüfen; falls fehlend, als Blocker eskalieren.
- **Teamnamen-Drift:** Wenn OpenF1 einen Teamnamen ändert (z. B. „Alpine" → „BWT Alpine F1 Team"), bricht das Compute-Mapping. Mitigation: Teams-Seed inkludiert bekannte Varianten; `FindIDsByNames` meldet unbekannte Namen explizit.
- **Postgres-Arrays mit GORM:** Falls `[]int64 gorm:"type:integer[]"` am Setup scheitert, Fallback auf `jsonb`-Spalte mit `datatypes.JSON`-Serialisierung.
- **Compute-Überschreibt-Override:** Bewusste MVP-Entscheidung (siehe oben). Admin wird im Toast gewarnt.
- **Alt-Coupons ohne `season_year`:** Werden ignoriert (dispatcher `(0, false)` bei fehlendem Feld). Keine Daten-Migration geplant.
- **Historische Saisons im Admin-Dropdown:** Scope-aus; wird später eingezogen, wenn mehr als eine Saison gelaufen ist.
- **FIA-Tie-Break:** nicht implementiert; dokumentiert als bewusste Vereinfachung.
- **Scheduler-Timezone:** Fix auf UTC. Server-Timezone-Drift kein Thema.
- **Scheduler-Persistenz:** Goroutine lebt mit dem Prozess. Server-Restart → nächster Tick erst wieder nach `nextRun`. Für Daily-03:00 UTC akzeptabel (max 24h Verzögerung).

---

## Was nicht Teil dieser Phase ist

- Transparenz-Seite für Saison-Standings (Public UI).
- Driver → Team-Zuordnung als eigene Tabelle (`drivers.team_id`): nicht Teil dieser Phase. Die Konstrukteurs-WM wird über `models.Result.team_name` aggregiert und per `teams.name` auf eine Team-ID gemappt — pro Session, nicht pro Fahrer.
- Benachrichtigungen an Spieler nach Scoring.
- Scoring-Transaktionen (gleicher Punkt wie Phase 3b, weiterhin offen).
- Multi-Season-Support im Admin-UI (Dropdown mit historischen Jahren).
- E2E-Tests mit echtem Docker-Setup.

---

## Nächster Schritt

Nach User-Freigabe dieser Spec: Implementation-Plan via `writing-plans` erzeugen. Ein Plan reicht aus; die fünf Baustellen oben werden zu Tasks mit klaren Übergaben zwischen BE und FE.
