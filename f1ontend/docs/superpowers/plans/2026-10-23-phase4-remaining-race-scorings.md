# Phase 4: Scoring für Pole / FastestLap / FirstDnf / DriverOfTheDay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die vier verbleibenden Renn-Wettarten (`polePosition`, `fastestLap`, `firstDnf`, `driverOfTheDay`) im Backend tatsächlich bepunkten und einen Admin-Weg bauen, um die dafür nötigen Session-Aggregate zu berechnen bzw. (für DotD) manuell zu setzen.

**Architecture:** Eine neue Tabelle `session_aggregates` hält pro `session_key` vier `*int`-Felder: `pole_driver_number`, `fastest_lap_driver_number`, `first_dnf_driver_number`, `driver_of_the_day_driver_number`. Pole kommt aus der bestehenden `StartingGrid` (Position == 1). FastestLap und FirstDnf werden aus OpenF1 `GetLaps` + `models.Result` berechnet. DriverOfTheDay bleibt manueller Admin-Input (OpenF1 liefert's nicht). Ein neuer Admin-Endpoint `POST /api/v1/aggregates/:sessionKey/compute` befüllt die drei automatischen Felder; ein zweiter `PUT /api/v1/aggregates/:sessionKey/driver-of-the-day` setzt DotD. Der `scoreOne`-Dispatcher aus Phase 3b lädt die Aggregate und ruft vier neue Pure Functions (`ScorePole`, `ScoreFastestLap`, `ScoreFirstDnf`, `ScoreDriverOfTheDay`) auf — Treffer = 3 Punkte, sonst 0. Frontend bekommt zwei weitere Admin-Buttons auf `/punkteliste` + ein kleines DotD-Picker-Dialog.

**Tech Stack:** Go (Gin, GORM, Postgres) im Backend-Repo `/home/fabi/projects/f1-tip-game`. Vue 3 + Pinia + Vuetify 3 + TypeScript im Frontend-Repo `/home/fabi/projects/f1ontend/f1ontend`. Backend-Tests mit `go test`; FE verifiziert über `npm run type-check` + Browser.

> **WICHTIG – Code-Stil:** FE-Repo nutzt **TABs**. Niemals `npm run lint`/`:fix` laufen lassen (Config erwartet 2-Space, würde repo-weit umformatieren). Einziges FE-Gate: `npm run type-check`.

---

## File Structure

**Backend (`/home/fabi/projects/f1-tip-game`):**
- Create: `internal/models/session_aggregates.go` — neue Tabelle (ein Row je `session_key`).
- Modify: `main.go` — `AutoMigrate` um `SessionAggregates` erweitern.
- Create: `internal/repository/aggregates_repository.go` — CRUD für `SessionAggregates`.
- Create: `coupons/scoring/aggregates/fastest_lap.go` — reine Funktion `FastestLapDriver([]openf1.Lap) *int`.
- Create: `coupons/scoring/aggregates/fastest_lap_test.go` — Unit-Tests.
- Create: `coupons/scoring/aggregates/first_dnf.go` — reine Funktion `FirstDnfDriver([]models.Result, []openf1.Lap) *int`.
- Create: `coupons/scoring/aggregates/first_dnf_test.go` — Unit-Tests.
- Create: `internal/service/aggregates_service.go` — orchestriert pole/fastestLap/firstDnf (lädt Daten + ruft reine Funktionen auf, persistiert).
- Create: `internal/handler/aggregates_handler.go` — zwei Admin-Routes (`compute` + `set-dotd`), ein Public-GET.
- Modify: `internal/router/router.go` — Handler verdrahten.
- Modify: `main.go` — Service + Handler instanziieren.
- Create: `coupons/scoring/race_singles.go` — vier Pure Functions `ScorePole`, `ScoreFastestLap`, `ScoreFirstDnf`, `ScoreDriverOfTheDay`.
- Create: `coupons/scoring/race_singles_test.go` — Unit-Tests.
- Modify: `coupons/scoring/service.go` — `scoreOne`-Dispatcher: Aggregate laden, vier neue Cases, Funktionen aufrufen.

**Frontend (`/home/fabi/projects/f1ontend/f1ontend`):**
- Modify: `src/plugins/scores.ts` — Clients `computeAggregates(sessionKey, token)` + `setDriverOfTheDay(sessionKey, driverNumber, token)` + `getAggregates(sessionKey)`.
- Modify: `src/pages/punkteliste.vue` — Admin-Panel um zwei neue Buttons + DotD-Picker.

---

### Task 1: Backend — `SessionAggregates` Model + Migration

**Files:**
- Create: `/home/fabi/projects/f1-tip-game/internal/models/session_aggregates.go`
- Modify: `/home/fabi/projects/f1-tip-game/main.go`

- [ ] **Step 1: Model schreiben**

```go
// internal/models/session_aggregates.go
package models

import "time"

// SessionAggregates speichert pro Session die vier "Single-Driver"-Antworten,
// gegen die die Wetten polePosition / fastestLap / firstDnf / driverOfTheDay
// gescored werden. Alle Felder nullable:
//
//   - PoleDriverNumber:          abgeleitet aus StartingGrid (Position == 1).
//   - FastestLapDriverNumber:    aus OpenF1 Lap-Daten (schnellste nicht-PitOut-Lap).
//   - FirstDnfDriverNumber:      aus models.Result (DNF=true) + Laps
//                                (DNF-Fahrer mit kleinster MAX(LapNumber)).
//   - DriverOfTheDayDriverNumber: manueller Admin-Input (OpenF1 liefert's nicht).
type SessionAggregates struct {
	SessionKey                  int       `gorm:"primaryKey" json:"session_key"`
	PoleDriverNumber            *int      `json:"pole_driver_number,omitempty"`
	FastestLapDriverNumber      *int      `json:"fastest_lap_driver_number,omitempty"`
	FirstDnfDriverNumber        *int      `json:"first_dnf_driver_number,omitempty"`
	DriverOfTheDayDriverNumber  *int      `json:"driver_of_the_day_driver_number,omitempty"`
	CreatedAt                   time.Time `json:"-"`
	UpdatedAt                   time.Time `json:"-"`
}
```

- [ ] **Step 2: Migration verdrahten**

In `main.go` die `migrate`-Funktion anpassen:

```go
func migrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.Team{},
		&models.Driver{},
		&models.Player{},
		&models.Wettschein{},
		&models.Wette{},
		&models.Result{},
		&models.StartingGrid{},
		&models.Session{},
		&models.SessionAggregates{},
	)
}
```

- [ ] **Step 3: Build**

Run: `cd /home/fabi/projects/f1-tip-game && go build ./...`
Expected: exit 0, keine Ausgabe.

- [ ] **Step 4: Commit**

```bash
cd /home/fabi/projects/f1-tip-game
git add internal/models/session_aggregates.go main.go
git commit -m "feat(models): SessionAggregates (pole/fastestLap/firstDnf/dotd)

Pro Session eine Row mit vier nullable *int-Spalten für die
Single-Driver-Antworten gegen die die vier Renn-Wetten gescored
werden. Pole/FL/FirstDnf werden berechnet, DotD manuell gesetzt."
```

---

### Task 2: Backend — Aggregates Repository

**Files:**
- Create: `/home/fabi/projects/f1-tip-game/internal/repository/aggregates_repository.go`

- [ ] **Step 1: Repository schreiben**

```go
// internal/repository/aggregates_repository.go
package repository

import (
	"errors"

	"gorm.io/gorm"

	"github.com/GypsyyCode/f1-tip-game/internal/models"
)

type AggregatesRepository interface {
	// Get liefert die Row für den Session-Key oder sql.ErrNoRows,
	// falls noch nicht angelegt.
	Get(sessionKey int) (models.SessionAggregates, error)
	// Upsert legt die Row an oder überschreibt sie (ON CONFLICT auf session_key).
	Upsert(agg models.SessionAggregates) error
	// SetDriverOfTheDay setzt nur das DotD-Feld (lässt andere Felder in Ruhe,
	// erzeugt die Row falls nicht vorhanden).
	SetDriverOfTheDay(sessionKey, driverNumber int) error
}

type aggregatesRepository struct {
	db *gorm.DB
}

func NewAggregatesRepository(db *gorm.DB) AggregatesRepository {
	return &aggregatesRepository{db: db}
}

func (r *aggregatesRepository) Get(sessionKey int) (models.SessionAggregates, error) {
	var agg models.SessionAggregates
	err := r.db.Where("session_key = ?", sessionKey).First(&agg).Error
	return agg, err
}

func (r *aggregatesRepository) Upsert(agg models.SessionAggregates) error {
	// Use GORM's OnConflict helper to upsert by primary key.
	return r.db.Save(&agg).Error
}

func (r *aggregatesRepository) SetDriverOfTheDay(sessionKey, driverNumber int) error {
	var existing models.SessionAggregates
	err := r.db.Where("session_key = ?", sessionKey).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return r.db.Create(&models.SessionAggregates{
			SessionKey:                 sessionKey,
			DriverOfTheDayDriverNumber: &driverNumber,
		}).Error
	}
	if err != nil {
		return err
	}
	existing.DriverOfTheDayDriverNumber = &driverNumber
	return r.db.Save(&existing).Error
}
```

- [ ] **Step 2: Build**

Run: `cd /home/fabi/projects/f1-tip-game && go build ./...`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /home/fabi/projects/f1-tip-game
git add internal/repository/aggregates_repository.go
git commit -m "feat(repository): AggregatesRepository CRUD + DotD-only setter"
```

---

### Task 3: Backend — FastestLap-Berechnung (Pure Function + TDD)

**Files:**
- Create: `/home/fabi/projects/f1-tip-game/coupons/scoring/aggregates/fastest_lap.go`
- Create: `/home/fabi/projects/f1-tip-game/coupons/scoring/aggregates/fastest_lap_test.go`

- [ ] **Step 1: Tests schreiben (TDD)**

```go
// coupons/scoring/aggregates/fastest_lap_test.go
package aggregates

import (
	"testing"

	"github.com/GypsyyCode/f1-tip-game/pkg/openf1"
)

func fptr(f float64) *float64 { return &f }

func lap(driver, lapNum int, dur *float64, pitOut bool) openf1.Lap {
	return openf1.Lap{DriverNumber: driver, LapNumber: lapNum, LapDuration: dur, IsPitOutLap: pitOut}
}

func TestFastestLapDriver_PicksMinDuration(t *testing.T) {
	laps := []openf1.Lap{
		lap(44, 1, fptr(91.2), false),
		lap(1, 1, fptr(90.5), false),
		lap(16, 1, fptr(91.0), false),
	}
	got := FastestLapDriver(laps)
	if got == nil || *got != 1 {
		t.Fatalf("want driver 1, got %v", got)
	}
}

func TestFastestLapDriver_IgnoresPitOutLaps(t *testing.T) {
	// Driver 44 has the fastest raw duration but it's a pit-out lap → ignore it.
	laps := []openf1.Lap{
		lap(44, 2, fptr(85.0), true),  // pit-out, ignore
		lap(44, 3, fptr(91.5), false),
		lap(1, 1, fptr(90.5), false),
	}
	got := FastestLapDriver(laps)
	if got == nil || *got != 1 {
		t.Fatalf("want driver 1, got %v", got)
	}
}

func TestFastestLapDriver_IgnoresNilDuration(t *testing.T) {
	// nil duration = incomplete lap (DNF mid-lap). Ignore it.
	laps := []openf1.Lap{
		lap(44, 15, nil, false),
		lap(44, 10, fptr(90.5), false),
	}
	got := FastestLapDriver(laps)
	if got == nil || *got != 44 {
		t.Fatalf("want driver 44, got %v", got)
	}
}

func TestFastestLapDriver_EmptyInput_ReturnsNil(t *testing.T) {
	if got := FastestLapDriver(nil); got != nil {
		t.Fatalf("want nil, got %v", got)
	}
}

func TestFastestLapDriver_AllNilOrPitOut_ReturnsNil(t *testing.T) {
	laps := []openf1.Lap{
		lap(44, 1, nil, false),
		lap(1, 1, fptr(85.0), true),
	}
	if got := FastestLapDriver(laps); got != nil {
		t.Fatalf("want nil, got %v", got)
	}
}
```

- [ ] **Step 2: Tests laufen lassen → scheitern**

Run: `cd /home/fabi/projects/f1-tip-game && go test ./coupons/scoring/aggregates/... -v`
Expected: FAIL (undefined: FastestLapDriver).

- [ ] **Step 3: Implementierung**

```go
// coupons/scoring/aggregates/fastest_lap.go
// Package aggregates berechnet aus OpenF1-/DB-Daten die vier Session-Aggregate,
// gegen die die Renn-Wetten polePosition / fastestLap / firstDnf / driverOfTheDay
// gescored werden. Rein funktional, kein IO.
package aggregates

import "github.com/GypsyyCode/f1-tip-game/pkg/openf1"

// FastestLapDriver gibt die Fahrernummer der schnellsten gefahrenen Rennrunde zurück.
//
// Ausgeschlossen:
//   - Pit-Out-Laps (IsPitOutLap == true) — die enthalten den Boxengassen-Aufenthalt
//     und sind keine echten Rennzeiten.
//   - Runden ohne gemessene Dauer (LapDuration == nil) — unvollständig / DNF mid-lap.
//
// Rückgabe nil, wenn keine Lap die Kriterien erfüllt.
func FastestLapDriver(laps []openf1.Lap) *int {
	var bestDriver int
	var bestDur float64
	found := false

	for _, l := range laps {
		if l.IsPitOutLap || l.LapDuration == nil {
			continue
		}
		if !found || *l.LapDuration < bestDur {
			bestDriver = l.DriverNumber
			bestDur = *l.LapDuration
			found = true
		}
	}

	if !found {
		return nil
	}
	return &bestDriver
}
```

- [ ] **Step 4: Tests laufen lassen → bestehen**

Run: `cd /home/fabi/projects/f1-tip-game && go test ./coupons/scoring/aggregates/... -v`
Expected: PASS 5/5.

- [ ] **Step 5: Commit**

```bash
cd /home/fabi/projects/f1-tip-game
git add coupons/scoring/aggregates/fastest_lap.go coupons/scoring/aggregates/fastest_lap_test.go
git commit -m "feat(scoring): pure FastestLapDriver function + 5 tests

Picks the driver with the smallest LapDuration across all non-pit-out,
non-nil laps. Returns nil when no lap qualifies."
```

---

### Task 4: Backend — FirstDnf-Berechnung (Pure Function + TDD)

**Files:**
- Create: `/home/fabi/projects/f1-tip-game/coupons/scoring/aggregates/first_dnf.go`
- Create: `/home/fabi/projects/f1-tip-game/coupons/scoring/aggregates/first_dnf_test.go`

- [ ] **Step 1: Tests schreiben (TDD)**

```go
// coupons/scoring/aggregates/first_dnf_test.go
package aggregates

import (
	"testing"

	"github.com/GypsyyCode/f1-tip-game/internal/models"
	"github.com/GypsyyCode/f1-tip-game/pkg/openf1"
)

func iptr(i int) *int { return &i }

func result(driver int, dnf bool) models.Result {
	return models.Result{DriverNumber: driver, DNF: dnf}
}

func TestFirstDnfDriver_PicksEarliestDnfByMaxLap(t *testing.T) {
	// Driver 44 DNFs on lap 10, Driver 1 DNFs on lap 25 → first is 44.
	results := []models.Result{result(44, true), result(1, true), result(16, false)}
	laps := []openf1.Lap{
		lap(44, 1, fptr(90.0), false),
		lap(44, 10, nil, false), // dropped out mid lap 10
		lap(1, 1, fptr(90.0), false),
		lap(1, 25, nil, false),
		lap(16, 1, fptr(90.0), false),
		lap(16, 50, fptr(90.5), false),
	}
	got := FirstDnfDriver(results, laps)
	if got == nil || *got != 44 {
		t.Fatalf("want driver 44, got %v", got)
	}
}

func TestFirstDnfDriver_IgnoresNonDnfDrivers(t *testing.T) {
	results := []models.Result{result(1, false), result(44, true)}
	laps := []openf1.Lap{
		lap(1, 1, fptr(90.0), false), // finished, lap 1 doesn't matter
		lap(44, 15, nil, false),
	}
	got := FirstDnfDriver(results, laps)
	if got == nil || *got != 44 {
		t.Fatalf("want driver 44, got %v", got)
	}
}

func TestFirstDnfDriver_TieBreak_LowestDriverNumber(t *testing.T) {
	// Driver 7 and driver 44 both DNF on their lap 10 → pick 7 (deterministic).
	results := []models.Result{result(44, true), result(7, true)}
	laps := []openf1.Lap{
		lap(44, 10, nil, false),
		lap(7, 10, nil, false),
	}
	got := FirstDnfDriver(results, laps)
	if got == nil || *got != 7 {
		t.Fatalf("want driver 7, got %v", got)
	}
}

func TestFirstDnfDriver_DnfWithoutLaps_SkippedNotCrashed(t *testing.T) {
	// Driver 99 DNF but no lap data → cannot determine lap, skip them.
	// Driver 44 DNF with lap 15 → wins.
	results := []models.Result{result(99, true), result(44, true)}
	laps := []openf1.Lap{
		lap(44, 15, nil, false),
	}
	got := FirstDnfDriver(results, laps)
	if got == nil || *got != 44 {
		t.Fatalf("want driver 44, got %v", got)
	}
}

func TestFirstDnfDriver_NoDnfs_ReturnsNil(t *testing.T) {
	results := []models.Result{result(1, false), result(44, false)}
	if got := FirstDnfDriver(results, nil); got != nil {
		t.Fatalf("want nil, got %v", got)
	}
}
```

- [ ] **Step 2: Tests laufen lassen → scheitern**

Run: `cd /home/fabi/projects/f1-tip-game && go test ./coupons/scoring/aggregates/... -run TestFirstDnf -v`
Expected: FAIL (undefined: FirstDnfDriver).

- [ ] **Step 3: Implementierung**

```go
// coupons/scoring/aggregates/first_dnf.go
package aggregates

import (
	"github.com/GypsyyCode/f1-tip-game/internal/models"
	"github.com/GypsyyCode/f1-tip-game/pkg/openf1"
)

// FirstDnfDriver gibt die Fahrernummer dessen zurück, der als erster das Rennen
// nicht beenden konnte. Kriterium: unter allen Fahrern mit `DNF == true` der mit
// der kleinsten MAX(LapNumber) über die eigenen Laps.
//
// Fahrer ohne Lap-Daten werden übersprungen (nicht als "DNF auf Runde 0"
// gewertet — ohne Lap-Daten lässt sich nichts sagen).
//
// Tiebreaker bei Gleichstand: kleinste DriverNumber (deterministisch).
//
// Rückgabe nil, wenn kein DNF-Fahrer eine ermittelbare Runde hat.
func FirstDnfDriver(results []models.Result, laps []openf1.Lap) *int {
	// Set der DNF-Fahrer aufbauen.
	dnf := make(map[int]struct{})
	for _, r := range results {
		if r.DNF {
			dnf[r.DriverNumber] = struct{}{}
		}
	}
	if len(dnf) == 0 {
		return nil
	}

	// Je DNF-Fahrer die höchste gesehene LapNumber bestimmen.
	maxLap := make(map[int]int)
	for _, l := range laps {
		if _, isDnf := dnf[l.DriverNumber]; !isDnf {
			continue
		}
		if current, ok := maxLap[l.DriverNumber]; !ok || l.LapNumber > current {
			maxLap[l.DriverNumber] = l.LapNumber
		}
	}
	if len(maxLap) == 0 {
		return nil
	}

	// Fahrer mit kleinster MAX(LapNumber) finden; bei Gleichstand kleinste DriverNumber.
	var bestDriver int
	var bestLap int
	found := false
	for driver, lastLap := range maxLap {
		if !found ||
			lastLap < bestLap ||
			(lastLap == bestLap && driver < bestDriver) {
			bestDriver = driver
			bestLap = lastLap
			found = true
		}
	}

	if !found {
		return nil
	}
	return &bestDriver
}
```

- [ ] **Step 4: Tests laufen lassen → bestehen**

Run: `cd /home/fabi/projects/f1-tip-game && go test ./coupons/scoring/aggregates/... -v`
Expected: PASS 10/10 (5 FastestLap + 5 FirstDnf).

- [ ] **Step 5: Commit**

```bash
cd /home/fabi/projects/f1-tip-game
git add coupons/scoring/aggregates/first_dnf.go coupons/scoring/aggregates/first_dnf_test.go
git commit -m "feat(scoring): pure FirstDnfDriver function + 5 tests

Picks the DNF driver with the smallest MAX(LapNumber) across their
laps. Drivers without lap data are skipped. Ties break by smallest
driver number for determinism."
```

---

### Task 5: Backend — AggregatesService + Compute-Endpoint

**Files:**
- Create: `/home/fabi/projects/f1-tip-game/internal/service/aggregates_service.go`
- Create: `/home/fabi/projects/f1-tip-game/internal/handler/aggregates_handler.go`
- Modify: `/home/fabi/projects/f1-tip-game/internal/router/router.go`
- Modify: `/home/fabi/projects/f1-tip-game/main.go`

- [ ] **Step 1: Service**

```go
// internal/service/aggregates_service.go
package service

import (
	"context"
	"fmt"

	"github.com/GypsyyCode/f1-tip-game/coupons/scoring/aggregates"
	"github.com/GypsyyCode/f1-tip-game/internal/models"
	"github.com/GypsyyCode/f1-tip-game/internal/repository"
	"github.com/GypsyyCode/f1-tip-game/pkg/openf1"
)

// gridLoader + resultsLoader + lapsLoader sind die drei Datenquellen, die
// der AggregatesService braucht. Als kleine Interfaces, damit der Service
// einfach testbar bleibt (keine echte DB / HTTP-Calls in Tests).
type gridLoader interface {
	FindStartingGridBySession(sessionKey int) ([]models.StartingGrid, error)
}
type resultsLoader interface {
	FindBySession(sessionKey int) ([]models.Result, error)
}
type lapsLoader interface {
	GetLaps(ctx context.Context, q openf1.Query) ([]openf1.Lap, error)
}

type AggregatesService interface {
	// Compute berechnet pole / fastestLap / firstDnf (nicht DotD!) und
	// persistiert sie in der session_aggregates-Tabelle.
	Compute(ctx context.Context, sessionKey int) (models.SessionAggregates, error)
	// SetDriverOfTheDay setzt das DotD-Feld manuell.
	SetDriverOfTheDay(sessionKey, driverNumber int) error
	// Get liefert die aktuelle Row (oder leere Row + nil-Error, wenn noch nicht angelegt).
	Get(sessionKey int) (models.SessionAggregates, error)
}

type aggregatesService struct {
	repo    repository.AggregatesRepository
	grid    gridLoader
	results resultsLoader
	laps    lapsLoader
}

func NewAggregatesService(
	repo repository.AggregatesRepository,
	grid gridLoader,
	results resultsLoader,
	laps lapsLoader,
) AggregatesService {
	return &aggregatesService{repo: repo, grid: grid, results: results, laps: laps}
}

func (s *aggregatesService) Compute(ctx context.Context, sessionKey int) (models.SessionAggregates, error) {
	// Pole aus StartingGrid[Position == 1].
	grid, err := s.grid.FindStartingGridBySession(sessionKey)
	if err != nil {
		return models.SessionAggregates{}, fmt.Errorf("load starting grid: %w", err)
	}
	var pole *int
	for _, g := range grid {
		if g.Position != nil && *g.Position == 1 {
			driver := g.DriverNumber
			pole = &driver
			break
		}
	}

	// FastestLap + FirstDnf brauchen Laps + Results.
	results, err := s.results.FindBySession(sessionKey)
	if err != nil {
		return models.SessionAggregates{}, fmt.Errorf("load results: %w", err)
	}
	laps, err := s.laps.GetLaps(ctx, openf1.NewQuery().SessionKey(sessionKey))
	if err != nil {
		return models.SessionAggregates{}, fmt.Errorf("fetch laps: %w", err)
	}

	// Vorhandene Row laden (damit wir ein ggf. schon gesetztes DotD nicht wegwerfen).
	// Record-Not-Found ist ok — dann ist `existing` der Zero-Value und
	// DotD unten bleibt nil, was ebenfalls korrekt ist.
	existing, _ := s.repo.Get(sessionKey)

	agg := models.SessionAggregates{
		SessionKey:                 sessionKey,
		PoleDriverNumber:           pole,
		FastestLapDriverNumber:     aggregates.FastestLapDriver(laps),
		FirstDnfDriverNumber:       aggregates.FirstDnfDriver(results, laps),
		DriverOfTheDayDriverNumber: existing.DriverOfTheDayDriverNumber,
	}
	if err := s.repo.Upsert(agg); err != nil {
		return models.SessionAggregates{}, fmt.Errorf("upsert aggregates: %w", err)
	}
	return agg, nil
}

func (s *aggregatesService) SetDriverOfTheDay(sessionKey, driverNumber int) error {
	if driverNumber <= 0 {
		return fmt.Errorf("driver_number must be > 0")
	}
	return s.repo.SetDriverOfTheDay(sessionKey, driverNumber)
}

func (s *aggregatesService) Get(sessionKey int) (models.SessionAggregates, error) {
	agg, err := s.repo.Get(sessionKey)
	if err != nil {
		return models.SessionAggregates{}, err
	}
	return agg, nil
}
```

- [ ] **Step 2: Handler**

```go
// internal/handler/aggregates_handler.go
package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/GypsyyCode/f1-tip-game/internal/service"
)

type AggregatesHandler struct {
	svc service.AggregatesService
}

func NewAggregatesHandler(svc service.AggregatesService) *AggregatesHandler {
	return &AggregatesHandler{svc: svc}
}

// RegisterAdminRoutes registriert admin-geschützte Endpoints:
//   POST /aggregates/:sessionKey/compute          — pole/fastestLap/firstDnf berechnen
//   PUT  /aggregates/:sessionKey/driver-of-the-day — DotD manuell setzen (Body: {driver_number})
func (h *AggregatesHandler) RegisterAdminRoutes(r *gin.RouterGroup) {
	r.POST("/aggregates/:sessionKey/compute", h.compute)
	r.PUT("/aggregates/:sessionKey/driver-of-the-day", h.setDotd)
}

// RegisterPublicRoutes registriert den öffentlichen Read-Endpoint:
//   GET /aggregates/:sessionKey — zeigt die aktuellen Aggregate.
func (h *AggregatesHandler) RegisterPublicRoutes(r *gin.RouterGroup) {
	r.GET("/aggregates/:sessionKey", h.get)
}

func parseSessionKeyParam(c *gin.Context) (int, bool) {
	key, err := strconv.Atoi(c.Param("sessionKey"))
	if err != nil || key <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid sessionKey"})
		return 0, false
	}
	return key, true
}

func (h *AggregatesHandler) compute(c *gin.Context) {
	key, ok := parseSessionKeyParam(c)
	if !ok {
		return
	}
	agg, err := h.svc.Compute(c.Request.Context(), key)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, agg)
}

func (h *AggregatesHandler) setDotd(c *gin.Context) {
	key, ok := parseSessionKeyParam(c)
	if !ok {
		return
	}
	var body struct {
		DriverNumber int `json:"driver_number"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body (expect {driver_number})"})
		return
	}
	if err := h.svc.SetDriverOfTheDay(key, body.DriverNumber); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	agg, err := h.svc.Get(key)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, agg)
}

func (h *AggregatesHandler) get(c *gin.Context) {
	key, ok := parseSessionKeyParam(c)
	if !ok {
		return
	}
	agg, err := h.svc.Get(key)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "aggregates not computed yet"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, agg)
}
```

- [ ] **Step 3: Router verdrahten**

In `internal/router/router.go` die `Handlers`-Struct erweitern:

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
}
```

Im `public`-Block (nach `h.Leaderboard.RegisterPublicRoutes(public)`):

```go
	h.Aggregates.RegisterPublicRoutes(public)
```

Im `admin`-Block (nach `h.Scoring.RegisterAdminRoutes(admin)`):

```go
	h.Aggregates.RegisterAdminRoutes(admin)
```

- [ ] **Step 4: main.go**

In `main.go` nach den anderen Repository/Service-Zeilen:

```go
	aggregatesRepo := repository.NewAggregatesRepository(db)
	// ...
	aggregatesService := service.NewAggregatesService(aggregatesRepo, resultRepo, resultRepo, openf1Client)
```

> **Hinweis:** `resultRepo` erfüllt beide Interfaces (`gridLoader` via `FindStartingGridBySession`, `resultsLoader` via `FindBySession`) — Duck Typing in Go. Falls `resultRepo` die Methode `FindStartingGridBySession` NICHT hat, siehe die Prüfung weiter unten.

Dann im `router.Handlers{...}`-Literal:

```go
		Aggregates: handler.NewAggregatesHandler(aggregatesService),
```

- [ ] **Step 5: Interface-Satisfaction prüfen**

Run: `cd /home/fabi/projects/f1-tip-game && go build ./...`
Expected: exit 0.

Falls Fehler „does not implement gridLoader" o. ä.: `resultRepo` hat die Methode nicht. In dem Fall:
- Prüfe die bestehende `ResultRepository`-Interface-Definition unter `internal/repository/result_repository.go`.
- Falls `FindStartingGridBySession(sessionKey int) ([]models.StartingGrid, error)` fehlt, ergänze sie am Repository + Interface. Die Datenquelle ist die bestehende `starting_grids`-Tabelle (siehe `ResultService.GetStartingGridBySession`, das die Methode schon aufruft).

- [ ] **Step 6: Smoke-Test (optional — nur wenn docker läuft)**

```bash
ADMIN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" -d '{"username":"<admin>","password":"<pw>"}' | jq -r .token)

# Compute
curl -s -X POST "http://localhost:8080/api/v1/aggregates/9158/compute" \
  -H "Authorization: Bearer $ADMIN" | jq .

# DotD setzen
curl -s -X PUT "http://localhost:8080/api/v1/aggregates/9158/driver-of-the-day" \
  -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
  -d '{"driver_number":44}' | jq .

# Public Get
curl -s "http://localhost:8080/api/v1/aggregates/9158" | jq .
```
Expected: Die drei berechneten Felder gesetzt, DotD = 44 nach PUT, GET funktioniert ohne Auth.

Wenn Docker nicht läuft: SKIP, zu Task 11 verschieben.

- [ ] **Step 7: Commit**

```bash
cd /home/fabi/projects/f1-tip-game
git add internal/service/aggregates_service.go \
        internal/handler/aggregates_handler.go \
        internal/router/router.go main.go
# Falls FindStartingGridBySession ergänzt wurde: 
git add internal/repository/result_repository.go
git commit -m "feat(aggregates): service + admin compute/set-dotd + public GET

AggregatesService orchestriert pole (via StartingGrid), fastestLap
und firstDnf (via OpenF1 Laps + Results) und persistiert sie in
session_aggregates. DriverOfTheDay bleibt manueller Admin-Input,
weil OpenF1 das Feld nicht liefert. Compute lässt DotD-Wert intakt."
```

---

### Task 6: Backend — Scoring Pure Functions für Single-Driver-Wetten (TDD)

**Files:**
- Create: `/home/fabi/projects/f1-tip-game/coupons/scoring/race_singles.go`
- Create: `/home/fabi/projects/f1-tip-game/coupons/scoring/race_singles_test.go`

- [ ] **Step 1: Tests schreiben (TDD)**

```go
// coupons/scoring/race_singles_test.go
package scoring

import (
	"testing"

	"github.com/GypsyyCode/f1-tip-game/coupons/race"
	"github.com/GypsyyCode/f1-tip-game/internal/models"
)

func pint(i int) *int { return &i }

func TestScorePole_Hit(t *testing.T) {
	schema := race.PoleSchema{}
	schema.DriverId = 1
	agg := models.SessionAggregates{PoleDriverNumber: pint(1)}
	if got := ScorePole(schema, agg); got != 3 {
		t.Fatalf("want 3, got %d", got)
	}
}

func TestScorePole_Miss(t *testing.T) {
	schema := race.PoleSchema{}
	schema.DriverId = 44
	agg := models.SessionAggregates{PoleDriverNumber: pint(1)}
	if got := ScorePole(schema, agg); got != 0 {
		t.Fatalf("want 0, got %d", got)
	}
}

func TestScorePole_AggregateMissing_Zero(t *testing.T) {
	schema := race.PoleSchema{}
	schema.DriverId = 1
	agg := models.SessionAggregates{PoleDriverNumber: nil}
	if got := ScorePole(schema, agg); got != 0 {
		t.Fatalf("want 0, got %d", got)
	}
}

func TestScoreFastestLap_Hit(t *testing.T) {
	schema := race.FastestLapSchema{}
	schema.DriverId = 44
	agg := models.SessionAggregates{FastestLapDriverNumber: pint(44)}
	if got := ScoreFastestLap(schema, agg); got != 3 {
		t.Fatalf("want 3, got %d", got)
	}
}

func TestScoreFastestLap_Miss(t *testing.T) {
	schema := race.FastestLapSchema{}
	schema.DriverId = 1
	agg := models.SessionAggregates{FastestLapDriverNumber: pint(44)}
	if got := ScoreFastestLap(schema, agg); got != 0 {
		t.Fatalf("want 0, got %d", got)
	}
}

func TestScoreFirstDnf_Hit(t *testing.T) {
	schema := race.FirstDnfSchema{}
	schema.DriverId = 7
	agg := models.SessionAggregates{FirstDnfDriverNumber: pint(7)}
	if got := ScoreFirstDnf(schema, agg); got != 3 {
		t.Fatalf("want 3, got %d", got)
	}
}

func TestScoreFirstDnf_Miss(t *testing.T) {
	schema := race.FirstDnfSchema{}
	schema.DriverId = 44
	agg := models.SessionAggregates{FirstDnfDriverNumber: pint(7)}
	if got := ScoreFirstDnf(schema, agg); got != 0 {
		t.Fatalf("want 0, got %d", got)
	}
}

func TestScoreDriverOfTheDay_Hit(t *testing.T) {
	schema := race.DriverOfTheDaySchema{}
	schema.DriverId = 16
	agg := models.SessionAggregates{DriverOfTheDayDriverNumber: pint(16)}
	if got := ScoreDriverOfTheDay(schema, agg); got != 3 {
		t.Fatalf("want 3, got %d", got)
	}
}

func TestScoreDriverOfTheDay_NotSet_Zero(t *testing.T) {
	schema := race.DriverOfTheDaySchema{}
	schema.DriverId = 16
	agg := models.SessionAggregates{DriverOfTheDayDriverNumber: nil}
	if got := ScoreDriverOfTheDay(schema, agg); got != 0 {
		t.Fatalf("want 0, got %d", got)
	}
}
```

- [ ] **Step 2: Tests laufen lassen → scheitern**

Run: `cd /home/fabi/projects/f1-tip-game && go test ./coupons/scoring/ -run "TestScorePole|TestScoreFastestLap|TestScoreFirstDnf|TestScoreDriverOfTheDay" -v`
Expected: FAIL (undefined score functions).

- [ ] **Step 3: Implementierung**

```go
// coupons/scoring/race_singles.go
package scoring

import (
	"github.com/GypsyyCode/f1-tip-game/coupons/race"
	"github.com/GypsyyCode/f1-tip-game/internal/models"
)

// scoreSingleDriver vergibt 3 Punkte wenn getippte DriverId == tatsächliche
// Fahrernummer, sonst 0. Nil-Aggregate (noch nicht berechnet) zählen 0.
func scoreSingleDriver(tipped int, actual *int) int {
	if actual == nil {
		return 0
	}
	if tipped == *actual {
		return 3
	}
	return 0
}

// ScorePole wertet eine polePosition-Wette gegen SessionAggregates aus.
func ScorePole(schema race.PoleSchema, agg models.SessionAggregates) int {
	return scoreSingleDriver(schema.DriverId, agg.PoleDriverNumber)
}

// ScoreFastestLap wertet eine fastestLap-Wette aus.
func ScoreFastestLap(schema race.FastestLapSchema, agg models.SessionAggregates) int {
	return scoreSingleDriver(schema.DriverId, agg.FastestLapDriverNumber)
}

// ScoreFirstDnf wertet eine firstDnf-Wette aus.
func ScoreFirstDnf(schema race.FirstDnfSchema, agg models.SessionAggregates) int {
	return scoreSingleDriver(schema.DriverId, agg.FirstDnfDriverNumber)
}

// ScoreDriverOfTheDay wertet eine driverOfTheDay-Wette aus.
func ScoreDriverOfTheDay(schema race.DriverOfTheDaySchema, agg models.SessionAggregates) int {
	return scoreSingleDriver(schema.DriverId, agg.DriverOfTheDayDriverNumber)
}
```

> **Hinweis:** `race.PoleSchema`/`FastestLapSchema`/`FirstDnfSchema`/`DriverOfTheDaySchema` enthalten jeweils ein eingebettetes `singleDriverPick{DriverId int, SessionKey int}`. Zugriff als `schema.DriverId` funktioniert dank Field Promotion.

- [ ] **Step 4: Tests laufen lassen → bestehen**

Run: `cd /home/fabi/projects/f1-tip-game && go test ./coupons/scoring/... -v`
Expected: PASS alle (die 8 aus Phase 3b + die neuen 9).

- [ ] **Step 5: Commit**

```bash
cd /home/fabi/projects/f1-tip-game
git add coupons/scoring/race_singles.go coupons/scoring/race_singles_test.go
git commit -m "feat(scoring): pure Score functions for pole/fastestLap/firstDnf/dotd

Treffer = 3 Pkt, sonst 0. Nil-Aggregate (noch nicht berechnet)
zählen 0. 9 Tests."
```

---

### Task 7: Backend — Scoring-Dispatcher erweitern

**Files:**
- Modify: `/home/fabi/projects/f1-tip-game/coupons/scoring/service.go`

- [ ] **Step 1: `Service` um Aggregat-Loader erweitern**

In `coupons/scoring/service.go`:

**1a.** Imports ergänzen:
```go
import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/GypsyyCode/f1-tip-game/coupons/race"
	"github.com/GypsyyCode/f1-tip-game/internal/models"
	"gorm.io/gorm"
)
```

**1b.** Interface + Struct ersetzen:
```go
type ResultsLoader interface {
	FindBySession(sessionKey int) ([]models.Result, error)
}

// AggregatesLoader liefert pole/fastestLap/firstDnf/dotd pro Session.
// Erfüllt vom AggregatesService.Get oder direkt vom Repository.
type AggregatesLoader interface {
	Get(sessionKey int) (models.SessionAggregates, error)
}

type Service struct {
	db         *gorm.DB
	results    ResultsLoader
	aggregates AggregatesLoader
}

func NewService(db *gorm.DB, results ResultsLoader, aggregates AggregatesLoader) *Service {
	return &Service{db: db, results: results, aggregates: aggregates}
}
```

**1c.** `ScoreSession` erweitern — Aggregat laden (einmal, oben), an Dispatcher reichen:

```go
func (s *Service) ScoreSession(ctx context.Context, sessionKey int) (int, error) {
	results, err := s.results.FindBySession(sessionKey)
	if err != nil {
		return 0, fmt.Errorf("load results: %w", err)
	}
	if len(results) == 0 {
		return 0, fmt.Errorf("no results stored for session %d — run /results/:sessionKey/sync first", sessionKey)
	}

	// Aggregat laden; wenn noch nicht berechnet, Zero-Value → vier Single-Wetten
	// scoren dann 0 (nil-Checks in den Score-Funktionen).
	agg, aggErr := s.aggregates.Get(sessionKey)
	if aggErr != nil {
		// gorm.ErrRecordNotFound ist OK — wir arbeiten mit dem Zero-Value weiter.
		agg = models.SessionAggregates{SessionKey: sessionKey}
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
		Where("schema::jsonb -> 'data' ->> 'session_key' = ?", fmt.Sprint(sessionKey)).
		Scan(&rows).Error; err != nil {
		return 0, fmt.Errorf("load coupons: %w", err)
	}

	n := 0
	for _, row := range rows {
		score, ok := scoreOne(row.SchemaName, row.Schema, results, agg)
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
	return n, nil
}
```

**1d.** `scoreOne` erweitern — vier neue Cases:

```go
func scoreOne(schemaName string, schemaJSON []byte, results []models.Result, agg models.SessionAggregates) (int, bool) {
	var wrap struct {
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(schemaJSON, &wrap); err != nil {
		return 0, false
	}

	switch schemaName {
	case "top3coupon":
		var s race.Top3Schema
		if err := json.Unmarshal(wrap.Data, &s); err != nil {
			return 0, false
		}
		return ScoreTop3(s, results), true
	case "top10coupon":
		var s race.Top10Schema
		if err := json.Unmarshal(wrap.Data, &s); err != nil {
			return 0, false
		}
		return ScoreTop10(s, results), true
	case "myDriverPlacement":
		var s race.MyDriverPlacementSchema
		if err := json.Unmarshal(wrap.Data, &s); err != nil {
			return 0, false
		}
		return ScoreMyDriverPlacement(s, results), true
	case "polePosition":
		var s race.PoleSchema
		if err := json.Unmarshal(wrap.Data, &s); err != nil {
			return 0, false
		}
		return ScorePole(s, agg), true
	case "fastestLap":
		var s race.FastestLapSchema
		if err := json.Unmarshal(wrap.Data, &s); err != nil {
			return 0, false
		}
		return ScoreFastestLap(s, agg), true
	case "firstDnf":
		var s race.FirstDnfSchema
		if err := json.Unmarshal(wrap.Data, &s); err != nil {
			return 0, false
		}
		return ScoreFirstDnf(s, agg), true
	case "driverOfTheDay":
		var s race.DriverOfTheDaySchema
		if err := json.Unmarshal(wrap.Data, &s); err != nil {
			return 0, false
		}
		return ScoreDriverOfTheDay(s, agg), true
	// TODO: teamDuell, driverChampionship, constructorChampionship — Saison-Scoring.
	default:
		return 0, false
	}
}
```

- [ ] **Step 2: main.go anpassen — ScoringService braucht AggregatesService als neues Arg**

```go
	scoringService := scoring.NewService(db, resultRepo, aggregatesService)
```

- [ ] **Step 3: Build + Tests**

Run: `cd /home/fabi/projects/f1-tip-game && go build ./... && go test ./coupons/scoring/... ./coupons/scoring/aggregates/... ./internal/auth/... -v 2>&1 | tail -30`
Expected: Build grün, alle Tests pass.

- [ ] **Step 4: Commit**

```bash
cd /home/fabi/projects/f1-tip-game
git add coupons/scoring/service.go main.go
git commit -m "feat(scoring): dispatcher scores pole/fastestLap/firstDnf/dotd

ScoreSession lädt die SessionAggregates einmal (Zero-Value, wenn noch
nicht berechnet) und reicht sie in scoreOne. Vier neue Switch-Cases
rufen die neuen Score-Funktionen auf."
```

---

### Task 8: Frontend — API-Clients für Aggregates

**Files:**
- Modify: `/home/fabi/projects/f1ontend/f1ontend/src/plugins/scores.ts`

- [ ] **Step 1: Typen + Clients ergänzen**

Am Ende von `src/plugins/scores.ts` ergänzen:

```ts
export type SessionAggregates = {
	session_key: number
	pole_driver_number?: number | null
	fastest_lap_driver_number?: number | null
	first_dnf_driver_number?: number | null
	driver_of_the_day_driver_number?: number | null
}

/**
 * Berechnet pole/fastestLap/firstDnf für eine Session (admin-geschützt).
 * DriverOfTheDay bleibt unverändert und muss separat über setDriverOfTheDay
 * gesetzt werden.
 *
 * Backend-Endpoint: POST /api/v1/aggregates/:sessionKey/compute
 */
export async function computeAggregates (sessionKey: number, token: string): Promise<SessionAggregates> {
	const res = await fetch(`${API_BASE}/api/v1/aggregates/${sessionKey}/compute`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}` },
	})
	if (!res.ok) {
		const msg = await res.text().catch(() => res.statusText)
		throw new Error(`Aggregate konnten nicht berechnet werden (HTTP ${res.status}): ${msg}`)
	}
	return await res.json() as SessionAggregates
}

/**
 * Setzt DriverOfTheDay manuell (admin-geschützt).
 *
 * Backend-Endpoint: PUT /api/v1/aggregates/:sessionKey/driver-of-the-day
 */
export async function setDriverOfTheDay (sessionKey: number, driverNumber: number, token: string): Promise<SessionAggregates> {
	const res = await fetch(`${API_BASE}/api/v1/aggregates/${sessionKey}/driver-of-the-day`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ driver_number: driverNumber }),
	})
	if (!res.ok) {
		const msg = await res.text().catch(() => res.statusText)
		throw new Error(`Driver of the Day konnte nicht gesetzt werden (HTTP ${res.status}): ${msg}`)
	}
	return await res.json() as SessionAggregates
}

/**
 * Liefert die aktuell gespeicherten Aggregate (public).
 * Gibt null zurück, wenn für die Session noch keine Row angelegt wurde (404).
 */
export async function getAggregates (sessionKey: number): Promise<SessionAggregates | null> {
	const res = await fetch(`${API_BASE}/api/v1/aggregates/${sessionKey}`)
	if (res.status === 404) return null
	if (!res.ok) {
		const msg = await res.text().catch(() => res.statusText)
		throw new Error(`Aggregate konnten nicht geladen werden (HTTP ${res.status}): ${msg}`)
	}
	return await res.json() as SessionAggregates
}
```

- [ ] **Step 2: Type-Check**

Run: `cd /home/fabi/projects/f1ontend/f1ontend && npm run type-check`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
git add src/plugins/scores.ts
git commit -m "feat(scores): aggregates API clients (compute / set-dotd / get)"
```

---

### Task 9: Frontend — Admin-Panel auf Punkteliste erweitern

**Files:**
- Modify: `/home/fabi/projects/f1ontend/f1ontend/src/pages/punkteliste.vue`

- [ ] **Step 1: Template erweitern — zwei neue Buttons + DotD-Dialog**

In `src/pages/punkteliste.vue`, im Admin-Button-Block (den `v-if="isAdmin"`-Container, der aktuell nur „Scoring auslösen" enthält), vor dem bestehenden Scoring-Button zwei weitere Buttons einfügen:

```vue
							<v-btn
								v-if="isAdmin"
								:loading="computing"
								:disabled="computing || !session.sessionKey || !auth.token"
								color="secondary"
								variant="tonal"
								prepend-icon="mdi-calculator"
								@click="runCompute"
							>
								Aggregate berechnen
							</v-btn>

							<v-btn
								v-if="isAdmin"
								:disabled="!session.sessionKey || !auth.token"
								color="secondary"
								variant="tonal"
								prepend-icon="mdi-star-circle"
								@click="dotdDialog = true"
							>
								Fahrer des Tages setzen
							</v-btn>
```

Direkt vor dem schließenden `</v-card>` (ganz am Ende des Templates) das Dialog ergänzen:

```vue
					<v-dialog v-model="dotdDialog" max-width="420">
						<v-card>
							<v-card-title>Fahrer des Tages</v-card-title>
							<v-card-text>
								<v-text-field
									v-model.number="dotdDriverNumber"
									label="Fahrernummer"
									type="number"
									min="1"
									density="comfortable"
									variant="outlined"
								/>
							</v-card-text>
							<v-card-actions>
								<v-spacer />
								<v-btn variant="text" @click="dotdDialog = false">Abbrechen</v-btn>
								<v-btn
									color="primary"
									:loading="settingDotd"
									:disabled="settingDotd || !dotdDriverNumber"
									@click="submitDotd"
								>
									Setzen
								</v-btn>
							</v-card-actions>
						</v-card>
					</v-dialog>
```

- [ ] **Step 2: Script erweitern**

Imports ergänzen:

```ts
import { computeAggregates, getLeaderboard, setDriverOfTheDay, triggerScoring, type LeaderboardRow } from '@/plugins/scores'
```

Nach den bestehenden `scoring`-/`scoringMsg`-Refs einfügen:

```ts
const computing = ref(false)
const dotdDialog = ref(false)
const dotdDriverNumber = ref<number | null>(null)
const settingDotd = ref(false)
```

Nach `async function runScoring () { ... }` einfügen:

```ts
async function runCompute () {
	if (!session.sessionKey || !auth.token) return
	computing.value = true
	error.value = null
	scoringMsg.value = null
	try {
		const agg = await computeAggregates(session.sessionKey, auth.token)
		const parts = [
			agg.pole_driver_number ? `Pole #${agg.pole_driver_number}` : 'Pole —',
			agg.fastest_lap_driver_number ? `FL #${agg.fastest_lap_driver_number}` : 'FL —',
			agg.first_dnf_driver_number ? `DNF #${agg.first_dnf_driver_number}` : 'DNF —',
		]
		scoringMsg.value = `Aggregate berechnet: ${parts.join(' · ')}`
	} catch (e) {
		error.value = e instanceof Error ? e.message : String(e)
	} finally {
		computing.value = false
	}
}

async function submitDotd () {
	if (!session.sessionKey || !auth.token || !dotdDriverNumber.value) return
	settingDotd.value = true
	error.value = null
	try {
		await setDriverOfTheDay(session.sessionKey, dotdDriverNumber.value, auth.token)
		scoringMsg.value = `Fahrer des Tages gesetzt: #${dotdDriverNumber.value}`
		dotdDialog.value = false
		dotdDriverNumber.value = null
	} catch (e) {
		error.value = e instanceof Error ? e.message : String(e)
	} finally {
		settingDotd.value = false
	}
}
```

- [ ] **Step 3: Type-Check**

Run: `cd /home/fabi/projects/f1ontend/f1ontend && npm run type-check`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
git add src/pages/punkteliste.vue
git commit -m "feat(punkteliste): admin controls for aggregates + DotD

Zwei neue Buttons (Aggregate berechnen / Fahrer des Tages setzen)
plus Dialog mit Fahrernummer-Input. Alles nur für role=admin
sichtbar und disabled wenn keine aktive Session."
```

---

### Task 10: End-to-End-Verifikation + Doc-Update

Keine Code-Änderungen — Durchlauf.

- [ ] **Step 1: BE + FE starten, als Admin einloggen**

- [ ] **Step 2: Tipps auf alle vier neuen Wettarten als eingeloggter User abgeben**

Je einen Tipp auf Pole, FastestLap, FirstDnf, DriverOfTheDay. Mindestens einen davon so wählen, dass er stimmen sollte (um Hit-Case zu verifizieren).

- [ ] **Step 3: Results + StartingGrid syncen (Admin)**

```bash
curl -s -X POST "http://localhost:8080/api/v1/results/<sessionKey>/sync" \
  -H "Authorization: Bearer $ADMIN"
curl -s -X POST "http://localhost:8080/api/v1/results/<sessionKey>/grid/sync" \
  -H "Authorization: Bearer $ADMIN"
```

- [ ] **Step 4: Aggregate berechnen** — im UI „Aggregate berechnen"-Button klicken.

Erwartet: Success-Alert zeigt Pole #N · FL #N · DNF #N (DNF nur wenn welche gab's). Netzwerk-Call `POST /aggregates/<sessionKey>/compute` liefert 200 mit allen vier Feldern (DotD = null).

- [ ] **Step 5: DotD setzen** — „Fahrer des Tages setzen" klicken, Fahrernummer eingeben, Setzen.

Erwartet: Success-Alert, DotD-Feld in `GET /aggregates/<sessionKey>` nicht mehr null.

- [ ] **Step 6: Scoring auslösen** — „Scoring auslösen"-Button klicken.

Erwartet: scored_coupons-Zahl deckt jetzt auch die vier neuen Schemas. Rangliste zeigt Punkte-Delta.

- [ ] **Step 7: DB-Check**

```sql
SELECT schema_name, score FROM coupons WHERE player_id IS NOT NULL AND score IS NOT NULL;
```
Erwartet: Zeilen für `polePosition`/`fastestLap`/`firstDnf`/`driverOfTheDay` mit Score 0 oder 3.

- [ ] **Step 8: Phase-3b-Design-Doc aktualisieren**

In `docs/superpowers/plans/2026-10-21-scoring-leaderboard.md` den Status-Block ergänzen:

```md
> Status: **umgesetzt (Variante C: Hybrid)** inklusive Phase 4 für die
> vier Single-Driver-Renn-Wetten (`polePosition`, `fastestLap`, `firstDnf`,
> `driverOfTheDay`). Siehe
> [2026-10-23-phase4-remaining-race-scorings.md](./2026-10-23-phase4-remaining-race-scorings.md).
> Noch offen: Saison-Wetten (`teamDuell`, Championship-Ranks) — die haben
> andere Trigger-Zeitpunkte (Saison-Ende) und werden separat behandelt.
```

- [ ] **Step 9: Commit**

```bash
cd /home/fabi/projects/f1ontend/f1ontend
git add docs/superpowers/plans/2026-10-21-scoring-leaderboard.md
git commit -m "docs(plans): mark Phase 4 (single-driver race scorings) complete"
```

---

## Offene Punkte (nicht Teil von Phase 4)

- **Saison-Wetten:** `teamDuell`, `driverChampionship`, `constructorChampionship`. Andere Trigger-Semantik (Saison-Ende, einmal pro Saison), eigenes Scoring-Interface. Separate Phase.
- **Pole-Semantik:** Wir verwenden aktuell die **Startaufstellung** (post-penalty) als Pole-Quelle. Das ist pragmatisch, aber nicht strikt „Pole-Position im sportlichen Sinn" (= Qualifying-P1). Falls das zu Diskussionen führt: zweiter Sync + Scoring über die Qualifying-Session (OpenF1 unterstützt `session_type=Qualifying`-Filter).
- **DotD-UX:** aktuell ist der Admin-Dialog nur ein Zahlen-Input. Eine schönere Variante wäre ein Fahrer-Picker mit Namen/Nummern (braucht Driver-Store, der schon existiert). Nicht blocking.
- **Transaktion ums Scoring:** gilt wie in Phase 3b. Weiterhin offen.
