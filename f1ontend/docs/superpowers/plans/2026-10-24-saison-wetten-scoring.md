# Saison-Wetten-Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scoring für `teamDuell`, `driverChampionshipRank` und `constructorChampionshipRank` umsetzen — Hybrid-Datenquelle (Compute aus `models.Result` + Admin-Override), Auto-Scoring per Daily-Ticker, Admin-UI auf `/punkteliste`.

**Architecture:** Neue Tabelle `season_results` (eine Zeile pro Jahr) hält Fahrer-WM (`DriverNumber[]`) und Konstrukteurs-WM (`TeamID[]`). Compute aggregiert Points aus allen Race/Sprint-Sessions des Jahres (`models.Result.Points` + `Driver.TeamID`). Drei neue Pure-Scoring-Funktionen (`ScoreTeamDuell`, `ScoreDriverChampionship`, `ScoreConstructorChampionship`) + Dispatcher-Erweiterung in `coupons/scoring/service.go`. BE-Scheduler-Goroutine triggert Compute + Score daily um 03:00 UTC, sobald alle Rennen der Saison abgeschlossen und synced sind. FE bekommt neuen Pinia-Store `season`, `season_year`-Feld in den drei Season-Schemas, Lock vor Saisonstart (analog Phase 1) und Admin-Section auf `/punkteliste`.

**Tech Stack:**
- Backend: Go 1.22+, Gin, GORM, Postgres (JSONB + integer[]-Arrays). Tests: `go test`.
- Frontend: Vue 3 (Composition API), Pinia (Setup-Stores), TypeScript, Vuetify 3, Tailwind. Kein Unit-Test-Runner → Gate ist `npm run type-check`.

> **WICHTIG – FE-Code-Stil & Lint:** Das FE-Repo ist mit **TABs** eingerückt. `npm run lint` schlägt repo-weit fehl und ist **kein** brauchbares Gate. Mit TABs schreiben, `catch (e)` beibehalten, und **niemals** `eslint`/`npm run lint:fix` ausführen. Einziges FE-Gate: `npm run type-check`.

> **Cross-Repo:** Backend-Repo liegt unter `../../f1-tip-game` relativ zum FE-Repo. Backend-Pfade in diesem Plan sind absolut relativ zur Backend-Repo-Root (z. B. `coupons/scoring/season.go`), ausgenommen wo explizit anders markiert.

---

## File Structure

### Backend (`../../f1-tip-game`)

- Create: `internal/repository/team_repository.go` — minimaler Reader (`FindAll`, `FindByIDs`).
- Create: `internal/handler/team_handler.go` — `GET /api/v1/teams`.
- Create: `internal/models/season_results.go` — Tabelle `season_results` (PK `season_year`).
- Create: `internal/repository/season_results_repository.go` — `Get(year)`, `Upsert(*SeasonResults)`, `UpdateScored(year, now)`.
- Create: `internal/repository/session_repository.go` — neue `SessionRepository` mit `FindByYear(year, types)` + `FindFirstOfYear(year)` + `CountResultsBySession(sessionKey)`.
- Modify: `internal/handler/session_handler.go` (falls nicht vorhanden: create) — `GET /api/v1/sessions/season-start?year=:year`.
- Create: `internal/service/season_results_service.go` — Compute + Override + Scheduler-Entscheidungslogik.
- Create: `internal/handler/season_results_handler.go` — `GET /:year`, `POST /:year/compute`, `PUT /:year`.
- Create: `coupons/scoring/season/scoring.go` + `coupons/scoring/season/scoring_test.go` — die drei neuen Pure-Scoring-Funktionen + TDD.
- Modify: `coupons/team/team_duell_coupon.go` — Feld `SeasonYear` zum Schema hinzufügen.
- Modify: `coupons/season/driver_championship_rank_coupon.go` — Feld `SeasonYear` + Umstellung von eingebettetem `Placement` auf benanntes `Placement` + weiterhin JSON-Tag `placement`.
- Modify: `coupons/season/constructor_championship_rank_coupon.go` — neues Feld-Schema `{ TeamID uint, Position int }` statt `coupons.Placement`-Embed; plus `SeasonYear`.
- Modify: `coupons/scoring/service.go` — `scoreOne`-Dispatcher-Zweige für die 3 Schemas + neuer `SeasonResultsLoader` + `TeamOfDriverLoader` als Dependency; neue Methode `ScoreSeason(ctx, year)`.
- Modify: `internal/handler/scoring_handler.go` — Admin-Route `POST /scoring/season/:year`.
- Modify: `internal/router/router.go` — neue Handlers registrieren (`Team`, `SeasonResults`, `Session`).
- Modify: `main.go` — `AutoMigrate(&models.SeasonResults{})`, Teams-Seed (falls leer), neue Services/Repos/Handlers wiring, Scheduler-Goroutine starten.
- Create: `internal/scheduler/season_scheduler.go` + `internal/scheduler/season_scheduler_test.go` — Daily-Ticker + testbare Entscheidungsfunktion.

### Frontend (`.`)

- Create: `src/stores/season.ts` — Pinia-Setup-Store (`year`, `firstSession`, `isStarted`, `loadCurrent`).
- Create: `src/plugins/season.ts` — API-Clients: `getSeasonResults`, `computeSeasonResults`, `overrideSeasonResults`, `triggerSeasonScoring`, `listTeams`.
- Modify: `src/plugins/startingGrid.ts` — `getSeasonStart(year)` ergänzen.
- Modify: `src/plugins/coupon.ts` — `CouponContext.seasonYear` ergänzen.
- Modify: `src/plugins/coupons/useCoupon.ts` — 5. optionaler Param `getSeasonYear`.
- Modify: `src/plugins/coupons/teamDuell.ts` — `season_year` ins Schema; Builder akzeptiert `ctx`.
- Modify: `src/plugins/coupons/driverChampionship.ts` — `season_year` ins Schema; Builder akzeptiert `ctx`.
- Modify: `src/plugins/coupons/constructorChampionship.ts` — Schema auf `{ placement: { team_id, position }, season_year? }` umstellen.
- Modify: `src/plugins/coupons/useTeamDuell.ts` — Season-Store einbinden, `getSeasonYear` durchreichen.
- Modify: `src/plugins/coupons/useDriverChampionship.ts` — dito.
- Modify: `src/plugins/coupons/useConstructorChampionship.ts` — dito; Initial-Pick wird `{ team_id, name }` statt `PodiumDriver`.
- Modify: `src/pages/teamDuell.vue` — Season-Store laden, Banner + Lock an `BetCard`.
- Modify: `src/pages/driverChampionship.vue` — dito.
- Modify: `src/pages/constructorChampionship.vue` — dito, Picker auf Teams umstellen.
- Modify: `src/pages/punkteliste.vue` — neue Admin-Section (Compute/Edit/Score) nur für `role === 'admin'`.

---

## Pre-Flight: Verifikations-Checks

Vor Task 1 einmalig prüfen, dass die Spec-Annahmen stimmen (verhindert Reihenfolge-Blocker später):

- [ ] **PF-1:** `grep -n "Points.*float64" ../../f1-tip-game/internal/models/result.go`
      Expected: `Points *float64` existiert. (Compute braucht das.)
- [ ] **PF-2:** `grep -n "TeamID.*\*uint" ../../f1-tip-game/internal/models/driver.go`
      Expected: `TeamID *uint` existiert. (Compute braucht das für Konstrukteurs-WM.)
- [ ] **PF-3:** `grep -n "type Team struct" ../../f1-tip-game/internal/models/team.go`
      Expected: `Team{ID, Name, Colour, Season}` existiert.
- [ ] **PF-4:** `grep -c "Team{}" ../../f1-tip-game/main.go`
      Expected: `>= 1` (Team ist bereits in `AutoMigrate`).

**Falls einer der Checks fehlschlägt:** stop und mit dem User klären, bevor du weiter machst — der Plan setzt diese Felder voraus.

---

## Task 1: Backend — TeamRepository + GET /teams

**Files:**
- Create: `../../f1-tip-game/internal/repository/team_repository.go`
- Create: `../../f1-tip-game/internal/handler/team_handler.go`
- Modify: `../../f1-tip-game/internal/router/router.go`
- Modify: `../../f1-tip-game/main.go`

- [ ] **Step 1: Repository schreiben**

Create `../../f1-tip-game/internal/repository/team_repository.go`:

```go
package repository

import (
	"github.com/GypsyyCode/f1-tip-game/internal/models"
	"gorm.io/gorm"
)

// TeamRepository bietet Read-Zugriff auf die Teams-Tabelle.
// Für Season-Scoring brauchen wir nur Lookups by IDs (Konstrukteurs-WM
// speichert Team-IDs in Reihenfolge Rang 1..N) und FindAll (FE-Picker).
type TeamRepository interface {
	FindAll() ([]models.Team, error)
	FindByIDs(ids []uint) ([]models.Team, error)
	FindByDriverNumbers(driverNumbers []int) (map[int]uint, error)
}

type teamRepository struct {
	db *gorm.DB
}

func NewTeamRepository(db *gorm.DB) TeamRepository {
	return &teamRepository{db: db}
}

func (r *teamRepository) FindAll() ([]models.Team, error) {
	var teams []models.Team
	if err := r.db.Order("name ASC").Find(&teams).Error; err != nil {
		return nil, err
	}
	return teams, nil
}

func (r *teamRepository) FindByIDs(ids []uint) ([]models.Team, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	var teams []models.Team
	if err := r.db.Where("id IN ?", ids).Find(&teams).Error; err != nil {
		return nil, err
	}
	return teams, nil
}

// FindByDriverNumbers liefert ein Mapping DriverNumber → TeamID
// (verwendet die bereits bestehende Driver.TeamID-Spalte).
// Fahrer ohne TeamID werden weggelassen.
func (r *teamRepository) FindByDriverNumbers(driverNumbers []int) (map[int]uint, error) {
	if len(driverNumbers) == 0 {
		return map[int]uint{}, nil
	}
	type row struct {
		DriverNumber int
		TeamID       *uint
	}
	var rows []row
	if err := r.db.Table("drivers").
		Select("driver_number, team_id").
		Where("driver_number IN ?", driverNumbers).
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := make(map[int]uint, len(rows))
	for _, r := range rows {
		if r.TeamID != nil {
			out[r.DriverNumber] = *r.TeamID
		}
	}
	return out, nil
}
```

- [ ] **Step 2: Handler schreiben**

Create `../../f1-tip-game/internal/handler/team_handler.go`:

```go
package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/GypsyyCode/f1-tip-game/internal/repository"
)

type TeamHandler struct {
	repo repository.TeamRepository
}

func NewTeamHandler(repo repository.TeamRepository) *TeamHandler {
	return &TeamHandler{repo: repo}
}

// RegisterPublicRoutes:
//   GET /teams — Liste aller Teams, für FE-Picker.
func (h *TeamHandler) RegisterPublicRoutes(r *gin.RouterGroup) {
	r.GET("/teams", h.list)
}

func (h *TeamHandler) list(c *gin.Context) {
	teams, err := h.repo.FindAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, teams)
}
```

- [ ] **Step 3: Router verdrahten**

In `../../f1-tip-game/internal/router/router.go`, erweitere den `Handlers`-Struct und registriere die Route in `Setup`:

```go
type Handlers struct {
	Driver      *handler.DriverHandler
	Auth        *handler.AuthHandler
	Wettschein  *handler.WettscheinHandler
	Result      *handler.ResultHandler
	Discovery   *handler.DiscoveryHandler
	Scoring     *handler.ScoringHandler
	Leaderboard *handler.LeaderboardHandler
	Aggregates  *handler.AggregatesHandler
	Team        *handler.TeamHandler            // NEU
}
```

Und in `Setup` (im `public := r.Group("/api/v1")`-Block, nach den anderen Public-Registrierungen):

```go
	h.Team.RegisterPublicRoutes(public)
```

- [ ] **Step 4: main.go wiring**

In `../../f1-tip-game/main.go` (an der Stelle, wo die anderen Repos/Handlers verdrahtet werden):

```go
teamRepo := repository.NewTeamRepository(db)
teamHandler := handler.NewTeamHandler(teamRepo)
```

Dann im `router.Setup`-Call das `Team: teamHandler`-Feld anhängen.

- [ ] **Step 5: Build + Smoketest**

```bash
cd ../../f1-tip-game
go build ./...
```

Expected: kein Compile-Fehler.

Falls Testdatenbank läuft:
```bash
curl -s http://localhost:8080/api/v1/teams | head
```
Expected: `[]` (leer; Seed kommt in Task 2 implizit via Admin oder manuell) oder bereits bestehende Zeilen.

- [ ] **Step 6: Commit**

```bash
cd ../../f1-tip-game
git add internal/repository/team_repository.go \
        internal/handler/team_handler.go \
        internal/router/router.go \
        main.go
git commit -m "feat(teams): read-only team repo + public GET /teams"
```

---

## Task 2: Backend — SeasonResults Model + Repository

**Files:**
- Create: `../../f1-tip-game/internal/models/season_results.go`
- Create: `../../f1-tip-game/internal/repository/season_results_repository.go`
- Modify: `../../f1-tip-game/main.go` (AutoMigrate + wiring)

- [ ] **Step 1: Model schreiben**

Create `../../f1-tip-game/internal/models/season_results.go`:

```go
package models

import (
	"time"

	"github.com/lib/pq"
)

// SeasonResults hält die finalen Standings einer Saison, berechnet aus
// synchronisierten OpenF1 Rennen/Sprints (Compute) oder manuell overridden.
//
// DriverStandings:      DriverNumbers in Reihenfolge Rang 1..N (meistens 20).
// ConstructorStandings: Team-IDs in Reihenfolge Rang 1..M (meistens 10).
//
// NULL-Timestamps:
//   - ComputedAt   : Compute-Service lief noch nie.
//   - OverriddenAt : Admin hat nach Compute nichts manuell geändert.
//   - ScoredAt     : Scheduler/Admin hat noch kein Season-Scoring ausgelöst.
type SeasonResults struct {
	SeasonYear           int           `gorm:"primaryKey"              json:"season_year"`
	DriverStandings      pq.Int64Array `gorm:"type:integer[]"          json:"driver_standings"`
	ConstructorStandings pq.Int64Array `gorm:"type:integer[]"          json:"constructor_standings"`
	ComputedAt           *time.Time    `                               json:"computed_at,omitempty"`
	OverriddenAt         *time.Time    `                               json:"overridden_at,omitempty"`
	ScoredAt             *time.Time    `                               json:"scored_at,omitempty"`
	CreatedAt            time.Time     `                               json:"-"`
	UpdatedAt            time.Time     `                               json:"-"`
}
```

**Hinweis:** `pq.Int64Array` ist in `github.com/lib/pq` und mappt sauber auf Postgres' `integer[]`. Falls `lib/pq` nicht bereits im `go.mod` ist, läuft `go mod tidy` nach Build (Step 4) es nach. Falls das in deinem Setup nicht funktioniert (z. B. GORM nutzt pgx statt pq), fallback: Spaltentyp `jsonb` + `datatypes.JSON`-Serialisierung. Wenn Fallback nötig: Repo-Methoden anpassen (Marshal/Unmarshal) und Model-Dokumentation aktualisieren.

- [ ] **Step 2: Repository schreiben**

Create `../../f1-tip-game/internal/repository/season_results_repository.go`:

```go
package repository

import (
	"errors"
	"time"

	"github.com/GypsyyCode/f1-tip-game/internal/models"
	"gorm.io/gorm"
)

// SeasonResultsRepository kapselt den Zugriff auf season_results.
// Methoden:
//   Get:         Null-Return falls kein Record (statt gorm.ErrRecordNotFound).
//   Upsert:      Compute speichert hier; setzt ComputedAt neu, lässt
//                OverriddenAt und ScoredAt unverändert.
//   SetOverride: Admin-PUT; setzt Standings + OverriddenAt.
//   MarkScored:  Scoring-Pipeline setzt ScoredAt.
type SeasonResultsRepository interface {
	Get(year int) (*models.SeasonResults, error)
	Upsert(sr *models.SeasonResults) (*models.SeasonResults, error)
	SetOverride(year int, drivers, constructors []int64, at time.Time) (*models.SeasonResults, error)
	MarkScored(year int, at time.Time) error
}

type seasonResultsRepository struct {
	db *gorm.DB
}

func NewSeasonResultsRepository(db *gorm.DB) SeasonResultsRepository {
	return &seasonResultsRepository{db: db}
}

func (r *seasonResultsRepository) Get(year int) (*models.SeasonResults, error) {
	var sr models.SeasonResults
	err := r.db.Where("season_year = ?", year).First(&sr).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &sr, nil
}

func (r *seasonResultsRepository) Upsert(sr *models.SeasonResults) (*models.SeasonResults, error) {
	// Upsert: Compute setzt (SeasonYear, DriverStandings, ConstructorStandings, ComputedAt).
	// Wir updaten nur diese Spalten; OverriddenAt und ScoredAt bleiben erhalten.
	err := r.db.
		Where("season_year = ?", sr.SeasonYear).
		Assign(map[string]interface{}{
			"driver_standings":      sr.DriverStandings,
			"constructor_standings": sr.ConstructorStandings,
			"computed_at":           sr.ComputedAt,
		}).
		FirstOrCreate(sr).Error
	if err != nil {
		return nil, err
	}
	return sr, nil
}

func (r *seasonResultsRepository) SetOverride(year int, drivers, constructors []int64, at time.Time) (*models.SeasonResults, error) {
	sr, err := r.Get(year)
	if err != nil {
		return nil, err
	}
	if sr == nil {
		// Override vor Compute: wir legen die Zeile neu an.
		sr = &models.SeasonResults{SeasonYear: year}
	}
	sr.DriverStandings = drivers
	sr.ConstructorStandings = constructors
	sr.OverriddenAt = &at
	if err := r.db.Save(sr).Error; err != nil {
		return nil, err
	}
	return sr, nil
}

func (r *seasonResultsRepository) MarkScored(year int, at time.Time) error {
	return r.db.Model(&models.SeasonResults{}).
		Where("season_year = ?", year).
		Update("scored_at", at).Error
}
```

- [ ] **Step 3: AutoMigrate + wiring in main.go**

In `../../f1-tip-game/main.go`:

- Füge `&models.SeasonResults{}` in den `AutoMigrate`-Call ein (dort, wo `&models.Team{}` steht).
- Nach dem Teams-Wiring (Task 1):

```go
seasonResultsRepo := repository.NewSeasonResultsRepository(db)
```

- [ ] **Step 4: Build**

```bash
cd ../../f1-tip-game
go mod tidy
go build ./...
```

Expected: kein Fehler. `go mod tidy` zieht `github.com/lib/pq` falls nötig.

- [ ] **Step 5: Commit**

```bash
cd ../../f1-tip-game
git add internal/models/season_results.go \
        internal/repository/season_results_repository.go \
        main.go go.mod go.sum
git commit -m "feat(season): season_results model + repository"
```

---

## Task 3: Backend — SessionRepository (FindByYear, SeasonStart, CountResults)

**Files:**
- Create: `../../f1-tip-game/internal/repository/session_repository.go`
- Modify: `../../f1-tip-game/internal/handler/*` — neuen SessionHandler (oder Erweiterung bestehender Handler-Datei).
- Modify: `../../f1-tip-game/internal/router/router.go`
- Modify: `../../f1-tip-game/main.go`

- [ ] **Step 1: SessionRepository schreiben**

Create `../../f1-tip-game/internal/repository/session_repository.go`:

```go
package repository

import (
	"errors"

	"github.com/GypsyyCode/f1-tip-game/internal/models"
	"gorm.io/gorm"
)

// SessionRepository stellt Session-Lookups bereit, die der SeasonResults-Service
// und der Scheduler brauchen:
//   - FindByYear:        alle Sessions eines Jahres, optional nach SessionType filtern.
//   - FindFirstOfYear:   früheste Session eines Jahres (Season-Start-Lock im FE).
//   - CountResultsBySession: Guard für den Scheduler (Session muss synced sein).
type SessionRepository interface {
	FindByYear(year int, types []string) ([]models.Session, error)
	FindFirstOfYear(year int) (*models.Session, error)
	CountResultsBySession(sessionKey int) (int64, error)
}

type sessionRepository struct {
	db *gorm.DB
}

func NewSessionRepository(db *gorm.DB) SessionRepository {
	return &sessionRepository{db: db}
}

func (r *sessionRepository) FindByYear(year int, types []string) ([]models.Session, error) {
	q := r.db.Where("year = ?", year)
	if len(types) > 0 {
		q = q.Where("session_type IN ?", types)
	}
	var out []models.Session
	if err := q.Order("date_start ASC").Find(&out).Error; err != nil {
		return nil, err
	}
	return out, nil
}

func (r *sessionRepository) FindFirstOfYear(year int) (*models.Session, error) {
	var s models.Session
	err := r.db.Where("year = ?", year).Order("date_start ASC").First(&s).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *sessionRepository) CountResultsBySession(sessionKey int) (int64, error) {
	var n int64
	if err := r.db.Table("results").Where("session_key = ?", sessionKey).Count(&n).Error; err != nil {
		return 0, err
	}
	return n, nil
}
```

- [ ] **Step 2: SessionHandler (season-start)**

Prüfe, ob `../../f1-tip-game/internal/handler/session_handler.go` existiert.

Falls **nicht**: lege sie neu an:

```go
package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/GypsyyCode/f1-tip-game/internal/repository"
)

type SessionHandler struct {
	repo repository.SessionRepository
}

func NewSessionHandler(repo repository.SessionRepository) *SessionHandler {
	return &SessionHandler{repo: repo}
}

// RegisterPublicRoutes:
//   GET /sessions/season-start?year=:year — früheste Session des Jahres.
func (h *SessionHandler) RegisterPublicRoutes(r *gin.RouterGroup) {
	r.GET("/sessions/season-start", h.seasonStart)
}

func (h *SessionHandler) seasonStart(c *gin.Context) {
	yearStr := c.Query("year")
	year, err := strconv.Atoi(yearStr)
	if err != nil || year <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query param 'year' required"})
		return
	}
	s, err := h.repo.FindFirstOfYear(year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if s == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no sessions found for year"})
		return
	}
	c.JSON(http.StatusOK, s)
}
```

Falls doch vorhanden: die Methode `seasonStart` + Route in die bestehende Datei integrieren (mit demselben Interface).

- [ ] **Step 3: Router + main.go wiring**

In `../../f1-tip-game/internal/router/router.go`:

```go
type Handlers struct {
	// ...existing...
	Session *handler.SessionHandler       // NEU
}
```

Im `Setup`-public-Block:
```go
	h.Session.RegisterPublicRoutes(public)
```

In `../../f1-tip-game/main.go` beim Wiring:
```go
sessionRepo := repository.NewSessionRepository(db)
sessionHandler := handler.NewSessionHandler(sessionRepo)
```

Und in `router.Setup`-Call das `Session: sessionHandler`-Feld ergänzen.

- [ ] **Step 4: Build + Smoketest**

```bash
cd ../../f1-tip-game
go build ./...
curl -s "http://localhost:8080/api/v1/sessions/season-start?year=2026"
```

Expected: entweder 200 mit JSON der ersten Session, oder 404 `{"error":"no sessions found for year"}` falls DB leer.

- [ ] **Step 5: Commit**

```bash
cd ../../f1-tip-game
git add internal/repository/session_repository.go \
        internal/handler/session_handler.go \
        internal/router/router.go \
        main.go
git commit -m "feat(sessions): session repo + public GET /sessions/season-start"
```

---

## Task 4: Backend — Season-Scoring Pure Functions (TDD)

**Files:**
- Create: `../../f1-tip-game/coupons/scoring/season/scoring.go`
- Create: `../../f1-tip-game/coupons/scoring/season/scoring_test.go`

Diese Task wird **vor** den Schema-Erweiterungen durchgezogen, weil die Funktionen rein über Werttypen operieren und ohne DB testbar sind. Die späteren Dispatcher-Zweige (Task 7) deserialisieren die Schemas und rufen diese Funktionen auf.

- [ ] **Step 1: Pure Scoring Functions**

Create `../../f1-tip-game/coupons/scoring/season/scoring.go`:

```go
// Package season bündelt Scoring-Funktionen für Saison-Wetten:
// teamDuell, driverChampionshipRank, constructorChampionshipRank.
//
// Punkteschema (festgelegt im Design, docs/superpowers/specs/
// 2026-10-24-saison-wetten-scoring-design.md):
//   - teamDuell:                   3 Pkt wenn Sieger-Pick vor Verlierer-Pick, sonst 0.
//   - driverChampionship:          exakter Rang → 5, ±1 → 2, sonst 0.
//   - constructorChampionship:     analog zu driverChampionship.
//
// Alle Funktionen sind pure: (Schema, Standings) → int.
package season

// rankOf gibt den 1-basierten Rang von want in standings zurück,
// oder -1 wenn want nicht gelistet ist.
func rankOf[T comparable](standings []T, want T) int {
	for i, s := range standings {
		if s == want {
			return i + 1
		}
	}
	return -1
}

// TeamDuellPicks beschreibt die Picks einer teamDuell-Wette.
// Erwartet werden Pick[0] als Sieger-Tipp und Pick[1] als Verlierer-Tipp
// (die Positionen im Coupon-Schema spiegeln die Rolle wider: 1 = Sieger,
// 2 = Verlierer).
type TeamDuellPicks struct {
	WinnerDriverNumber int
	LoserDriverNumber  int
}

// ScoreTeamDuell: 3 Pkt wenn Sieger-Pick in driverStandings vor
// Verlierer-Pick steht; sonst 0. Fehlt einer der Picks → 0.
func ScoreTeamDuell(picks TeamDuellPicks, driverStandings []int) int {
	winnerRank := rankOf(driverStandings, picks.WinnerDriverNumber)
	loserRank := rankOf(driverStandings, picks.LoserDriverNumber)
	if winnerRank < 1 || loserRank < 1 {
		return 0
	}
	if winnerRank < loserRank {
		return 3
	}
	return 0
}

// ChampionshipPick beschreibt den Tipp für Fahrer- oder Konstrukteurs-WM:
// `Entity` ist DriverNumber bzw. TeamID, `TippedRank` der getippte Rang (1-basiert).
type ChampionshipPick[T comparable] struct {
	Entity     T
	TippedRank int
}

// ScoreChampionship: exakter Rang → 5, ±1 → 2, sonst 0.
// Entity nicht in Standings → 0.
func ScoreChampionship[T comparable](pick ChampionshipPick[T], standings []T) int {
	actualRank := rankOf(standings, pick.Entity)
	if actualRank < 1 {
		return 0
	}
	diff := pick.TippedRank - actualRank
	switch {
	case diff == 0:
		return 5
	case diff == 1 || diff == -1:
		return 2
	default:
		return 0
	}
}
```

- [ ] **Step 2: TDD-Tests schreiben**

Create `../../f1-tip-game/coupons/scoring/season/scoring_test.go`:

```go
package season_test

import (
	"testing"

	"github.com/GypsyyCode/f1-tip-game/coupons/scoring/season"
)

func TestScoreTeamDuell_WinnerBeforeLoser_Scores3(t *testing.T) {
	standings := []int{1, 4, 16, 11}
	got := season.ScoreTeamDuell(season.TeamDuellPicks{WinnerDriverNumber: 1, LoserDriverNumber: 11}, standings)
	if got != 3 {
		t.Fatalf("got %d, want 3", got)
	}
}

func TestScoreTeamDuell_LoserBeforeWinner_Scores0(t *testing.T) {
	standings := []int{1, 4, 16, 11}
	got := season.ScoreTeamDuell(season.TeamDuellPicks{WinnerDriverNumber: 11, LoserDriverNumber: 1}, standings)
	if got != 0 {
		t.Fatalf("got %d, want 0", got)
	}
}

func TestScoreTeamDuell_WinnerMissing_Scores0(t *testing.T) {
	standings := []int{1, 4, 16}
	got := season.ScoreTeamDuell(season.TeamDuellPicks{WinnerDriverNumber: 99, LoserDriverNumber: 1}, standings)
	if got != 0 {
		t.Fatalf("got %d, want 0", got)
	}
}

func TestScoreTeamDuell_LoserMissing_Scores0(t *testing.T) {
	standings := []int{1, 4, 16}
	got := season.ScoreTeamDuell(season.TeamDuellPicks{WinnerDriverNumber: 1, LoserDriverNumber: 99}, standings)
	if got != 0 {
		t.Fatalf("got %d, want 0", got)
	}
}

func TestScoreChampionship_Driver_ExactMatch_Scores5(t *testing.T) {
	standings := []int{1, 4, 16, 11}
	got := season.ScoreChampionship(season.ChampionshipPick[int]{Entity: 1, TippedRank: 1}, standings)
	if got != 5 {
		t.Fatalf("got %d, want 5", got)
	}
}

func TestScoreChampionship_Driver_OffByOnePlus_Scores2(t *testing.T) {
	standings := []int{1, 4, 16, 11}
	got := season.ScoreChampionship(season.ChampionshipPick[int]{Entity: 4, TippedRank: 3}, standings)
	if got != 2 {
		t.Fatalf("got %d, want 2", got)
	}
}

func TestScoreChampionship_Driver_OffByOneMinus_Scores2(t *testing.T) {
	standings := []int{1, 4, 16, 11}
	got := season.ScoreChampionship(season.ChampionshipPick[int]{Entity: 4, TippedRank: 1}, standings)
	if got != 2 {
		t.Fatalf("got %d, want 2", got)
	}
}

func TestScoreChampionship_Driver_OffByTwo_Scores0(t *testing.T) {
	standings := []int{1, 4, 16, 11}
	got := season.ScoreChampionship(season.ChampionshipPick[int]{Entity: 11, TippedRank: 2}, standings)
	if got != 0 {
		t.Fatalf("got %d, want 0", got)
	}
}

func TestScoreChampionship_Driver_NotInStandings_Scores0(t *testing.T) {
	standings := []int{1, 4, 16}
	got := season.ScoreChampionship(season.ChampionshipPick[int]{Entity: 99, TippedRank: 1}, standings)
	if got != 0 {
		t.Fatalf("got %d, want 0", got)
	}
}

func TestScoreChampionship_Constructor_ExactMatch_Scores5(t *testing.T) {
	standings := []uint{5, 2, 8, 1}
	got := season.ScoreChampionship(season.ChampionshipPick[uint]{Entity: 5, TippedRank: 1}, standings)
	if got != 5 {
		t.Fatalf("got %d, want 5", got)
	}
}

func TestScoreChampionship_Constructor_OffByOne_Scores2(t *testing.T) {
	standings := []uint{5, 2, 8, 1}
	got := season.ScoreChampionship(season.ChampionshipPick[uint]{Entity: 8, TippedRank: 2}, standings)
	if got != 2 {
		t.Fatalf("got %d, want 2", got)
	}
}

func TestScoreChampionship_Constructor_NotInStandings_Scores0(t *testing.T) {
	standings := []uint{5, 2, 8}
	got := season.ScoreChampionship(season.ChampionshipPick[uint]{Entity: 999, TippedRank: 1}, standings)
	if got != 0 {
		t.Fatalf("got %d, want 0", got)
	}
}
```

- [ ] **Step 3: Tests ausführen (RED → GREEN)**

```bash
cd ../../f1-tip-game
go test ./coupons/scoring/season/...
```

Expected: alle 12 Tests PASS.

- [ ] **Step 4: Commit**

```bash
cd ../../f1-tip-game
git add coupons/scoring/season/scoring.go coupons/scoring/season/scoring_test.go
git commit -m "feat(scoring): pure functions for season bets (TDD)"
```

---

## Task 5: Backend — Schema-Erweiterungen (`season_year` + `team_id`-Reinigung)

**Files:**
- Modify: `../../f1-tip-game/coupons/team/team_duell_coupon.go`
- Modify: `../../f1-tip-game/coupons/season/driver_championship_rank_coupon.go`
- Modify: `../../f1-tip-game/coupons/season/constructor_championship_rank_coupon.go`

- [ ] **Step 1: TeamDuellSchema erweitern**

In `../../f1-tip-game/coupons/team/team_duell_coupon.go` den Struct erweitern:

```go
type TeamDuellSchema struct {
	Placements [2]coupons.Placement `gorm:"not null" json:"placements"`
	SeasonYear int                  `                json:"season_year,omitempty"`
}
```

Validate bleibt wie es ist (Nullwert `0` ist zulässig; Dispatcher kümmert sich).

- [ ] **Step 2: DriverChampionshipRankSchema erweitern**

In `../../f1-tip-game/coupons/season/driver_championship_rank_coupon.go`:

```go
type DriverChampionshipRankSchema struct {
	coupons.Placement `gorm:"not null" json:"placement"`
	SeasonYear int    `                json:"season_year,omitempty"`
}
```

Die eingebettete `coupons.Placement` bleibt (bestehender Form), nur das neue Feld kommt dazu.

- [ ] **Step 3: ConstructorChampionshipRankSchema umbauen (team_id statt driver_id)**

Alt:
```go
type ConstructorChampionshipRankSchema struct {
	coupons.Placement `gorm:"not null" json:"placement"`
}
```

Neu — ein benanntes Feld mit eigener Struktur:

```go
// ConstructorPlacement ist das Konstrukteurs-Pendant zu coupons.Placement:
// Ein Team-ID + prognostizierter WM-Rang.
type ConstructorPlacement struct {
	TeamID   uint `gorm:"not null" json:"team_id"`
	Position int  `gorm:"not null" json:"position"`
}

type ConstructorChampionshipRankSchema struct {
	Placement ConstructorPlacement `gorm:"embedded;embeddedPrefix:placement_" json:"placement"`
	SeasonYear int                 `                                          json:"season_year,omitempty"`
}
```

**Breaking Change:** Alte Coupons mit `driver_id`-Payload werden nicht mehr deserialisiert; der Dispatcher gibt `(0, false)` zurück → sie bleiben uns-cored. Das ist konsistent mit der Spec-Entscheidung „Alt-Coupons ohne `season_year`".

- [ ] **Step 4: Build**

```bash
cd ../../f1-tip-game
go build ./...
```

Expected: ggf. Fehler im `scoreOne`-Dispatcher, falls dieser schon einen Fall für `constructorChampionshipRank` hat (unwahrscheinlich: Phase 3b kommentiert ihn als TODO). Falls Fehler: anschauen und in **Task 7** fixen.

- [ ] **Step 5: Commit**

```bash
cd ../../f1-tip-game
git add coupons/team/team_duell_coupon.go \
        coupons/season/driver_championship_rank_coupon.go \
        coupons/season/constructor_championship_rank_coupon.go
git commit -m "feat(coupons): season_year on all season schemas + team_id on constructorChampionship"
```

---

## Task 6: Backend — SeasonResults Compute + Override Service

**Files:**
- Create: `../../f1-tip-game/internal/service/season_results_service.go`
- Create: `../../f1-tip-game/internal/service/season_results_service_test.go`

- [ ] **Step 1: Service-Interface + Loader-Interfaces**

Create `../../f1-tip-game/internal/service/season_results_service.go`:

```go
package service

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/GypsyyCode/f1-tip-game/internal/models"
	"github.com/GypsyyCode/f1-tip-game/internal/repository"
)

// Kleine Interfaces, damit der Service einfach testbar bleibt.
// Erfüllt von repository.SessionRepository / ResultRepository / TeamRepository.
type seasonSessionsLoader interface {
	FindByYear(year int, types []string) ([]models.Session, error)
}
type seasonResultsLoader interface {
	FindBySession(sessionKey int) ([]models.Result, error)
}
type driverTeamResolver interface {
	FindByDriverNumbers(driverNumbers []int) (map[int]uint, error)
}

// SeasonResultsService: Compute (aus models.Result), Override (Admin-PUT), Get.
type SeasonResultsService interface {
	Compute(ctx context.Context, year int) (*models.SeasonResults, error)
	Override(ctx context.Context, year int, drivers, constructors []int64) (*models.SeasonResults, error)
	Get(ctx context.Context, year int) (*models.SeasonResults, error)
}

type seasonResultsService struct {
	repo         repository.SeasonResultsRepository
	sessions     seasonSessionsLoader
	results      seasonResultsLoader
	driverTeams  driverTeamResolver
	now          func() time.Time
}

func NewSeasonResultsService(
	repo repository.SeasonResultsRepository,
	sessions seasonSessionsLoader,
	results seasonResultsLoader,
	driverTeams driverTeamResolver,
) SeasonResultsService {
	return &seasonResultsService{
		repo: repo, sessions: sessions, results: results,
		driverTeams: driverTeams, now: time.Now,
	}
}

// Compute aggregiert Race- und Sprint-Points des Jahres, sortiert absteigend,
// mappt Teams via Driver.TeamID. Upsertet in season_results.
func (s *seasonResultsService) Compute(ctx context.Context, year int) (*models.SeasonResults, error) {
	sessions, err := s.sessions.FindByYear(year, []string{"Race", "Sprint"})
	if err != nil {
		return nil, fmt.Errorf("load sessions: %w", err)
	}
	if len(sessions) == 0 {
		return nil, fmt.Errorf("no race/sprint sessions found for year %d", year)
	}

	driverPoints := map[int]float64{}
	for _, sess := range sessions {
		res, err := s.results.FindBySession(sess.SessionKey)
		if err != nil {
			return nil, fmt.Errorf("load results for session %d: %w", sess.SessionKey, err)
		}
		for _, r := range res {
			if r.Points != nil {
				driverPoints[r.DriverNumber] += *r.Points
			}
		}
	}
	if len(driverPoints) == 0 {
		return nil, fmt.Errorf("no result points found for year %d — ensure sessions are synced", year)
	}

	// Sortiere Fahrer absteigend nach Punkten, Tie-Break: DriverNumber asc (stabile, erklärbare Heuristik).
	driverStandings := sortByValueDescTiebreakAsc(driverPoints)

	// Konstrukteurs-Standings: aggregiere Punkte je TeamID via Driver.TeamID.
	driverNumbers := keys(driverPoints)
	driverToTeam, err := s.driverTeams.FindByDriverNumbers(driverNumbers)
	if err != nil {
		return nil, fmt.Errorf("map drivers to teams: %w", err)
	}
	teamPoints := map[uint]float64{}
	for drv, pts := range driverPoints {
		if tid, ok := driverToTeam[drv]; ok {
			teamPoints[tid] += pts
		}
	}
	constructorStandings := sortByValueDescTiebreakAsc(teamPoints)

	// Build int64-Arrays für pq-kompatible Persistenz.
	drvArr := toInt64(driverStandings)
	cstArr := toInt64Uints(constructorStandings)

	now := s.now()
	sr := &models.SeasonResults{
		SeasonYear:           year,
		DriverStandings:      drvArr,
		ConstructorStandings: cstArr,
		ComputedAt:           &now,
	}
	return s.repo.Upsert(sr)
}

func (s *seasonResultsService) Override(ctx context.Context, year int, drivers, constructors []int64) (*models.SeasonResults, error) {
	now := s.now()
	return s.repo.SetOverride(year, drivers, constructors, now)
}

func (s *seasonResultsService) Get(ctx context.Context, year int) (*models.SeasonResults, error) {
	return s.repo.Get(year)
}

// ---------- Hilfsfunktionen ----------

// sortByValueDescTiebreakAsc nimmt eine Map K→float64 und gibt die Keys
// absteigend nach Wert, bei Gleichstand aufsteigend nach Key zurück.
// Der Key-Typ ist konstanter als die Verwendung mit int bzw. uint.
func sortByValueDescTiebreakAsc[K ordered](m map[K]float64) []K {
	keys := make([]K, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool {
		if m[keys[i]] != m[keys[j]] {
			return m[keys[i]] > m[keys[j]]
		}
		return keys[i] < keys[j]
	})
	return keys
}

// ordered duplikat des constraints.Ordered-Subsets, nur int + uint.
type ordered interface{ ~int | ~uint }

func keys[K comparable, V any](m map[K]V) []K {
	ks := make([]K, 0, len(m))
	for k := range m {
		ks = append(ks, k)
	}
	return ks
}

func toInt64(xs []int) []int64 {
	out := make([]int64, len(xs))
	for i, v := range xs {
		out[i] = int64(v)
	}
	return out
}

func toInt64Uints(xs []uint) []int64 {
	out := make([]int64, len(xs))
	for i, v := range xs {
		out[i] = int64(v)
	}
	return out
}
```

**Hinweis zum Rückgabetyp:** `DriverStandings` und `ConstructorStandings` sind in `models.SeasonResults` vom Typ `pq.Int64Array`, der assignbar aus `[]int64` ist. Keine zusätzliche Konvertierung nötig.

- [ ] **Step 2: Fixture-basierter Test für Compute**

Create `../../f1-tip-game/internal/service/season_results_service_test.go`:

```go
package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/GypsyyCode/f1-tip-game/internal/models"
	"github.com/GypsyyCode/f1-tip-game/internal/repository"
	"github.com/GypsyyCode/f1-tip-game/internal/service"
	"github.com/lib/pq"
)

// --- Stubs ---

type stubSessions struct{ sessions []models.Session }

func (s *stubSessions) FindByYear(year int, types []string) ([]models.Session, error) {
	return s.sessions, nil
}

type stubResults struct{ perSession map[int][]models.Result }

func (s *stubResults) FindBySession(sessionKey int) ([]models.Result, error) {
	return s.perSession[sessionKey], nil
}

type stubDriverTeams struct{ m map[int]uint }

func (s *stubDriverTeams) FindByDriverNumbers(dns []int) (map[int]uint, error) {
	return s.m, nil
}

type stubRepo struct{ saved *models.SeasonResults }

func (r *stubRepo) Get(year int) (*models.SeasonResults, error) { return r.saved, nil }
func (r *stubRepo) Upsert(sr *models.SeasonResults) (*models.SeasonResults, error) {
	r.saved = sr
	return sr, nil
}
func (r *stubRepo) SetOverride(year int, drv, cst []int64, at time.Time) (*models.SeasonResults, error) {
	r.saved = &models.SeasonResults{SeasonYear: year, DriverStandings: pq.Int64Array(drv), ConstructorStandings: pq.Int64Array(cst), OverriddenAt: &at}
	return r.saved, nil
}
func (r *stubRepo) MarkScored(year int, at time.Time) error { return nil }

// stubRepo erfüllt bewusst nicht alle Repository-Methoden außer denen,
// die der Service nutzt — statisch Check via Interface-Assert:
var _ repository.SeasonResultsRepository = (*stubRepo)(nil)

// --- Helpers ---

func pts(v float64) *float64 { return &v }

func TestCompute_AggregatesTwoRacesPlusSprint(t *testing.T) {
	// Zwei Rennen + ein Sprint, drei Fahrer, zwei Teams.
	sessions := []models.Session{
		{SessionKey: 101, SessionType: "Race"},
		{SessionKey: 102, SessionType: "Race"},
		{SessionKey: 201, SessionType: "Sprint"},
	}
	results := map[int][]models.Result{
		101: {
			{DriverNumber: 1, Points: pts(25)},
			{DriverNumber: 4, Points: pts(18)},
			{DriverNumber: 16, Points: pts(15)},
		},
		102: {
			{DriverNumber: 1, Points: pts(15)},
			{DriverNumber: 4, Points: pts(25)},
			{DriverNumber: 16, Points: pts(10)},
		},
		201: {
			{DriverNumber: 1, Points: pts(8)},
			{DriverNumber: 4, Points: pts(7)},
		},
	}
	// Fahrer 1 → Team 10 (Red Bull), Fahrer 4 → Team 20 (McLaren), Fahrer 16 → Team 30 (Ferrari)
	driverTeams := map[int]uint{1: 10, 4: 20, 16: 30}

	repo := &stubRepo{}
	svc := service.NewSeasonResultsService(
		repo,
		&stubSessions{sessions: sessions},
		&stubResults{perSession: results},
		&stubDriverTeams{m: driverTeams},
	)

	got, err := svc.Compute(context.Background(), 2026)
	if err != nil {
		t.Fatalf("compute: %v", err)
	}

	// Punkte: #1 = 48, #4 = 50, #16 = 25 → Reihenfolge: 4, 1, 16
	wantDrivers := pq.Int64Array{4, 1, 16}
	if !int64ArrayEq(got.DriverStandings, wantDrivers) {
		t.Fatalf("driver standings: got %v, want %v", got.DriverStandings, wantDrivers)
	}

	// Teams: Team 20 (McLaren) = 50, Team 10 (Red Bull) = 48, Team 30 (Ferrari) = 25
	wantConstructors := pq.Int64Array{20, 10, 30}
	if !int64ArrayEq(got.ConstructorStandings, wantConstructors) {
		t.Fatalf("constructor standings: got %v, want %v", got.ConstructorStandings, wantConstructors)
	}

	if got.ComputedAt == nil {
		t.Fatalf("ComputedAt not set")
	}
}

func TestCompute_NoSessions_ReturnsError(t *testing.T) {
	repo := &stubRepo{}
	svc := service.NewSeasonResultsService(
		repo,
		&stubSessions{sessions: nil},
		&stubResults{perSession: nil},
		&stubDriverTeams{m: nil},
	)
	if _, err := svc.Compute(context.Background(), 2099); err == nil {
		t.Fatalf("expected error, got nil")
	}
}

func TestCompute_NoResults_ReturnsError(t *testing.T) {
	sessions := []models.Session{{SessionKey: 101, SessionType: "Race"}}
	repo := &stubRepo{}
	svc := service.NewSeasonResultsService(
		repo,
		&stubSessions{sessions: sessions},
		&stubResults{perSession: map[int][]models.Result{101: {}}},
		&stubDriverTeams{m: nil},
	)
	if _, err := svc.Compute(context.Background(), 2026); err == nil {
		t.Fatalf("expected error for empty results, got nil")
	}
}

func int64ArrayEq(a, b pq.Int64Array) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
```

- [ ] **Step 3: Tests ausführen**

```bash
cd ../../f1-tip-game
go test ./internal/service/...
```

Expected: 3 Tests PASS. Falls Build-Fehler „ordered redeclared" o. Ä., Alias umbenennen (lokale Hilfs-Type) oder `golang.org/x/exp/constraints` nutzen.

- [ ] **Step 4: Commit**

```bash
cd ../../f1-tip-game
git add internal/service/season_results_service.go \
        internal/service/season_results_service_test.go
git commit -m "feat(season): compute + override service (TDD)"
```

---

## Task 7: Backend — Scoring-Dispatcher erweitern + POST /scoring/season/:year

**Files:**
- Modify: `../../f1-tip-game/coupons/scoring/service.go`
- Modify: `../../f1-tip-game/internal/handler/scoring_handler.go`

- [ ] **Step 1: Dispatcher-Erweiterung in `scoreOne`**

In `../../f1-tip-game/coupons/scoring/service.go`:

Füge im Import die neuen Pakete hinzu:

```go
import (
	// ... existing ...
	couponseason "github.com/GypsyyCode/f1-tip-game/coupons/season"
	couponteam "github.com/GypsyyCode/f1-tip-game/coupons/team"
	scoringseason "github.com/GypsyyCode/f1-tip-game/coupons/scoring/season"
	"github.com/GypsyyCode/f1-tip-game/internal/models"
)
```

Erweitere `Service` + `NewService` um ein `SeasonResultsStore`-Interface (Lesen + MarkScored):

```go
// SeasonResultsStore liefert Standings und markiert Scoring-Zeitpunkt.
// Admin-Scoring über ScoreSeason setzt scored_at zum Abschluss, damit die
// FE-Statuszeile "Zuletzt gescored" sofort nach Button-Klick stimmt und
// der Scheduler-Guard greift.
type SeasonResultsStore interface {
	Get(year int) (*models.SeasonResults, error)
	MarkScored(year int, at time.Time) error
}

type Service struct {
	db             *gorm.DB
	results        ResultsLoader
	aggregates     AggregatesLoader
	seasonResults  SeasonResultsStore   // NEU
}

func NewService(
	db *gorm.DB,
	results ResultsLoader,
	aggregates AggregatesLoader,
	seasonResults SeasonResultsStore,   // NEU
) *Service {
	return &Service{db: db, results: results, aggregates: aggregates, seasonResults: seasonResults}
}
```

Dazu den Zeit-Import ergänzen, falls noch nicht vorhanden:
```go
import "time"
```

**Signatur von `scoreOne` erweitern** — zusätzlicher Parameter `season *models.SeasonResults`:

Alt (vereinfacht):
```go
func scoreOne(schemaName string, schemaJSON []byte, results []models.Result, agg models.SessionAggregates) (int, bool) {
```

Neu:
```go
func scoreOne(
	schemaName string,
	schemaJSON []byte,
	results []models.Result,
	agg models.SessionAggregates,
	season *models.SeasonResults, // kann nil sein (Session-Scoring braucht's nicht)
) (int, bool) {
```

Füge am Ende des `switch`-Statements vor dem `default`:

```go
	case "teamDuell":
		if season == nil {
			return 0, false
		}
		var s couponteam.TeamDuellSchema
		if err := json.Unmarshal(wrap.Data, &s); err != nil {
			return 0, false
		}
		picks := scoringseason.TeamDuellPicks{
			WinnerDriverNumber: s.Placements[0].DriverId,
			LoserDriverNumber:  s.Placements[1].DriverId,
		}
		return scoringseason.ScoreTeamDuell(picks, int64ToIntSlice(season.DriverStandings)), true

	case "driverChampionshipRank":
		if season == nil {
			return 0, false
		}
		var s couponseason.DriverChampionshipRankSchema
		if err := json.Unmarshal(wrap.Data, &s); err != nil {
			return 0, false
		}
		pick := scoringseason.ChampionshipPick[int]{
			Entity:     s.DriverId,
			TippedRank: s.Position,
		}
		return scoringseason.ScoreChampionship(pick, int64ToIntSlice(season.DriverStandings)), true

	case "constructorChampionshipRank":
		if season == nil {
			return 0, false
		}
		var s couponseason.ConstructorChampionshipRankSchema
		if err := json.Unmarshal(wrap.Data, &s); err != nil {
			return 0, false
		}
		pick := scoringseason.ChampionshipPick[uint]{
			Entity:     s.Placement.TeamID,
			TippedRank: s.Placement.Position,
		}
		return scoringseason.ScoreChampionship(pick, int64ToUintSlice(season.ConstructorStandings)), true
```

Füge am Ende der Datei die Konvertierungs-Helpers:

```go
func int64ToIntSlice(xs []int64) []int {
	out := make([]int, len(xs))
	for i, v := range xs {
		out[i] = int(v)
	}
	return out
}

func int64ToUintSlice(xs []int64) []uint {
	out := make([]uint, len(xs))
	for i, v := range xs {
		out[i] = uint(v)
	}
	return out
}
```

**Alle vorhandenen Call-Sites von `scoreOne` anpassen:** Die bestehende `ScoreSession`-Methode ruft `scoreOne` → zusätzlichen Parameter `nil` übergeben (Session-Scoring braucht keine Season-Standings).

- [ ] **Step 2: Neue Methode `ScoreSeason` ergänzen**

In derselben Datei nach `ScoreSession`:

```go
// ScoreSeason wertet alle Season-Coupons für das Jahr aus und persistiert
// die Scores. Lädt dafür einmalig die SeasonResults; Dispatcher-Zweige
// ohne season_year oder mit falschem Jahr liefern (0, false) → nicht gescored.
func (s *Service) ScoreSeason(ctx context.Context, year int) (int, error) {
	season, err := s.seasonResults.Get(year)
	if err != nil {
		return 0, fmt.Errorf("load season results: %w", err)
	}
	if season == nil {
		return 0, fmt.Errorf("no season results stored for %d — run compute first", year)
	}

	type rawCoupon struct {
		ID         string
		SchemaName string
		Schema     []byte
	}
	var rows []rawCoupon
	if err := s.db.WithContext(ctx).
		Table("coupons").
		Select("id, schema_name, schema").
		Where("schema::jsonb -> 'data' ->> 'season_year' = ?", fmt.Sprint(year)).
		Where("schema_name IN ?", []string{"teamDuell", "driverChampionshipRank", "constructorChampionshipRank"}).
		Scan(&rows).Error; err != nil {
		return 0, fmt.Errorf("load season coupons: %w", err)
	}

	n := 0
	for _, row := range rows {
		score, ok := scoreOne(row.SchemaName, row.Schema, nil, models.SessionAggregates{}, season)
		if !ok {
			continue
		}
		if err := s.db.WithContext(ctx).
			Table("coupons").
			Where("id = ?", row.ID).
			Update("score", score).Error; err != nil {
			return n, fmt.Errorf("update coupon %s: %w", row.ID, err)
		}
		n++
	}

	// scored_at setzen — sowohl für Admin-Trigger als auch Scheduler relevant.
	if err := s.seasonResults.MarkScored(year, time.Now()); err != nil {
		return n, fmt.Errorf("mark scored: %w", err)
	}
	return n, nil
}
```

- [ ] **Step 3: Scoring-Handler erweitern**

In `../../f1-tip-game/internal/handler/scoring_handler.go`:

Erweitere den Admin-Routes-Registrar:
```go
func (h *ScoringHandler) RegisterAdminRoutes(r *gin.RouterGroup) {
	// ... existing POST /scoring/:sessionKey ...
	r.POST("/scoring/season/:year", h.scoreSeason)
}
```

Neue Handler-Methode:
```go
func (h *ScoringHandler) scoreSeason(c *gin.Context) {
	yearStr := c.Param("year")
	year, err := strconv.Atoi(yearStr)
	if err != nil || year <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid year"})
		return
	}
	n, err := h.svc.ScoreSeason(c.Request.Context(), year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"season_year": year, "scored_coupons": n})
}
```

- [ ] **Step 4: main.go — SeasonResultsLoader bei NewService injizieren**

In `../../f1-tip-game/main.go` beim bestehenden `scoring.NewService(db, resultRepo, aggregatesSvc)`-Call:

```go
scoringSvc := scoring.NewService(db, resultRepo, aggregatesSvc, seasonResultsRepo)
```

(`seasonResultsRepo` kommt aus Task 2.)

- [ ] **Step 5: Build**

```bash
cd ../../f1-tip-game
go build ./...
```

Expected: alle Pakete bauen durch. Falls `scoreOne`-Call-Sites in Tests sind, ergänze dort das `nil`.

- [ ] **Step 6: Commit**

```bash
cd ../../f1-tip-game
git add coupons/scoring/service.go \
        internal/handler/scoring_handler.go \
        main.go
git commit -m "feat(scoring): dispatch season bets + POST /scoring/season/:year"
```

---

## Task 8: Backend — SeasonResults Handler (Compute, Override, Get)

**Files:**
- Create: `../../f1-tip-game/internal/handler/season_results_handler.go`
- Modify: `../../f1-tip-game/internal/router/router.go`
- Modify: `../../f1-tip-game/main.go`

- [ ] **Step 1: Handler schreiben**

Create `../../f1-tip-game/internal/handler/season_results_handler.go`:

```go
package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/GypsyyCode/f1-tip-game/internal/service"
)

type SeasonResultsHandler struct {
	svc service.SeasonResultsService
}

func NewSeasonResultsHandler(svc service.SeasonResultsService) *SeasonResultsHandler {
	return &SeasonResultsHandler{svc: svc}
}

// RegisterPublicRoutes:
//   GET /season-results/:year — zeigt die Standings (null wenn noch kein Record).
func (h *SeasonResultsHandler) RegisterPublicRoutes(r *gin.RouterGroup) {
	r.GET("/season-results/:year", h.get)
}

// RegisterAdminRoutes:
//   POST /season-results/:year/compute — aggregiert aus models.Result.
//   PUT  /season-results/:year         — Override durch Admin.
func (h *SeasonResultsHandler) RegisterAdminRoutes(r *gin.RouterGroup) {
	r.POST("/season-results/:year/compute", h.compute)
	r.PUT("/season-results/:year", h.override)
}

func parseYear(c *gin.Context) (int, bool) {
	y, err := strconv.Atoi(c.Param("year"))
	if err != nil || y <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid year"})
		return 0, false
	}
	return y, true
}

func (h *SeasonResultsHandler) get(c *gin.Context) {
	year, ok := parseYear(c)
	if !ok {
		return
	}
	sr, err := h.svc.Get(c.Request.Context(), year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if sr == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no results stored for year"})
		return
	}
	c.JSON(http.StatusOK, sr)
}

func (h *SeasonResultsHandler) compute(c *gin.Context) {
	year, ok := parseYear(c)
	if !ok {
		return
	}
	sr, err := h.svc.Compute(c.Request.Context(), year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sr)
}

func (h *SeasonResultsHandler) override(c *gin.Context) {
	year, ok := parseYear(c)
	if !ok {
		return
	}
	var body struct {
		DriverStandings      []int64 `json:"driver_standings"`
		ConstructorStandings []int64 `json:"constructor_standings"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body (expect {driver_standings, constructor_standings})"})
		return
	}
	if len(body.DriverStandings) == 0 || len(body.ConstructorStandings) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_standings and constructor_standings must be non-empty"})
		return
	}
	sr, err := h.svc.Override(c.Request.Context(), year, body.DriverStandings, body.ConstructorStandings)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sr)
}
```

- [ ] **Step 2: Router + main.go wiring**

In `router.go`:
```go
type Handlers struct {
	// ... existing + Team, Session (Tasks 1/3) ...
	SeasonResults *handler.SeasonResultsHandler    // NEU
}
```

```go
	// in Setup public:
	h.SeasonResults.RegisterPublicRoutes(public)
	// in Setup admin:
	h.SeasonResults.RegisterAdminRoutes(admin)
```

In `main.go`:
```go
seasonResultsSvc := service.NewSeasonResultsService(seasonResultsRepo, sessionRepo, resultRepo, teamRepo)
seasonResultsHandler := handler.NewSeasonResultsHandler(seasonResultsSvc)
```

Und im `router.Setup`-Call `SeasonResults: seasonResultsHandler` setzen.

- [ ] **Step 3: Build + Smoketest**

```bash
cd ../../f1-tip-game
go build ./...
# Testdb an → Admin-Token holen (Login) →
# curl -X POST http://localhost:8080/api/v1/season-results/2026/compute \
#   -H "Authorization: Bearer <TOKEN>"
```

- [ ] **Step 4: Commit**

```bash
cd ../../f1-tip-game
git add internal/handler/season_results_handler.go \
        internal/router/router.go \
        main.go
git commit -m "feat(season): season_results handler (compute/override/get)"
```

---

## Task 9: Backend — Scheduler (Daily-Ticker + Decision Function TDD)

**Files:**
- Create: `../../f1-tip-game/internal/scheduler/season_scheduler.go`
- Create: `../../f1-tip-game/internal/scheduler/season_scheduler_test.go`
- Modify: `../../f1-tip-game/main.go`

- [ ] **Step 1: Decision Function + Ticker**

Create `../../f1-tip-game/internal/scheduler/season_scheduler.go`:

```go
// Package scheduler enthält Hintergrund-Jobs des Backends.
//
// SeasonScheduler: Daily-Ticker um 03:00 UTC. Entscheidet pro Tick,
// ob die aktuelle Saison bereit zum Auto-Compute+Score ist — Guards:
//   G1: season_results.scored_at ist NULL.
//   G2: alle Race-Sessions des Jahres sind beendet (date_end < now).
//   G3: alle Race-Sessions haben ≥1 models.Result-Eintrag (synced).
// Wenn alles stimmt: Compute → Score → MarkScored(now).
package scheduler

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/GypsyyCode/f1-tip-game/internal/models"
)

// SessionsForScheduler liefert Race-Sessions eines Jahres.
type SessionsForScheduler interface {
	FindByYear(year int, types []string) ([]models.Session, error)
	CountResultsBySession(sessionKey int) (int64, error)
}

// SeasonResultsForScheduler ist der Zugriff auf season_results für Guards + MarkScored.
type SeasonResultsForScheduler interface {
	Get(year int) (*models.SeasonResults, error)
	MarkScored(year int, at time.Time) error
}

// SeasonServiceForScheduler ist die Compute+Score-Facette, die wir brauchen.
type SeasonServiceForScheduler interface {
	Compute(ctx context.Context, year int) (*models.SeasonResults, error)
	ScoreSeason(ctx context.Context, year int) (int, error)
}

// Deps bündelt die Abhängigkeiten; damit lässt sich die Entscheidungs-Fn testbar aufrufen.
type Deps struct {
	Sessions SessionsForScheduler
	Results  SeasonResultsForScheduler
	Service  SeasonServiceForScheduler
	Now      func() time.Time
}

// Decide prüft die drei Guards und führt — falls erfüllt — Compute + Score aus.
// Rückgabe: scoredCouponCount (0 wenn geblockt), didRun bool, err.
func Decide(ctx context.Context, d Deps, year int) (int, bool, error) {
	// G1
	sr, err := d.Results.Get(year)
	if err != nil {
		return 0, false, fmt.Errorf("get season_results: %w", err)
	}
	if sr != nil && sr.ScoredAt != nil {
		return 0, false, nil
	}

	// G2
	sessions, err := d.Sessions.FindByYear(year, []string{"Race"})
	if err != nil {
		return 0, false, fmt.Errorf("find sessions: %w", err)
	}
	if len(sessions) == 0 {
		return 0, false, nil
	}
	now := d.Now()
	for _, s := range sessions {
		// Guard: "beendet" heuristisch über date_start + 4h — Session hat kein DateEnd,
		// also nehmen wir ein großzügiges Fenster. Falls DateEnd-Spalte eingezogen wird,
		// hier auf s.DateEnd umstellen.
		if s.DateStart.Add(4 * time.Hour).After(now) {
			return 0, false, nil
		}
	}

	// G3
	for _, s := range sessions {
		n, err := d.Sessions.CountResultsBySession(s.SessionKey)
		if err != nil {
			return 0, false, fmt.Errorf("count results for session %d: %w", s.SessionKey, err)
		}
		if n == 0 {
			return 0, false, nil
		}
	}

	// Alle Guards ok → Compute + Score.
	if _, err := d.Service.Compute(ctx, year); err != nil {
		return 0, false, fmt.Errorf("compute: %w", err)
	}
	n, err := d.Service.ScoreSeason(ctx, year)
	if err != nil {
		return n, true, fmt.Errorf("score season: %w", err)
	}
	if err := d.Results.MarkScored(year, now); err != nil {
		return n, true, fmt.Errorf("mark scored: %w", err)
	}
	return n, true, nil
}

// Start blockiert nicht; startet eine Goroutine, die daily um 03:00 UTC Decide aufruft.
func Start(ctx context.Context, d Deps) {
	go func() {
		for {
			nextRun := nextTickAt(d.Now(), 3)
			select {
			case <-ctx.Done():
				return
			case <-time.After(time.Until(nextRun)):
			}
			year := d.Now().UTC().Year()
			n, didRun, err := Decide(ctx, d, year)
			if err != nil {
				log.Printf("season-scheduler: tick %s: %v (ran=%v, scored=%d)", nextRun.Format(time.RFC3339), err, didRun, n)
				continue
			}
			if didRun {
				log.Printf("season-scheduler: tick %s: season %d scored (%d coupons)", nextRun.Format(time.RFC3339), year, n)
			}
		}
	}()
}

// nextTickAt gibt den nächsten Zeitpunkt der Form hh:00:00 UTC zurück, der nach now liegt.
func nextTickAt(now time.Time, hourUTC int) time.Time {
	n := now.UTC()
	t := time.Date(n.Year(), n.Month(), n.Day(), hourUTC, 0, 0, 0, time.UTC)
	if !t.After(n) {
		t = t.Add(24 * time.Hour)
	}
	return t
}
```

- [ ] **Step 2: Tests für Decide**

Create `../../f1-tip-game/internal/scheduler/season_scheduler_test.go`:

```go
package scheduler_test

import (
	"context"
	"testing"
	"time"

	"github.com/GypsyyCode/f1-tip-game/internal/models"
	"github.com/GypsyyCode/f1-tip-game/internal/scheduler"
)

// --- Stubs ---

type stubSessions struct {
	byYear       []models.Session
	countResults map[int]int64
}

func (s *stubSessions) FindByYear(year int, types []string) ([]models.Session, error) {
	return s.byYear, nil
}
func (s *stubSessions) CountResultsBySession(sessionKey int) (int64, error) {
	return s.countResults[sessionKey], nil
}

type stubResults struct {
	get        *models.SeasonResults
	markedYear int
}

func (r *stubResults) Get(year int) (*models.SeasonResults, error) { return r.get, nil }
func (r *stubResults) MarkScored(year int, at time.Time) error     { r.markedYear = year; return nil }

type stubService struct {
	computed   bool
	scored     bool
	scoreCount int
}

func (s *stubService) Compute(ctx context.Context, year int) (*models.SeasonResults, error) {
	s.computed = true
	return &models.SeasonResults{SeasonYear: year}, nil
}
func (s *stubService) ScoreSeason(ctx context.Context, year int) (int, error) {
	s.scored = true
	return s.scoreCount, nil
}

func fixedNow(t time.Time) func() time.Time { return func() time.Time { return t } }

// --- Tests ---

func TestDecide_AlreadyScored_DoesNothing(t *testing.T) {
	now := time.Date(2026, 12, 15, 3, 0, 0, 0, time.UTC)
	scored := time.Date(2026, 12, 14, 3, 0, 0, 0, time.UTC)
	svc := &stubService{scoreCount: 42}
	n, ran, err := scheduler.Decide(context.Background(), scheduler.Deps{
		Sessions: &stubSessions{},
		Results:  &stubResults{get: &models.SeasonResults{SeasonYear: 2026, ScoredAt: &scored}},
		Service:  svc,
		Now:      fixedNow(now),
	}, 2026)
	if err != nil || ran || n != 0 {
		t.Fatalf("got (n=%d, ran=%v, err=%v); want (0,false,nil)", n, ran, err)
	}
	if svc.computed || svc.scored {
		t.Fatalf("service should not have been called")
	}
}

func TestDecide_SessionInFuture_DoesNothing(t *testing.T) {
	now := time.Date(2026, 11, 15, 3, 0, 0, 0, time.UTC)
	futureSession := models.Session{SessionKey: 1, DateStart: time.Date(2026, 12, 7, 15, 0, 0, 0, time.UTC)}
	svc := &stubService{}
	n, ran, err := scheduler.Decide(context.Background(), scheduler.Deps{
		Sessions: &stubSessions{byYear: []models.Session{futureSession}},
		Results:  &stubResults{get: nil},
		Service:  svc,
		Now:      fixedNow(now),
	}, 2026)
	if err != nil || ran || n != 0 {
		t.Fatalf("got (n=%d, ran=%v, err=%v); want (0,false,nil)", n, ran, err)
	}
	if svc.computed || svc.scored {
		t.Fatalf("service should not have been called")
	}
}

func TestDecide_SessionUnsynced_DoesNothing(t *testing.T) {
	now := time.Date(2026, 12, 15, 3, 0, 0, 0, time.UTC)
	finished := models.Session{SessionKey: 1, DateStart: time.Date(2026, 12, 7, 15, 0, 0, 0, time.UTC)}
	svc := &stubService{}
	n, ran, err := scheduler.Decide(context.Background(), scheduler.Deps{
		Sessions: &stubSessions{byYear: []models.Session{finished}, countResults: map[int]int64{1: 0}},
		Results:  &stubResults{get: nil},
		Service:  svc,
		Now:      fixedNow(now),
	}, 2026)
	if err != nil || ran || n != 0 {
		t.Fatalf("got (n=%d, ran=%v, err=%v); want (0,false,nil)", n, ran, err)
	}
	if svc.computed {
		t.Fatalf("Compute should not have been called")
	}
}

func TestDecide_AllGuardsPassed_RunsComputeAndScore(t *testing.T) {
	now := time.Date(2026, 12, 15, 3, 0, 0, 0, time.UTC)
	finished := models.Session{SessionKey: 1, DateStart: time.Date(2026, 12, 7, 15, 0, 0, 0, time.UTC)}
	svc := &stubService{scoreCount: 7}
	results := &stubResults{get: nil}
	n, ran, err := scheduler.Decide(context.Background(), scheduler.Deps{
		Sessions: &stubSessions{byYear: []models.Session{finished}, countResults: map[int]int64{1: 20}},
		Results:  results,
		Service:  svc,
		Now:      fixedNow(now),
	}, 2026)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if !ran {
		t.Fatalf("expected ran=true")
	}
	if n != 7 {
		t.Fatalf("got n=%d, want 7", n)
	}
	if !svc.computed || !svc.scored {
		t.Fatalf("Compute+ScoreSeason should have been called")
	}
	if results.markedYear != 2026 {
		t.Fatalf("MarkScored should have been called with 2026; got %d", results.markedYear)
	}
}

func TestDecide_NoSessionsForYear_DoesNothing(t *testing.T) {
	now := time.Date(2099, 1, 1, 3, 0, 0, 0, time.UTC)
	svc := &stubService{}
	n, ran, err := scheduler.Decide(context.Background(), scheduler.Deps{
		Sessions: &stubSessions{},
		Results:  &stubResults{get: nil},
		Service:  svc,
		Now:      fixedNow(now),
	}, 2099)
	if err != nil || ran || n != 0 {
		t.Fatalf("got (n=%d, ran=%v, err=%v); want (0,false,nil)", n, ran, err)
	}
}
```

- [ ] **Step 3: Scheduler aus `main.go` starten**

In `../../f1-tip-game/main.go` nach dem Service-Wiring (vor dem `r.Run(...)`):

```go
import (
	// ... existing ...
	"github.com/GypsyyCode/f1-tip-game/internal/scheduler"
)

// ...

ctx := context.Background()
scheduler.Start(ctx, scheduler.Deps{
	Sessions: sessionRepo,
	Results:  seasonResultsRepo,
	Service:  seasonResultsSvc.(interface {
		Compute(context.Context, int) (*models.SeasonResults, error)
		ScoreSeason(context.Context, int) (int, error)
	}),
	Now: time.Now,
})
```

**Problem:** `SeasonResultsService` hat kein `ScoreSeason`. Lösung: Wir brauchen eine Facade, die Compute (vom SeasonResultsService) und ScoreSeason (vom scoringSvc) kombiniert.

Lege einen kleinen Adapter in `main.go` an:

```go
type seasonAutoAdapter struct {
	srs service.SeasonResultsService
	ssv *scoring.Service
}

func (a *seasonAutoAdapter) Compute(ctx context.Context, year int) (*models.SeasonResults, error) {
	return a.srs.Compute(ctx, year)
}
func (a *seasonAutoAdapter) ScoreSeason(ctx context.Context, year int) (int, error) {
	return a.ssv.ScoreSeason(ctx, year)
}

// ...
scheduler.Start(ctx, scheduler.Deps{
	Sessions: sessionRepo,
	Results:  seasonResultsRepo,
	Service:  &seasonAutoAdapter{srs: seasonResultsSvc, ssv: scoringSvc},
	Now:      time.Now,
})
```

- [ ] **Step 4: Tests ausführen**

```bash
cd ../../f1-tip-game
go test ./internal/scheduler/...
```

Expected: 5 Tests PASS.

- [ ] **Step 5: Build**

```bash
cd ../../f1-tip-game
go build ./...
```

- [ ] **Step 6: Commit**

```bash
cd ../../f1-tip-game
git add internal/scheduler/season_scheduler.go \
        internal/scheduler/season_scheduler_test.go \
        main.go
git commit -m "feat(scheduler): daily season auto-scoring with guards"
```

---

## Task 10: Backend — Full BE Verifikation + Commit-Zwischenstand

- [ ] **Step 1: Alle BE-Tests laufen**

```bash
cd ../../f1-tip-game
go test ./...
```

Expected: alles grün — insbesondere:
- `coupons/scoring/season` (12 Tests)
- `internal/service` (3 Tests)
- `internal/scheduler` (5 Tests)
- bestehende Tests (Phase 3b/4) unverändert grün.

- [ ] **Step 2: Full build**

```bash
cd ../../f1-tip-game
go build ./...
```

- [ ] **Step 3: Smoketest-Protokoll (manuell, falls DB läuft)**

```bash
# 1. Teams-Liste
curl -s http://localhost:8080/api/v1/teams | jq length
# 2. Season-start (vermutlich leer in Testdb)
curl -s "http://localhost:8080/api/v1/sessions/season-start?year=2026"
# 3. Compute (als Admin — Token nötig)
TOKEN=<admin-login-token>
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
     http://localhost:8080/api/v1/season-results/2026/compute | jq
# 4. Get
curl -s http://localhost:8080/api/v1/season-results/2026 | jq
# 5. Score
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
     http://localhost:8080/api/v1/scoring/season/2026 | jq
```

Falls Compute fehlschlägt mit „no race/sprint sessions found": DB hat keine Sessions; das ist für den Smoketest OK — Hauptziel ist „Endpoint funktioniert technisch".

- [ ] **Step 4: BE-Branch dokumentieren**

Protokolliere im lokalen Notizblock oder PR-Beschreibung: BE-Teil fertig, bereit für FE-Integration. Keine zusätzlichen Commits in diesem Task.

---

## Task 11: Frontend — Season Pinia-Store

**Files:**
- Create: `src/stores/season.ts`
- Modify: `src/plugins/startingGrid.ts` — `getSeasonStart(year)` ergänzen.

- [ ] **Step 1: `getSeasonStart`-Client im startingGrid-Plugin ergänzen**

In `src/plugins/startingGrid.ts` am Ende der Datei (nach den bestehenden Exports) hinzufügen:

```ts
/**
 * Lädt die früheste Session eines Jahres (Season-Start) für den Lock in
 * Saison-Wetten. Backend-Endpoint: GET /api/v1/sessions/season-start?year=
 */
export async function getSeasonStart (year: number): Promise<SessionInfo> {
	const res = await fetch(`${API_BASE}/api/v1/sessions/season-start?year=${year}`)
	if (!res.ok) {
		const message = await res.text().catch(() => res.statusText)
		throw new Error(`Saison-Start konnte nicht geladen werden (HTTP ${res.status}): ${message}`)
	}
	return await res.json() as SessionInfo
}
```

**Hinweis:** `API_BASE` und `SessionInfo` sind bereits in dieser Datei definiert — nicht noch mal importieren.

- [ ] **Step 2: Pinia-Store schreiben**

Create `src/stores/season.ts`:

```ts
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getSeasonStart, type SessionInfo } from '@/plugins/startingGrid'

/**
 * App-weiter Saison-Zustand: die aktuell relevante F1-Saison.
 *
 * Analog zu `useSessionStore` (Phase 1), aber auf Jahr-Ebene. Hält
 * zusätzlich die erste Session des Jahres als Lock-Grundlage für die
 * drei Saison-Wetten.
 */
export const useSeasonStore = defineStore('season', () => {
	/** Aktuelles Jahr (0 = noch nicht initialisiert). */
	const year = ref<number>(0)
	/** Erste Session des Jahres, für Lock + Banner. */
	const firstSession = ref<SessionInfo | null>(null)
	const loading = ref(false)
	const error = ref<string | null>(null)

	/** True, sobald die erste Session der Saison laut `date_start` begonnen hat. */
	const isStarted = computed(() => {
		if (!firstSession.value) return false
		const start = new Date(firstSession.value.date_start).getTime()
		return !Number.isNaN(start) && start <= Date.now()
	})

	/**
	 * Lädt die erste Session des aktuellen Jahres (UTC). Setzt `year`
	 * aus deren `date_start` ab, damit Jahreswechsel sauber abgebildet
	 * sind (keine Dezember-vs-Januar-Diskrepanz).
	 */
	async function loadCurrent () {
		loading.value = true
		error.value = null
		try {
			const session = await getSeasonStart(new Date().getUTCFullYear())
			firstSession.value = session
			year.value = new Date(session.date_start).getUTCFullYear()
		} catch (e) {
			error.value = e instanceof Error ? e.message : String(e)
			// Fallback: aktuelles UTC-Jahr, damit UI nicht komplett blockt.
			if (year.value === 0) year.value = new Date().getUTCFullYear()
		} finally {
			loading.value = false
		}
	}

	return { year, firstSession, loading, error, isStarted, loadCurrent }
})
```

- [ ] **Step 3: Type-Check**

```bash
npm run type-check
```

Expected: keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/stores/season.ts src/plugins/startingGrid.ts
git commit -m "feat(season): shared season store + getSeasonStart"
```

---

## Task 12: Frontend — API-Clients (`src/plugins/season.ts`)

**Files:**
- Create: `src/plugins/season.ts`

- [ ] **Step 1: Client schreiben**

Create `src/plugins/season.ts`:

```ts
/**
 * API-Clients für Saison-Standings + Saison-Scoring + Teams.
 * Pattern wie src/plugins/scores.ts (snake_case für Backend-JSON,
 * camelCase bei Function-Params).
 */

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

export type SeasonResults = {
	season_year: number
	driver_standings: number[]           // DriverNumbers
	constructor_standings: number[]      // Team-IDs
	computed_at?: string
	overridden_at?: string
	scored_at?: string
}

export type SeasonResultsPayload = {
	driver_standings: number[]
	constructor_standings: number[]
}

export type Team = {
	id: number
	team_name: string
	team_colour?: string
	season?: number
}

export type ScoringResult = {
	season_year: number
	scored_coupons: number
}

export async function getSeasonResults (year: number): Promise<SeasonResults | null> {
	const res = await fetch(`${API_BASE}/api/v1/season-results/${year}`)
	if (res.status === 404) return null
	if (!res.ok) {
		const message = await res.text().catch(() => res.statusText)
		throw new Error(`Saison-Standings konnten nicht geladen werden (HTTP ${res.status}): ${message}`)
	}
	return await res.json() as SeasonResults
}

export async function computeSeasonResults (year: number, token: string): Promise<SeasonResults> {
	const res = await fetch(`${API_BASE}/api/v1/season-results/${year}/compute`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}` },
	})
	if (!res.ok) {
		const message = await res.text().catch(() => res.statusText)
		throw new Error(`Compute fehlgeschlagen (HTTP ${res.status}): ${message}`)
	}
	return await res.json() as SeasonResults
}

export async function overrideSeasonResults (
	year: number,
	body: SeasonResultsPayload,
	token: string,
): Promise<SeasonResults> {
	const res = await fetch(`${API_BASE}/api/v1/season-results/${year}`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify(body),
	})
	if (!res.ok) {
		const message = await res.text().catch(() => res.statusText)
		throw new Error(`Override fehlgeschlagen (HTTP ${res.status}): ${message}`)
	}
	return await res.json() as SeasonResults
}

export async function triggerSeasonScoring (year: number, token: string): Promise<ScoringResult> {
	const res = await fetch(`${API_BASE}/api/v1/scoring/season/${year}`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}` },
	})
	if (!res.ok) {
		const message = await res.text().catch(() => res.statusText)
		throw new Error(`Scoring fehlgeschlagen (HTTP ${res.status}): ${message}`)
	}
	return await res.json() as ScoringResult
}

export async function listTeams (): Promise<Team[]> {
	const res = await fetch(`${API_BASE}/api/v1/teams`)
	if (!res.ok) {
		const message = await res.text().catch(() => res.statusText)
		throw new Error(`Teams konnten nicht geladen werden (HTTP ${res.status}): ${message}`)
	}
	return await res.json() as Team[]
}
```

- [ ] **Step 2: Type-Check**

```bash
npm run type-check
```

- [ ] **Step 3: Commit**

```bash
git add src/plugins/season.ts
git commit -m "feat(season): API client for season results, scoring, teams"
```

---

## Task 13: Frontend — `useCoupon` + `CouponContext` erweitern

**Files:**
- Modify: `src/plugins/coupon.ts`
- Modify: `src/plugins/coupons/useCoupon.ts`

- [ ] **Step 1: `CouponContext.seasonYear` ergänzen**

In `src/plugins/coupon.ts` den `CouponContext`-Typ erweitern:

Alt:
```ts
export type CouponContext = {
	sessionKey?: number
}
```

Neu:
```ts
export type CouponContext = {
	sessionKey?: number
	seasonYear?: number
}
```

- [ ] **Step 2: `useCoupon` um 5. Parameter erweitern**

In `src/plugins/coupons/useCoupon.ts`:

Alt (Signatur):
```ts
export function useCoupon<TData extends object> (
	betType: BetType,
	initialPicks: PodiumDriver[],
	buildCoupon: CouponBuilder<TData>,
	getSessionKey?: () => number | undefined,
) {
```

Neu:
```ts
export function useCoupon<TData extends object> (
	betType: BetType,
	initialPicks: PodiumDriver[],
	buildCoupon: CouponBuilder<TData>,
	getSessionKey?: () => number | undefined,
	getSeasonYear?: () => number | undefined,
) {
```

Im `submit`-Call-Site wird der Builder-Aufruf angepasst (nach `sessionKey`-Line):

Alt:
```ts
			const coupon = buildCoupon(
				picks.value.map((d, i) => ({ driver_id: d.driver_id, position: i + 1 })),
				{ sessionKey: getSessionKey?.() },
			)
```

Neu:
```ts
			const coupon = buildCoupon(
				picks.value.map((d, i) => ({ driver_id: d.driver_id, position: i + 1 })),
				{ sessionKey: getSessionKey?.(), seasonYear: getSeasonYear?.() },
			)
```

- [ ] **Step 3: Type-Check**

```bash
npm run type-check
```

- [ ] **Step 4: Commit**

```bash
git add src/plugins/coupon.ts src/plugins/coupons/useCoupon.ts
git commit -m "feat(coupons): seasonYear in CouponContext + useCoupon getter"
```

---

## Task 14: Frontend — `teamDuell` + `driverChampionship` Schema/Composable-Updates

**Files:**
- Modify: `src/plugins/coupons/teamDuell.ts`
- Modify: `src/plugins/coupons/useTeamDuell.ts`
- Modify: `src/plugins/coupons/driverChampionship.ts`
- Modify: `src/plugins/coupons/useDriverChampionship.ts`

- [ ] **Step 1: `teamDuell.ts` auf `ctx` + `season_year` umstellen**

Ersetze den Inhalt von `src/plugins/coupons/teamDuell.ts`:

```ts
import type { Coupon, CouponContext, Placement } from '../coupon'

/** Schema-Daten der "Team Duell Wette" (genau 2 Platzierungen). */
export type TeamDuellData = {
	placements: Placement[]
	/** Saisonjahr; wird vom Season-Store gefüttert. Backend ignoriert ohne. */
	season_year?: number
}

/**
 * Baut eine "Team Duell Wette".
 *
 * Backend-Package liegt in `team`, Kategorie ist aber `Season` (Route
 * `/api/v1/coupons/season/teamDuell`) — kein Tippfehler. Mit `ctx.seasonYear`
 * wird `season_year` ins Schema geschrieben, Pflicht für Season-Scoring.
 */
export default function createTeamDuellCoupon (
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

- [ ] **Step 2: `useTeamDuell.ts` an Season-Store koppeln**

Ersetze `src/plugins/coupons/useTeamDuell.ts`:

```ts
import { useSeasonStore } from '@/stores/season'
import createTeamDuellCoupon from './teamDuell'
import type { PodiumDriver } from './types'
import { useCoupon } from './useCoupon'

/**
 * Komponisable für die Team-Duell-Wette: zwei Picks (Sieger auf Position 1,
 * Verlierer auf Position 2 des Duells). State liegt im Pinia-Store und wird
 * in IndexedDB persistiert. `season_year` wird aus dem Season-Store gefüttert.
 */
export function useTeamDuell (initialPicks: [PodiumDriver, PodiumDriver]) {
	const season = useSeasonStore()
	const { picks, submitting, error, createdId, placedAt, submit, swapPicks, reset }
		= useCoupon(
			'teamDuell',
			initialPicks,
			createTeamDuellCoupon,
			undefined,
			() => season.year || undefined,
		)

	return { picks, submitting, error, createdId, placedAt, submit, swapPicks, reset }
}
```

- [ ] **Step 3: `driverChampionship.ts` analog**

Ersetze `src/plugins/coupons/driverChampionship.ts`:

```ts
import type { Coupon, CouponContext, Placement } from '../coupon'

/**
 * Schema-Daten der "Fahrer Championship Wette".
 *
 * Backend-Schema trägt den JSON-Tag `placement` (Singular). `season_year`
 * wird vom Season-Store gefüttert (für Scoring am Saisonende).
 */
export type DriverChampionshipData = {
	placement: Placement
	season_year?: number
}

export default function createDriverChampionshipCoupon (
	placements: Placement[],
	ctx: CouponContext = {},
): Coupon<DriverChampionshipData> {
	const [placement] = placements
	if (!placement) {
		throw new Error('Fahrer Championship Wette benötigt genau eine Platzierung.')
	}
	return {
		name: 'Fahrer Championship Wette',
		category: 'season',
		schemaName: 'driverChampionshipRank',
		data: {
			placement,
			...(ctx.seasonYear ? { season_year: ctx.seasonYear } : {}),
		},
	}
}
```

- [ ] **Step 4: `useDriverChampionship.ts` analog**

Ersetze `src/plugins/coupons/useDriverChampionship.ts`:

```ts
import { useSeasonStore } from '@/stores/season'
import createDriverChampionshipCoupon from './driverChampionship'
import type { PodiumDriver } from './types'
import { useCoupon } from './useCoupon'

export function useDriverChampionship (initialPick: PodiumDriver) {
	const season = useSeasonStore()
	const { picks, submitting, error, createdId, placedAt, submit, swapPicks, reset }
		= useCoupon(
			'driverChampionship',
			[initialPick],
			createDriverChampionshipCoupon,
			undefined,
			() => season.year || undefined,
		)
	return { picks, submitting, error, createdId, placedAt, submit, swapPicks, reset }
}
```

- [ ] **Step 5: Type-Check**

```bash
npm run type-check
```

- [ ] **Step 6: Commit**

```bash
git add src/plugins/coupons/teamDuell.ts \
        src/plugins/coupons/useTeamDuell.ts \
        src/plugins/coupons/driverChampionship.ts \
        src/plugins/coupons/useDriverChampionship.ts
git commit -m "feat(season-bets): thread season_year into teamDuell + driverChampionship"
```

---

## Task 15: Frontend — `constructorChampionship` auf Team-Picker umstellen

**Files:**
- Modify: `src/plugins/coupons/constructorChampionship.ts`
- Modify: `src/plugins/coupons/useConstructorChampionship.ts`
- Modify: `src/plugins/coupons/types.ts` (optional: `TeamPick`-Typ ergänzen)
- Modify: `src/pages/constructorChampionship.vue`

- [ ] **Step 1: `TeamPick`-Typ ergänzen**

In `src/plugins/coupons/types.ts` einen neuen Export ergänzen (nach `PodiumDriver`):

```ts
/** Team-Pick für die Konstrukteurs-Championship. */
export type TeamPick = {
	team_id: number
	name: string
}
```

- [ ] **Step 2: `constructorChampionship.ts` umstellen**

Ersetze `src/plugins/coupons/constructorChampionship.ts`:

```ts
import type { Coupon, CouponContext } from '../coupon'

/**
 * Schema-Daten der "Constructor Championship Wette".
 *
 * Backend-Schema (neu, mit Team-ID): placement.team_id = Team-ID,
 * placement.position = getippter WM-Rang.
 */
export type ConstructorChampionshipData = {
	placement: {
		team_id: number
		position: number
	}
	season_year?: number
}

export default function createConstructorChampionshipCoupon (
	teamId: number,
	rank: number,
	ctx: CouponContext = {},
): Coupon<ConstructorChampionshipData> {
	return {
		name: 'Constructor Championship Wette',
		category: 'season',
		schemaName: 'constructorChampionshipRank',
		data: {
			placement: { team_id: teamId, position: rank },
			...(ctx.seasonYear ? { season_year: ctx.seasonYear } : {}),
		},
	}
}
```

**Breaking Change:** Die Signatur `(placements: Placement[]) => Coupon` ist nicht mehr identisch mit den anderen. `useConstructorChampionship` muss `useCoupon` **nicht** benutzen (oder einen angepassten Builder-Wrapper). Siehe nächster Step.

- [ ] **Step 3: `useConstructorChampionship.ts` umbauen (eigener Submit-Flow)**

Ersetze `src/plugins/coupons/useConstructorChampionship.ts`:

```ts
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSeasonStore } from '@/stores/season'
import { create } from '../coupon'
import createConstructorChampionshipCoupon, { type ConstructorChampionshipData } from './constructorChampionship'
import type { TeamPick } from './types'

/**
 * Konstrukteurs-Championship: Nutzer wählt genau ein Team + Rang-Tipp.
 * Eigener (nicht generischer) Submit-Flow, weil die Datenform (team_id,
 * position) nicht in das `Placement`-Schema der anderen Coupons passt.
 */
export function useConstructorChampionship (initialPick: TeamPick, initialRank = 1) {
	const auth = useAuthStore()
	const season = useSeasonStore()

	const pick = ref<TeamPick>(initialPick)
	const rank = ref<number>(initialRank)
	const submitting = ref(false)
	const error = ref<string | null>(null)
	const createdId = ref<string | null>(null)
	const placedAt = ref<string | null>(null)

	async function submit () {
		submitting.value = true
		error.value = null
		try {
			const coupon = createConstructorChampionshipCoupon(
				pick.value.team_id,
				rank.value,
				{ seasonYear: season.year || undefined },
			)
			const created = await create<ConstructorChampionshipData>(coupon, auth.token ?? undefined)
			createdId.value = created.id
			placedAt.value = new Date().toISOString()
		} catch (e) {
			error.value = e instanceof Error ? e.message : String(e)
		} finally {
			submitting.value = false
		}
	}

	function reset () {
		createdId.value = null
		placedAt.value = null
		error.value = null
	}

	return { pick, rank, submitting, error, createdId, placedAt, submit, reset }
}
```

- [ ] **Step 4: `constructorChampionship.vue` auf Team-Picker + Rank-Input umbauen**

Ersetze `src/pages/constructorChampionship.vue`:

```vue
<template>
	<v-card v-if="!createdId" class="custom-height py-3 rounded-3xl" rounded="3xl" variant="flat">
		<div v-if="firstSession" class="px-4 pt-4">
			<div class="text-[10px] tracking-[0.3em] text-neutral-500">TIPP FÜR SAISON</div>
			<div class="text-sm">
				<strong>{{ year }}</strong>
				<span class="text-neutral-500"> · Start am {{ formatDate(firstSession.date_start) }}</span>
			</div>
		</div>

		<v-alert v-if="isStarted" type="warning" variant="tonal" class="mx-4 mt-3">
			Die Saison hat bereits begonnen – ein Tipp ist nicht mehr möglich.
		</v-alert>

		<div class="px-4 mt-3">
			<v-select
				v-model="pick"
				:items="teams"
				:item-title="(t: Team) => t.team_name"
				:item-value="(t: Team) => ({ team_id: t.id, name: t.team_name })"
				label="Team"
				variant="outlined"
				return-object
				:disabled="isStarted || submitting"
			/>
			<v-text-field
				v-model.number="rank"
				type="number"
				min="1"
				max="20"
				label="WM-Rang (1 = Weltmeister)"
				variant="outlined"
				:disabled="isStarted || submitting"
			/>
		</div>

		<v-card-actions class="justify-end">
			<v-btn
				class="bg-taupe-500 text-taupe-100"
				:loading="submitting"
				:disabled="submitting || isStarted || !pick"
				color="primary"
				@click="submit"
			>
				Wette abschließen
			</v-btn>
		</v-card-actions>

		<v-alert v-if="error" type="error" class="mt-3">{{ error }}</v-alert>
	</v-card>

	<v-card v-else class="custom-height py-3 rounded-3xl text-center" rounded="3xl" variant="flat">
		<div class="text-sm text-neutral-500">Wette platziert · {{ placedAt }}</div>
		<div class="text-xs">ID: {{ createdId }}</div>
		<v-btn variant="plain" @click="reset">Neue Wette</v-btn>
	</v-card>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted, ref } from 'vue'
import { listTeams, type Team } from '@/plugins/season'
import { useConstructorChampionship } from '@/plugins/coupons/useConstructorChampionship'
import { useSeasonStore } from '@/stores/season'

const seasonStore = useSeasonStore()
const { year, firstSession, isStarted } = storeToRefs(seasonStore)

const { pick, rank, submitting, error, createdId, placedAt, submit, reset } = useConstructorChampionship(
	{ team_id: 0, name: '' },
	1,
)

const teams = ref<Team[]>([])

onMounted(async () => {
	await seasonStore.loadCurrent()
	teams.value = await listTeams()
	// Default-Pick auf erstes Team, falls Benutzer noch nichts gewählt hat.
	if (pick.value.team_id === 0 && teams.value.length > 0) {
		pick.value = { team_id: teams.value[0].id, name: teams.value[0].team_name }
	}
})

function formatDate (iso: string): string {
	return new Date(iso).toLocaleDateString('de-DE', {
		day: '2-digit', month: '2-digit', year: 'numeric',
	})
}
</script>
```

- [ ] **Step 5: Type-Check**

```bash
npm run type-check
```

Expected: keine Fehler. Falls `storeToRefs` auf `pick`/`rank` meckert (die kommen aus `useConstructorChampionship`, nicht aus Pinia): nicht in `storeToRefs` werfen — bereits direkt destrukturiert.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/coupons/constructorChampionship.ts \
        src/plugins/coupons/useConstructorChampionship.ts \
        src/plugins/coupons/types.ts \
        src/pages/constructorChampionship.vue
git commit -m "feat(constructor-championship): team picker + rank input (team_id schema)"
```

---

## Task 16: Frontend — `teamDuell` + `driverChampionship` Pages mit Banner + Lock

**Files:**
- Modify: `src/pages/teamDuell.vue`
- Modify: `src/pages/driverChampionship.vue`

- [ ] **Step 1: `teamDuell.vue` erweitern**

Ersetze `src/pages/teamDuell.vue`:

```vue
<template>
	<BetCard
		name="Team Duell Wette"
		:picks="picks"
		subtitle="Dein Tipp: Sieger und Verlierer des Team-Duells"
		:colors="['#FFD700', '#C0C0C0']"
		:submitting="submitting"
		:error="error"
		:created-id="createdId"
		:placed-at="placedAt"
		:session="firstSession"
		:locked="isStarted"
		@submit="submit"
		@reorder="({ from, to }) => swapPicks(from, to)"
	/>
</template>

<script setup lang="ts">
	import { storeToRefs } from 'pinia'
	import { onMounted } from 'vue'
	import BetCard from '@/components/bet-card/bet-card.vue'
	import { useTeamDuell } from '@/plugins/coupons/useTeamDuell'
	import { useSeasonStore } from '@/stores/season'

	const seasonStore = useSeasonStore()
	const { firstSession, isStarted } = storeToRefs(seasonStore)
	onMounted(() => seasonStore.loadCurrent())

	const { picks, submitting, error, createdId, placedAt, submit, swapPicks } = useTeamDuell([
		{ driver_id: 1, name: 'Max Verstappen' },
		{ driver_id: 11, name: 'Sergio Pérez' },
	])
</script>
```

- [ ] **Step 2: `driverChampionship.vue` erweitern**

Ersetze `src/pages/driverChampionship.vue`:

```vue
<template>
	<BetCard
		name="Fahrer Championship Wette"
		:picks="picks"
		subtitle="Dein Tipp auf den Fahrer-Weltmeister"
		:colors="['#FFD700']"
		:submitting="submitting"
		:error="error"
		:created-id="createdId"
		:placed-at="placedAt"
		:session="firstSession"
		:locked="isStarted"
		@submit="submit"
	/>
</template>

<script setup lang="ts">
	import { storeToRefs } from 'pinia'
	import { onMounted } from 'vue'
	import BetCard from '@/components/bet-card/bet-card.vue'
	import { useDriverChampionship } from '@/plugins/coupons/useDriverChampionship'
	import { useSeasonStore } from '@/stores/season'

	const seasonStore = useSeasonStore()
	const { firstSession, isStarted } = storeToRefs(seasonStore)
	onMounted(() => seasonStore.loadCurrent())

	const { picks, submitting, error, createdId, placedAt, submit } = useDriverChampionship(
		{ driver_id: 1, name: 'Max Verstappen' },
	)
</script>
```

- [ ] **Step 3: Type-Check**

```bash
npm run type-check
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/teamDuell.vue src/pages/driverChampionship.vue
git commit -m "feat(season-bets): season banner + lock on teamDuell + driverChampionship pages"
```

---

## Task 17: Frontend — Admin-Section auf `/punkteliste` (Compute + Edit + Score)

**Files:**
- Modify: `src/pages/punkteliste.vue`

Diese Section wird additiv unterhalb der bestehenden Phase-3b/4-Admin-Controls eingefügt.

- [ ] **Step 1: Admin-Section in `/punkteliste` einfügen**

Öffne `src/pages/punkteliste.vue`. Füge am Ende des `<template>` (vor dem schließenden Wrapper-Element) eine neue Admin-Section ein:

```vue
<v-card
	v-if="auth.player?.role === 'admin'"
	class="custom-height py-3 rounded-3xl mt-6"
	rounded="3xl"
	variant="flat"
>
	<div class="px-4 pt-2">
		<div class="text-[10px] tracking-[0.3em] text-neutral-500">ADMIN · SAISON-SCORING</div>
		<div class="text-sm">Saison <strong>{{ seasonStore.year }}</strong></div>
	</div>

	<div class="px-4 mt-3 flex items-center gap-3">
		<v-btn
			variant="tonal"
			:loading="seasonBusy"
			:disabled="seasonBusy"
			@click="onCompute"
		>
			Standings berechnen
		</v-btn>
		<span v-if="seasonResults?.computed_at" class="text-xs text-neutral-500">
			Zuletzt berechnet: {{ formatDate(seasonResults.computed_at) }}
		</span>
	</div>

	<div v-if="seasonResults" class="px-4 mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
		<div>
			<div class="text-xs tracking-widest text-neutral-500 mb-1">FAHRER-WM</div>
			<v-list density="compact">
				<v-list-item
					v-for="(driverNumber, idx) in draftDrivers"
					:key="`drv-${driverNumber}`"
					:title="`${idx + 1}. #${driverNumber} ${driverNameOf(driverNumber)}`"
				>
					<template #append>
						<v-btn icon="mdi-arrow-up" variant="text" size="x-small" :disabled="idx === 0" @click="moveDriver(idx, -1)" />
						<v-btn icon="mdi-arrow-down" variant="text" size="x-small" :disabled="idx === draftDrivers.length - 1" @click="moveDriver(idx, 1)" />
					</template>
				</v-list-item>
			</v-list>
		</div>
		<div>
			<div class="text-xs tracking-widest text-neutral-500 mb-1">KONSTRUKTEURS-WM</div>
			<v-list density="compact">
				<v-list-item
					v-for="(teamId, idx) in draftConstructors"
					:key="`cst-${teamId}`"
					:title="`${idx + 1}. ${teamNameOf(teamId)}`"
				>
					<template #append>
						<v-btn icon="mdi-arrow-up" variant="text" size="x-small" :disabled="idx === 0" @click="moveTeam(idx, -1)" />
						<v-btn icon="mdi-arrow-down" variant="text" size="x-small" :disabled="idx === draftConstructors.length - 1" @click="moveTeam(idx, 1)" />
					</template>
				</v-list-item>
			</v-list>
		</div>
	</div>

	<div v-if="seasonResults" class="px-4 mt-3 flex items-center gap-3">
		<v-btn variant="plain" :disabled="seasonBusy || !draftDirty" @click="onResetDraft">Reset</v-btn>
		<v-btn variant="tonal" :loading="seasonBusy" :disabled="seasonBusy || !draftDirty" @click="onSaveOverride">
			Overrides speichern
		</v-btn>
		<span v-if="seasonResults.overridden_at" class="text-xs text-neutral-500">
			Zuletzt overridden: {{ formatDate(seasonResults.overridden_at) }}
		</span>
	</div>

	<div class="px-4 mt-4 flex items-center gap-3">
		<v-btn
			color="primary"
			class="bg-taupe-500 text-taupe-100"
			:loading="seasonBusy"
			:disabled="seasonBusy || !seasonResults"
			@click="onScore"
		>
			{{ seasonResults?.scored_at ? 'Saison-Scoring erneut auslösen' : 'Saison-Scoring auslösen' }}
		</v-btn>
		<span v-if="seasonResults?.scored_at" class="text-xs text-neutral-500">
			Zuletzt gescored: {{ formatDate(seasonResults.scored_at) }}
		</span>
	</div>

	<v-alert v-if="seasonError" type="error" class="mt-3 mx-4">{{ seasonError }}</v-alert>
	<v-alert v-if="seasonInfo" type="success" class="mt-3 mx-4">{{ seasonInfo }}</v-alert>
</v-card>
```

- [ ] **Step 2: `<script setup>` erweitern**

Innerhalb des bestehenden `<script setup lang="ts">`-Blocks ergänzen (nach den bestehenden Imports und State):

```ts
import { computed, ref, watch } from 'vue'
import {
	computeSeasonResults,
	getSeasonResults,
	listTeams,
	overrideSeasonResults,
	triggerSeasonScoring,
	type SeasonResults,
	type Team,
} from '@/plugins/season'
import { listDrivers, type DriverInfo } from '@/plugins/drivers'
import { useSeasonStore } from '@/stores/season'

const seasonStore = useSeasonStore()
const seasonResults = ref<SeasonResults | null>(null)
const draftDrivers = ref<number[]>([])
const draftConstructors = ref<number[]>([])
const teams = ref<Team[]>([])
const drivers = ref<DriverInfo[]>([])
const seasonBusy = ref(false)
const seasonError = ref<string | null>(null)
const seasonInfo = ref<string | null>(null)

const draftDirty = computed(() => {
	if (!seasonResults.value) return false
	const a = seasonResults.value.driver_standings
	const b = seasonResults.value.constructor_standings
	if (draftDrivers.value.length !== a.length || draftConstructors.value.length !== b.length) return true
	return draftDrivers.value.some((d, i) => d !== a[i])
		|| draftConstructors.value.some((c, i) => c !== b[i])
})

async function loadSeason () {
	seasonError.value = null
	await seasonStore.loadCurrent()
	const [sr, tm, dr] = await Promise.all([
		getSeasonResults(seasonStore.year),
		listTeams(),
		listDrivers(),
	])
	teams.value = tm
	drivers.value = dr
	seasonResults.value = sr
	draftDrivers.value = sr ? [...sr.driver_standings] : []
	draftConstructors.value = sr ? [...sr.constructor_standings] : []
}

onMounted(loadSeason)

watch(() => auth.token, () => { seasonInfo.value = null; seasonError.value = null })

function driverNameOf (driverNumber: number): string {
	const d = drivers.value.find(x => x.driver_number === driverNumber)
	return d ? `${d.first_name} ${d.last_name}` : `Fahrer #${driverNumber}`
}
function teamNameOf (teamId: number): string {
	const t = teams.value.find(x => x.id === teamId)
	return t ? t.team_name : `Team #${teamId}`
}
function moveDriver (idx: number, delta: number) {
	const target = idx + delta
	if (target < 0 || target >= draftDrivers.value.length) return
	const next = [...draftDrivers.value]
	;[next[idx], next[target]] = [next[target], next[idx]]
	draftDrivers.value = next
}
function moveTeam (idx: number, delta: number) {
	const target = idx + delta
	if (target < 0 || target >= draftConstructors.value.length) return
	const next = [...draftConstructors.value]
	;[next[idx], next[target]] = [next[target], next[idx]]
	draftConstructors.value = next
}
function onResetDraft () {
	if (!seasonResults.value) return
	draftDrivers.value = [...seasonResults.value.driver_standings]
	draftConstructors.value = [...seasonResults.value.constructor_standings]
}

async function onCompute () {
	if (!auth.token) return
	seasonBusy.value = true
	seasonError.value = null
	seasonInfo.value = null
	try {
		const sr = await computeSeasonResults(seasonStore.year, auth.token)
		seasonResults.value = sr
		draftDrivers.value = [...sr.driver_standings]
		draftConstructors.value = [...sr.constructor_standings]
		seasonInfo.value = `Standings für ${sr.season_year} berechnet (${sr.driver_standings.length} Fahrer, ${sr.constructor_standings.length} Teams).`
	} catch (e) {
		seasonError.value = e instanceof Error ? e.message : String(e)
	} finally {
		seasonBusy.value = false
	}
}

async function onSaveOverride () {
	if (!auth.token) return
	seasonBusy.value = true
	seasonError.value = null
	seasonInfo.value = null
	try {
		const sr = await overrideSeasonResults(seasonStore.year, {
			driver_standings: draftDrivers.value,
			constructor_standings: draftConstructors.value,
		}, auth.token)
		seasonResults.value = sr
		seasonInfo.value = 'Overrides gespeichert.'
	} catch (e) {
		seasonError.value = e instanceof Error ? e.message : String(e)
	} finally {
		seasonBusy.value = false
	}
}

async function onScore () {
	if (!auth.token) return
	seasonBusy.value = true
	seasonError.value = null
	seasonInfo.value = null
	try {
		const res = await triggerSeasonScoring(seasonStore.year, auth.token)
		seasonInfo.value = `${res.scored_coupons} Season-Coupons gescored für ${res.season_year}.`
		// Punkteliste neu laden (bestehende load()-Funktion):
		await load()
		// Season-Results neu lesen für scored_at-Statuszeile:
		seasonResults.value = await getSeasonResults(seasonStore.year)
	} catch (e) {
		seasonError.value = e instanceof Error ? e.message : String(e)
	} finally {
		seasonBusy.value = false
	}
}

function formatDate (iso?: string): string {
	if (!iso) return ''
	return new Date(iso).toLocaleString('de-DE')
}
```

**Hinweis:** `auth` und `load` sind bereits im bestehenden `<script setup>` (Phase 3b). Nicht duplizieren. Falls `onMounted` schon einen Call hat, zusätzlich `loadSeason()` aufrufen oder im existierenden `onMounted` ergänzen.

- [ ] **Step 3: Type-Check**

```bash
npm run type-check
```

Expected: keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/pages/punkteliste.vue
git commit -m "feat(punkteliste): admin controls for season scoring (compute/override/score)"
```

---

## Task 18: End-to-End-Verifikation + Spec/Design-Doc-Update

- [ ] **Step 1: BE komplett grün**

```bash
cd ../../f1-tip-game
go test ./...
go build ./...
```

Expected: alles grün.

- [ ] **Step 2: FE Type-Check**

```bash
cd ../f1ontend
npm run type-check
```

- [ ] **Step 3: Manuelles QA**

Start FE + BE lokal.

- `/teamDuell`, `/driverChampionship`:
  - Banner „TIPP FÜR SAISON · 2026 · Start am DD.MM.YYYY" sichtbar.
  - DevTools-Network: POST-Body enthält `season_year: 2026`.
  - Wenn `date_start` der ersten Session in der Vergangenheit liegt: Warnung + Button disabled.
- `/constructorChampionship`:
  - Team-Dropdown zeigt 10 Teams aus `GET /api/v1/teams`.
  - Rank-Input akzeptiert 1–20.
  - POST-Body: `{ placement: { team_id, position }, season_year }`.
- `/punkteliste` als Admin:
  - Admin-Section sichtbar unterhalb der Phase-3b/4-Controls.
  - Compute-Button lädt Standings; beide Listen zeigen Rang + Fahrername bzw. Teamname.
  - Pfeile verschieben Einträge; Reset setzt zurück; Overrides speichern persistiert.
  - Scoring-Button zeigt Erfolgs-Toast mit Anzahl; Punkteliste wird refreshed; `scored_at` wird gesetzt und Button-Label wechselt zu „erneut auslösen".
- Als Nicht-Admin: Section ist unsichtbar.

- [ ] **Step 4: End-to-End-Walkthrough**

1. Als User A einen `teamDuell`-Tipp abgeben (noch vor Saisonstart der Testdaten).
2. Als Admin auf `/punkteliste`: Compute → Override → Scoring auslösen.
3. Prüfe, dass User A in der Punkteliste 0 oder 3 Pkt (je nach Pick) hat.

- [ ] **Step 5: Spec aktualisieren**

In `docs/superpowers/specs/2026-10-24-saison-wetten-scoring-design.md` am Ende einen Status-Block ergänzen:

```
> Status: **umgesetzt** gemäß `docs/superpowers/plans/2026-10-24-saison-wetten-scoring.md`.
```

- [ ] **Step 6: Phase 4-Plan aktualisieren**

In `docs/superpowers/plans/2026-10-23-phase4-remaining-race-scorings.md` den Abschnitt „Offene Punkte" aktualisieren: Saison-Wetten als umgesetzt markieren.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/specs/2026-10-24-saison-wetten-scoring-design.md \
        docs/superpowers/plans/2026-10-23-phase4-remaining-race-scorings.md
git commit -m "docs(plans): mark Saison-Wetten-Scoring complete"
```

---

## Offene Punkte (nicht Teil dieser Phase)

- **Transparenz-Seite für Saison-Standings:** eine öffentliche `/standings`-Seite, nicht nur Admin.
- **Multi-Season im Dropdown:** erst sinnvoll, wenn historische Saisons gescored sind.
- **FIA-Tie-Break:** aktuell lexikografisch bei Punktgleichheit. Für realistisches Scoring: Siege / zweite Plätze / … in abnehmender Reihenfolge.
- **Scheduler-Resilienz:** aktuell einfache Goroutine im Main-Prozess. Server-Restart um 2:59 UTC bedeutet maximal 24h Verzögerung. Akzeptabel; alternativ `robfig/cron` oder externe Scheduler-Lösung.
- **Scoring-Transaktion:** gleicher offene Punkt wie Phase 3b, nicht adressiert.
- **Benachrichtigung an Spieler nach Scoring:** nicht Scope.
