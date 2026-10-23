# Phase 3b: Scoring-Engine & Punkteliste (Variante C: Hybrid) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scoring für abgegebene Coupons und eine „Punkteliste"-Ranking-Seite im Frontend, ohne den aktuellen anonymen Tipp-Flow zu brechen.

**Architecture:** `CouponBase` bekommt zwei neue, nullable Spalten: `PlayerID *uint` (wer hat getippt — `nil` = anonym) und `Score *int` (nach Session-Ergebnis befüllt). Eine **optionale** Auth-Middleware liegt vor den Coupon-Routen: Token vorhanden & gültig → PlayerID landet im Request-Context; Token fehlt → Request läuft trotzdem durch, PlayerID bleibt `nil`. Ein neuer `coupons/scoring`-Package rechnet pro Session die Scores aus (reine Funktionen pro `SchemaName` gegen `[]models.Result`), ein Admin-Endpoint löst das aus, ein öffentlicher Leaderboard-Endpoint aggregiert `SUM(score)` je Player. Frontend sendet den JWT bei Coupon-POSTs mit, holt die Rangliste über einen neuen `scores.ts`-Client und zeigt sie unter `/punkteliste`.

**Tech Stack:** Backend Go + Gin + GORM + Postgres (Repo `../../f1-tip-game`). Frontend Vue 3 + Pinia + Vuetify 3 + TypeScript (dieses Repo). Backend-Tests mit `go test ./...`. Frontend hat keinen Test-Runner → Verifikation durch `npm run type-check` und manuelles `npm run dev`.

> **WICHTIG – Code-Stil & Lint (Frontend):** Repo ist mit **TABs** eingerückt. `npm run lint` schlägt repo-weit fehl und ist **kein** Gate. **Mit TABs schreiben**, `catch (e)` beibehalten, **niemals `eslint`/`npm run lint:fix` ausführen**. Einziges FE-Gate: `npm run type-check`.

> **WICHTIG – Scoring-Umfang MVP:** Nur `top3coupon`, `top10coupon`, `myDriverPlacement` werden tatsächlich bepunktet (per-Position 3 Pkt. exakt, ±1 Pkt., sonst 0). `polePosition`, `fastestLap`, `firstDnf`, `driverOfTheDay`, `teamDuell` und beide Championship-Wetten liefern aktuell `0` + einen zentralen TODO-Marker, weil die Ergebnisquellen (Qualifying-P1, DotD-Feld, Lap-Zeiten, Saison-Ende) noch nicht angebunden sind. Scoring-Interface bleibt generisch, damit das später nachgezogen werden kann.

---

## File Structure

**Backend (`../../f1-tip-game`):**
- Modify: `coupons/coupon.go` — `PlayerID *uint`, `Score *int` + GORM-Tags an `CouponBase[T]`.
- Modify: `coupons/service.go` — `Create` nimmt optional `playerID`, setzt sie auf dem Coupon.
- Modify: `coupons/handler.go` — `create` liest `playerID` aus `r.Context()` und reicht sie an den Service.
- Create: `internal/auth/optional_middleware.go` — Gin-Middleware, die bei vorhandenem gültigem Token `playerID`/`role` setzt UND zusätzlich in `r.Context()` injiziert, sonst durchlässt.
- Modify: `internal/router/router.go` — Optional-Auth-Middleware vor der Coupon-Mux-Weiche.
- Create: `coupons/scoring/scoring.go` — generisches `ScoreFunc`-Interface pro `SchemaName`, Registry, Dispatcher.
- Create: `coupons/scoring/scoring_test.go` — Unit-Tests für Top3/Top10/MyDriverPlacement.
- Create: `coupons/scoring/service.go` — `Service.ScoreSession(sessionKey)` lädt Results + Coupons, berechnet, persistiert.
- Create: `internal/handler/scoring_handler.go` — Admin-Route `POST /api/v1/scoring/:sessionKey`.
- Create: `internal/handler/leaderboard_handler.go` — Public-Route `GET /api/v1/leaderboard`.
- Create: `internal/service/leaderboard_service.go` + `internal/repository/leaderboard_repository.go` — Aggregation.
- Modify: `internal/router/router.go` — beide neuen Handler verdrahten.
- Modify: `main.go` — neue Services instanziieren, Handler übergeben.

**Frontend (dieses Repo):**
- Modify: `src/plugins/coupons/useCoupon.ts` — Token aus `useAuthStore` ziehen und an `create` übergeben.
- Create: `src/plugins/scores.ts` — Client für `GET /api/v1/leaderboard`.
- Create: `src/pages/punkteliste.vue` — Rangliste mit Podest (Gold/Silber/Bronze via `positionColors`), Tabelle, Session-Filter, eigene Zeile hervorgehoben.
- Modify: `src/App.vue` — Nav-Eintrag „Punkteliste" in Gruppe „Mein Fahrer" (ganz oben).

---

### Task 1: Backend — PlayerID + Score an CouponBase

**Files:**
- Modify: `../../f1-tip-game/coupons/coupon.go`

- [ ] **Step 1: `CouponBase` um zwei nullable Spalten erweitern**

Ersetze die Struct-Definition in `coupons/coupon.go`:

```go
type CouponBase[T SchemaData] struct {
	ID					string 		`gorm:"type:uuid;primaryKey" json:"id"`
	Name        string		`gorm:"not null" json:"name"`
	Description string		`gorm:"not null" json:"description"`
	Category    Category	`gorm:"not null" json:"category"` // race / saison / team
	SchemaName	string		`gorm:"not null" json:"schemaName"`
	// PlayerID = wer hat getippt. nil = anonym (altes Verhalten).
	// Index, damit das Leaderboard GROUP BY player_id performant bleibt.
	PlayerID		*uint 		`gorm:"index" json:"player_id,omitempty"`
	// Score wird vom scoring-Package nach Session-Ergebnis gesetzt.
	// nil = noch nicht gewertet.
	Score 			*int 		`gorm:"index" json:"score,omitempty"`
	Schema			*Schema[T] `gorm:"type:jsonb" json:"schema"`
}
```

- [ ] **Step 2: Build + Migration prüfen**

Run: `cd ../../f1-tip-game && go build ./...`
Expected: Kein Fehler.

Run: `cd ../../f1-tip-game && docker-compose up -d db && go run . &` (hintergründig), kurz warten, dann Logs auf `AutoMigrate` prüfen. `AutoMigrate` fügt die Spalten additiv hinzu — bestehende Zeilen bekommen `NULL` in beiden Spalten (gewünscht).

Run: `cd ../../f1-tip-game && docker-compose exec db psql -U postgres -d f1tip -c "\d coupons" | grep -E "player_id|score"`
Expected: Zwei neue nullable Spalten `player_id (bigint)` und `score (bigint)`.

- [ ] **Step 3: Commit**

```bash
cd ../../f1-tip-game
git add coupons/coupon.go
git commit -m "feat(coupons): add nullable player_id + score to CouponBase

Prepares Variante C hybrid scoring: coupons stay anonymous by default,
but can optionally be attributed to a player (for leaderboard) and
scored after session results arrive. AutoMigrate adds both columns
as NULL on existing rows."
```

---

### Task 2: Backend — Optional-Auth-Middleware

**Files:**
- Create: `../../f1-tip-game/internal/auth/optional_middleware.go`
- Create: `../../f1-tip-game/internal/auth/optional_middleware_test.go`

- [ ] **Step 1: Test schreiben (TDD)**

```go
// optional_middleware_test.go
package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestOptionalAuth_NoToken_PassesWithoutPlayerID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	jwtMgr := NewJWTManager("test-secret", time.Hour)

	r := gin.New()
	r.Use(OptionalAuthMiddleware(jwtMgr))
	r.GET("/x", func(c *gin.Context) {
		if _, ok := PlayerIDFromContext(c.Request.Context()); ok {
			t.Fatal("expected no playerID in ctx without token")
		}
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", w.Code)
	}
}

func TestOptionalAuth_ValidToken_SetsPlayerIDInRequestContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	jwtMgr := NewJWTManager("test-secret", time.Hour)
	token, err := jwtMgr.Generate(42, "player")
	if err != nil {
		t.Fatal(err)
	}

	r := gin.New()
	r.Use(OptionalAuthMiddleware(jwtMgr))
	var seen uint
	var ok bool
	r.GET("/x", func(c *gin.Context) {
		seen, ok = PlayerIDFromContext(c.Request.Context())
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if !ok || seen != 42 {
		t.Fatalf("want playerID=42 in ctx, got %d ok=%v", seen, ok)
	}
}

func TestOptionalAuth_InvalidToken_PassesWithoutPlayerID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	jwtMgr := NewJWTManager("test-secret", time.Hour)

	r := gin.New()
	r.Use(OptionalAuthMiddleware(jwtMgr))
	r.GET("/x", func(c *gin.Context) {
		if _, ok := PlayerIDFromContext(c.Request.Context()); ok {
			t.Fatal("expected no playerID with invalid token")
		}
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set("Authorization", "Bearer not-a-real-token")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("want 200 (optional auth), got %d", w.Code)
	}
}
```

- [ ] **Step 2: Test laufen lassen → scheitert**

Run: `cd ../../f1-tip-game && go test ./internal/auth/... -run TestOptionalAuth -v`
Expected: FAIL mit `undefined: OptionalAuthMiddleware` / `undefined: PlayerIDFromContext`.

- [ ] **Step 3: Middleware implementieren**

```go
// optional_middleware.go
package auth

import (
	"context"
	"strings"

	"github.com/gin-gonic/gin"
)

// ctxKey ist ein unexportierter Typ, damit nicht aus Versehen Collisions mit
// anderen Context-Keys entstehen.
type ctxKey int

const playerIDCtxKey ctxKey = 1

// WithPlayerID hängt die PlayerID an einen context.Context an.
func WithPlayerID(ctx context.Context, playerID uint) context.Context {
	return context.WithValue(ctx, playerIDCtxKey, playerID)
}

// PlayerIDFromContext liest die PlayerID aus dem Context.
// ok=false bedeutet: anonymer Request (kein / ungültiger Token).
func PlayerIDFromContext(ctx context.Context) (uint, bool) {
	v, ok := ctx.Value(playerIDCtxKey).(uint)
	return v, ok
}

// OptionalAuthMiddleware liest ein optionales Bearer-Token aus dem
// Authorization-Header. Ist das Token gültig, werden "playerID"/"role" sowohl
// im Gin-Context als auch im Request-Context gesetzt (letzteres ist nötig,
// damit nachgelagerte net/http-Handler über `gin.WrapH(mux)` die PlayerID
// aus `r.Context()` lesen können). Ist der Header leer oder das Token
// ungültig, läuft der Request **ohne** PlayerID durch (altes anonymes
// Verhalten).
func OptionalAuthMiddleware(jwtManager *JWTManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			c.Next()
			return
		}

		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims, err := jwtManager.Verify(tokenStr)
		if err != nil {
			// Ungültiges Token → anonym durchlassen, nicht 401.
			c.Next()
			return
		}

		c.Set("playerID", claims.PlayerID)
		c.Set("role", claims.Role)
		c.Request = c.Request.WithContext(WithPlayerID(c.Request.Context(), claims.PlayerID))
		c.Next()
	}
}
```

- [ ] **Step 4: Tests laufen lassen → bestehen**

Run: `cd ../../f1-tip-game && go test ./internal/auth/... -run TestOptionalAuth -v`
Expected: PASS für alle drei Tests.

- [ ] **Step 5: Commit**

```bash
cd ../../f1-tip-game
git add internal/auth/optional_middleware.go internal/auth/optional_middleware_test.go
git commit -m "feat(auth): optional-auth middleware with playerID in request ctx

Needed so that /api/v1/coupons/* (served by net/http.ServeMux through
gin.WrapH) can attribute POSTs to a player when a valid token is
provided, while still accepting anonymous posts (Variante C hybrid)."
```

---

### Task 3: Backend — Coupon-Routen hinter Optional-Auth; Service/Handler nutzen PlayerID

**Files:**
- Modify: `../../f1-tip-game/internal/router/router.go`
- Modify: `../../f1-tip-game/coupons/service.go`
- Modify: `../../f1-tip-game/coupons/handler.go`

- [ ] **Step 1: Router — Coupons über eigene Group mit Optional-Auth einhängen**

In `internal/router/router.go` die Zeile `r.Any("/api/v1/coupons/*path", gin.WrapH(mux))` ersetzen durch:

```go
	// Coupons sind "hybrid": anonymer Zugriff bleibt erlaubt, aber ein
	// gültiger Bearer-Token hängt die PlayerID an den Request-Context,
	// damit `create` den Coupon dem Spieler zuordnet.
	couponsGroup := r.Group("/api/v1/coupons")
	couponsGroup.Use(auth.OptionalAuthMiddleware(jwtManager))
	couponsGroup.Any("/*path", gin.WrapH(mux))
```

Entrant-Zeile `r.Any("/api/v1/entrant/*path", gin.WrapH(mux))` **unverändert** lassen.

- [ ] **Step 2: Service `Create` erweitern**

In `coupons/service.go` die Methode `Create` ersetzen durch:

```go
func (s *Service[T]) Create(ctx context.Context, ds T, playerID *uint) (*CouponBase[T], error) {
	if err := ds.Validate(); err != nil {
		return nil, err
	}
	c := &CouponBase[T]{
		Name: s.meta.Name,
		Description: s.meta.Description,
		Category: s.meta.Category,
		SchemaName: s.meta.SchemaName,
		PlayerID: playerID,
		Schema: &Schema[T]{Data: ds},
	}

	return c, s.repo.Create(ctx, c)
}
```

- [ ] **Step 3: Handler `create` liest PlayerID aus Request-Context**

Oben in `coupons/handler.go` den Import ergänzen:

```go
import (
	// ... bestehende imports ...
	"github.com/GypsyyCode/f1-tip-game/internal/auth"
)
```

`create` in `coupons/handler.go` ersetzen durch:

```go
func (h*Handler[T]) create(w http.ResponseWriter, r *http.Request) {
	var req createRequest[T]
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		shared.WriteError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}

	var playerID *uint
	if pid, ok := auth.PlayerIDFromContext(r.Context()); ok {
		playerID = &pid
	}

	c, err := h.svc.Create(r.Context(), req.Schema, playerID)
	if err != nil {
		shared.WriteServiceError(w, err)
		return
	}

	shared.WriteJSON(w, http.StatusCreated, c)
}
```

- [ ] **Step 4: Build prüfen**

Run: `cd ../../f1-tip-game && go build ./...`
Expected: Kein Fehler.

- [ ] **Step 5: Smoke-Test (lokal, mit laufendem docker-compose)**

Run (anonym):
```bash
curl -i -X POST http://localhost:8080/api/v1/coupons/race/polePosition \
  -H "Content-Type: application/json" \
  -d '{"schema":{"driver_id":1,"session_key":9999}}'
```
Expected: `201 Created`, Response-JSON enthält `"player_id":null` (bzw. kein Feld).

Run (eingeloggt — erst Token holen):
```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<existing-user>","password":"<pw>"}' | jq -r .token)

curl -i -X POST http://localhost:8080/api/v1/coupons/race/polePosition \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"schema":{"driver_id":1,"session_key":9999}}'
```
Expected: `201 Created`, Response-JSON enthält `"player_id": <id>`.

- [ ] **Step 6: Commit**

```bash
cd ../../f1-tip-game
git add internal/router/router.go coupons/service.go coupons/handler.go
git commit -m "feat(coupons): attach player_id on POST when optional token present

Mounts /api/v1/coupons/* behind OptionalAuthMiddleware so the mux
sees a request context carrying the PlayerID. coupons.Service.Create
takes an optional *uint and stores it on the row."
```

---

### Task 4: Backend — Scoring-Package (reine Funktionen + Tests)

**Files:**
- Create: `../../f1-tip-game/coupons/scoring/scoring.go`
- Create: `../../f1-tip-game/coupons/scoring/scoring_test.go`

- [ ] **Step 1: Tests schreiben (TDD)**

```go
// scoring_test.go
package scoring

import (
	"testing"

	"github.com/GypsyyCode/f1-tip-game/coupons"
	"github.com/GypsyyCode/f1-tip-game/coupons/race"
	"github.com/GypsyyCode/f1-tip-game/internal/models"
)

func iptr(i int) *int { return &i }

func mkResult(driverNumber, position int) models.Result {
	return models.Result{DriverNumber: driverNumber, Position: iptr(position)}
}

func TestScoreTop3_AllExact(t *testing.T) {
	results := []models.Result{mkResult(1, 1), mkResult(2, 2), mkResult(3, 3)}
	schema := race.Top3Schema{
		Placements: []coupons.Placement{
			{DriverId: 1, Position: 1},
			{DriverId: 2, Position: 2},
			{DriverId: 3, Position: 3},
		},
	}
	got := ScoreTop3(schema, results)
	if got != 9 {
		t.Fatalf("want 9 (3 exact), got %d", got)
	}
}

func TestScoreTop3_OneExactOneOffByOne(t *testing.T) {
	results := []models.Result{mkResult(1, 1), mkResult(2, 2), mkResult(3, 3)}
	schema := race.Top3Schema{
		Placements: []coupons.Placement{
			{DriverId: 1, Position: 1}, // exact → 3
			{DriverId: 2, Position: 3}, // ±1 → 1
			{DriverId: 3, Position: 2}, // ±1 → 1
		},
	}
	got := ScoreTop3(schema, results)
	if got != 5 {
		t.Fatalf("want 5, got %d", got)
	}
}

func TestScoreTop3_DriverNotInResults_Zero(t *testing.T) {
	results := []models.Result{mkResult(1, 1)}
	schema := race.Top3Schema{
		Placements: []coupons.Placement{
			{DriverId: 99, Position: 1},
			{DriverId: 98, Position: 2},
			{DriverId: 97, Position: 3},
		},
	}
	got := ScoreTop3(schema, results)
	if got != 0 {
		t.Fatalf("want 0, got %d", got)
	}
}

func TestScoreTop10_MixedHits(t *testing.T) {
	results := make([]models.Result, 10)
	for i := 0; i < 10; i++ {
		results[i] = mkResult(i+1, i+1)
	}
	placements := make([]coupons.Placement, 10)
	for i := 0; i < 10; i++ {
		placements[i] = coupons.Placement{DriverId: i + 1, Position: i + 1}
	}
	// alle exakt → 10 * 3 = 30
	got := ScoreTop10(race.Top10Schema{Placements: placements}, results)
	if got != 30 {
		t.Fatalf("want 30, got %d", got)
	}
}

func TestScoreMyDriverPlacement_Exact(t *testing.T) {
	results := []models.Result{mkResult(44, 5)}
	schema := race.MyDriverPlacementSchema{DriverId: 44, Position: 5}
	if got := ScoreMyDriverPlacement(schema, results); got != 3 {
		t.Fatalf("want 3, got %d", got)
	}
}

func TestScoreMyDriverPlacement_OffByOne(t *testing.T) {
	results := []models.Result{mkResult(44, 6)}
	schema := race.MyDriverPlacementSchema{DriverId: 44, Position: 5}
	if got := ScoreMyDriverPlacement(schema, results); got != 1 {
		t.Fatalf("want 1 (±1), got %d", got)
	}
}

func TestScoreMyDriverPlacement_FarOff(t *testing.T) {
	results := []models.Result{mkResult(44, 15)}
	schema := race.MyDriverPlacementSchema{DriverId: 44, Position: 5}
	if got := ScoreMyDriverPlacement(schema, results); got != 0 {
		t.Fatalf("want 0, got %d", got)
	}
}

func TestScoreMyDriverPlacement_DNF_Zero(t *testing.T) {
	// Fahrer hat kein Position-Ergebnis (DNF ohne gezählte Platzierung).
	results := []models.Result{{DriverNumber: 44, Position: nil, DNF: true}}
	schema := race.MyDriverPlacementSchema{DriverId: 44, Position: 5}
	if got := ScoreMyDriverPlacement(schema, results); got != 0 {
		t.Fatalf("want 0, got %d", got)
	}
}
```

- [ ] **Step 2: Tests laufen lassen → scheitern**

Run: `cd ../../f1-tip-game && go test ./coupons/scoring/... -v`
Expected: FAIL — alle Funktionen `undefined`.

- [ ] **Step 3: Scoring-Funktionen implementieren**

```go
// scoring.go
// Package scoring berechnet Score-Werte für abgegebene Coupons gegen echte
// Session-Ergebnisse. Alle Funktionen sind pure: Schema + []Result → int.
//
// Punkteschema MVP (siehe Plan 2026-10-23-scoring-leaderboard-impl):
//   - Pro getippter Platzierung: exakt = 3 Punkte, ±1 Position = 1 Punkt, sonst 0.
//   - Fahrer ohne Position (DNF/DNS/DSQ ohne gezählten Platz) zählen 0.
//   - polePosition / fastestLap / firstDnf / driverOfTheDay / teamDuell /
//     ChampionshipRanks liefern 0, bis die Datenquellen angebunden sind
//     (TODO am jeweiligen Dispatcher-Case).
package scoring

import (
	"github.com/GypsyyCode/f1-tip-game/coupons"
	"github.com/GypsyyCode/f1-tip-game/coupons/race"
	"github.com/GypsyyCode/f1-tip-game/internal/models"
)

// positionByDriver indiziert Results nach DriverNumber → tatsächliche Position.
// Fahrer ohne Position (nil) werden ausgelassen.
func positionByDriver(results []models.Result) map[int]int {
	m := make(map[int]int, len(results))
	for _, r := range results {
		if r.Position != nil {
			m[r.DriverNumber] = *r.Position
		}
	}
	return m
}

// scorePlacement vergibt pro Tipp 3/1/0 Punkte.
func scorePlacement(tipped int, actual int) int {
	diff := tipped - actual
	switch {
	case diff == 0:
		return 3
	case diff == 1 || diff == -1:
		return 1
	default:
		return 0
	}
}

// ScoreTop3 wertet eine Top-3-Wette gegen Session-Ergebnisse aus.
func ScoreTop3(schema race.Top3Schema, results []models.Result) int {
	return scorePlacementList(schema.Placements, results)
}

// ScoreTop10 wertet eine Top-10-Wette gegen Session-Ergebnisse aus.
func ScoreTop10(schema race.Top10Schema, results []models.Result) int {
	return scorePlacementList(schema.Placements, results)
}

func scorePlacementList(placements []coupons.Placement, results []models.Result) int {
	actual := positionByDriver(results)
	total := 0
	for _, p := range placements {
		if actualPos, ok := actual[p.DriverId]; ok {
			total += scorePlacement(p.Position, actualPos)
		}
	}
	return total
}

// ScoreMyDriverPlacement wertet einen Platzierungstipp für den Saison-Fahrer aus.
func ScoreMyDriverPlacement(schema race.MyDriverPlacementSchema, results []models.Result) int {
	actual := positionByDriver(results)
	actualPos, ok := actual[schema.DriverId]
	if !ok {
		return 0
	}
	return scorePlacement(schema.Position, actualPos)
}
```

- [ ] **Step 4: Tests laufen lassen → bestehen**

Run: `cd ../../f1-tip-game && go test ./coupons/scoring/... -v`
Expected: PASS für alle 8 Tests.

- [ ] **Step 5: Commit**

```bash
cd ../../f1-tip-game
git add coupons/scoring/scoring.go coupons/scoring/scoring_test.go
git commit -m "feat(scoring): per-schema score functions for top3/top10/myDriver

Pure functions: Schema + []Result -> int. Scoring rule: 3 pts for the
exact position, 1 pt for ±1, 0 otherwise. Drivers without a counted
position (DNF/DNS/DSQ with null Position) score 0. Pole, fastestLap,
firstDnf, driverOfTheDay, teamDuell, championships intentionally
unscored for now (data source TODOs tracked in the Phase 3b plan)."
```

---

### Task 5: Backend — Scoring-Service & Admin-Trigger

**Files:**
- Create: `../../f1-tip-game/coupons/scoring/service.go`
- Create: `../../f1-tip-game/internal/handler/scoring_handler.go`
- Modify: `../../f1-tip-game/internal/router/router.go`
- Modify: `../../f1-tip-game/main.go`

- [ ] **Step 1: Scoring-Service implementieren**

```go
// coupons/scoring/service.go
package scoring

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/GypsyyCode/f1-tip-game/coupons/race"
	"github.com/GypsyyCode/f1-tip-game/internal/models"
	"gorm.io/gorm"
)

// ResultsLoader liefert für eine SessionKey die hinterlegten OpenF1-Ergebnisse.
// Entspricht dem bestehenden ResultRepository.FindBySession.
type ResultsLoader interface {
	FindBySession(sessionKey int) ([]models.Result, error)
}

// Service rechnet Scores für alle Coupons einer Session und persistiert sie.
type Service struct {
	db      *gorm.DB
	results ResultsLoader
}

func NewService(db *gorm.DB, results ResultsLoader) *Service {
	return &Service{db: db, results: results}
}

// ScoreSession lädt die Ergebnisse der Session, iteriert über alle Coupons,
// deren schema.data einen passenden session_key hat, berechnet den Score
// über das registrierte Scoring (siehe `scoreOne`) und schreibt das `score`-
// Feld. Rückgabe: Anzahl gewerteter Coupons.
func (s *Service) ScoreSession(ctx context.Context, sessionKey int) (int, error) {
	results, err := s.results.FindBySession(sessionKey)
	if err != nil {
		return 0, fmt.Errorf("load results: %w", err)
	}
	if len(results) == 0 {
		return 0, fmt.Errorf("no results stored for session %d — run /results/:sessionKey/sync first", sessionKey)
	}

	// Alle Coupons mit matching session_key in schema->data->session_key.
	// Wir laden rohe Zeilen (schema_name + schema jsonb) und dispatchen
	// per schema_name. CouponBase[T] ist generisch; für den Scoring-Flow
	// reicht uns die Basis-Zeile plus das untypisierte Schema.
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
		score, ok := scoreOne(row.SchemaName, row.Schema, results)
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

// scoreOne deserialisiert `schema->data` passend zum SchemaName und ruft
// die zugehörige Score-Funktion. ok=false bedeutet: Schema aktuell nicht
// gewertet (z. B. polePosition — Datenquelle fehlt).
func scoreOne(schemaName string, schemaJSON []byte, results []models.Result) (int, bool) {
	// `schema` ist das jsonb-Feld in Form {"data": {...}}.
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
	// TODO: polePosition, fastestLap, firstDnf, driverOfTheDay, teamDuell,
	// driverChampionship, constructorChampionship — Datenquellen anbinden.
	default:
		return 0, false
	}
}
```

- [ ] **Step 2: Handler**

```go
// internal/handler/scoring_handler.go
package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/GypsyyCode/f1-tip-game/coupons/scoring"
)

type ScoringHandler struct {
	svc *scoring.Service
}

func NewScoringHandler(svc *scoring.Service) *ScoringHandler {
	return &ScoringHandler{svc: svc}
}

// RegisterAdminRoutes registriert admin-geschützte Scoring-Endpoints.
func (h *ScoringHandler) RegisterAdminRoutes(r *gin.RouterGroup) {
	r.POST("/scoring/:sessionKey", h.ScoreSession)
}

func (h *ScoringHandler) ScoreSession(c *gin.Context) {
	key, err := strconv.Atoi(c.Param("sessionKey"))
	if err != nil || key <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid sessionKey"})
		return
	}
	n, err := h.svc.ScoreSession(c.Request.Context(), key)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"session_key": key, "scored_coupons": n})
}
```

- [ ] **Step 3: Router + main.go verdrahten**

In `internal/router/router.go` `Handlers`-Struct erweitern:

```go
type Handlers struct {
	Driver     *handler.DriverHandler
	Auth       *handler.AuthHandler
	Wettschein *handler.WettscheinHandler
	Result     *handler.ResultHandler
	Discovery  *handler.DiscoveryHandler
	Scoring    *handler.ScoringHandler
	Leaderboard *handler.LeaderboardHandler // s. Task 6
}
```

Im `admin`-Block ergänzen:

```go
	admin.Use(auth.AuthMiddleware(jwtManager), auth.RequireAdmin())
	h.Result.RegisterAdminRoutes(admin)
	h.Scoring.RegisterAdminRoutes(admin)
```

In `main.go` den Service + Handler bauen (nach `resultService` zu setzen):

```go
	scoringService := scoring.NewService(db, resultRepo)
	// ...
	handlers := router.Handlers{
		// ... bestehende Felder ...
		Scoring:     handler.NewScoringHandler(scoringService),
	}
```

Import in `main.go` ergänzen: `"github.com/GypsyyCode/f1-tip-game/coupons/scoring"`.

- [ ] **Step 4: Build prüfen**

Run: `cd ../../f1-tip-game && go build ./...`
Expected: Kein Fehler.

- [ ] **Step 5: Smoke-Test (lokal)**

Voraussetzung: eine abgeschlossene Session mit synchronisierten Results (`POST /api/v1/results/:sessionKey/sync` als Admin). Dann:

```bash
ADMIN_TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<admin>","password":"<pw>"}' | jq -r .token)

curl -i -X POST http://localhost:8080/api/v1/scoring/9158 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
Expected: `200 OK`, Body `{"session_key":9158,"scored_coupons":<n>}`. DB-Check: `SELECT id, score FROM coupons WHERE score IS NOT NULL LIMIT 5;` liefert Zeilen.

- [ ] **Step 6: Commit**

```bash
cd ../../f1-tip-game
git add coupons/scoring/service.go internal/handler/scoring_handler.go \
        internal/router/router.go main.go
git commit -m "feat(scoring): service + admin trigger POST /scoring/:sessionKey

Service loads results for the session, finds coupons with matching
session_key in schema->data, dispatches to per-schema score func
(top3/top10/myDriver only in MVP), writes score column. Admin-only
endpoint returns the number of scored coupons."
```

---

### Task 6: Backend — Leaderboard-Endpoint

**Files:**
- Create: `../../f1-tip-game/internal/repository/leaderboard_repository.go`
- Create: `../../f1-tip-game/internal/service/leaderboard_service.go`
- Create: `../../f1-tip-game/internal/handler/leaderboard_handler.go`
- Modify: `../../f1-tip-game/internal/router/router.go`
- Modify: `../../f1-tip-game/main.go`

- [ ] **Step 1: Repository**

```go
// internal/repository/leaderboard_repository.go
package repository

import (
	"gorm.io/gorm"
)

// LeaderboardRow ist eine Zeile der aggregierten Punkteliste.
// DisplayName ist leer, falls der Player kein Display-Name gesetzt hat →
// Frontend fällt dann auf Username zurück.
type LeaderboardRow struct {
	PlayerID    uint   `json:"player_id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	TotalScore  int    `json:"total_score"`
	ScoredBets  int    `json:"scored_bets"`
}

type LeaderboardRepository interface {
	Aggregate(sessionKey *int, schemaName *string) ([]LeaderboardRow, error)
}

type leaderboardRepository struct {
	db *gorm.DB
}

func NewLeaderboardRepository(db *gorm.DB) LeaderboardRepository {
	return &leaderboardRepository{db: db}
}

// Aggregate summiert `score` je `player_id` über alle gewerteten Coupons
// (player_id NOT NULL, score NOT NULL). Optional gefiltert auf eine Session
// oder einen Schema-Namen (z. B. "myDriverPlacement" für die Mein-Fahrer-Rangliste).
func (r *leaderboardRepository) Aggregate(sessionKey *int, schemaName *string) ([]LeaderboardRow, error) {
	q := r.db.
		Table("coupons AS c").
		Select(`
			c.player_id            AS player_id,
			p.username             AS username,
			p.display_name         AS display_name,
			COALESCE(SUM(c.score), 0) AS total_score,
			COUNT(c.id)            AS scored_bets
		`).
		Joins("JOIN players p ON p.id = c.player_id").
		Where("c.player_id IS NOT NULL AND c.score IS NOT NULL").
		Group("c.player_id, p.username, p.display_name").
		Order("total_score DESC, scored_bets DESC, p.username ASC")

	if sessionKey != nil {
		q = q.Where("c.schema::jsonb -> 'data' ->> 'session_key' = ?", *sessionKey)
	}
	if schemaName != nil {
		q = q.Where("c.schema_name = ?", *schemaName)
	}

	var rows []LeaderboardRow
	return rows, q.Scan(&rows).Error
}
```

- [ ] **Step 2: Service**

```go
// internal/service/leaderboard_service.go
package service

import (
	"context"

	"github.com/GypsyyCode/f1-tip-game/internal/repository"
)

type LeaderboardService interface {
	Get(ctx context.Context, sessionKey *int, schemaName *string) ([]repository.LeaderboardRow, error)
}

type leaderboardService struct {
	repo repository.LeaderboardRepository
}

func NewLeaderboardService(repo repository.LeaderboardRepository) LeaderboardService {
	return &leaderboardService{repo: repo}
}

func (s *leaderboardService) Get(_ context.Context, sessionKey *int, schemaName *string) ([]repository.LeaderboardRow, error) {
	return s.repo.Aggregate(sessionKey, schemaName)
}
```

- [ ] **Step 3: Handler**

```go
// internal/handler/leaderboard_handler.go
package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/GypsyyCode/f1-tip-game/internal/service"
)

type LeaderboardHandler struct {
	svc service.LeaderboardService
}

func NewLeaderboardHandler(svc service.LeaderboardService) *LeaderboardHandler {
	return &LeaderboardHandler{svc: svc}
}

// RegisterPublicRoutes registriert /leaderboard (öffentlich lesbar).
func (h *LeaderboardHandler) RegisterPublicRoutes(r *gin.RouterGroup) {
	r.GET("/leaderboard", h.Get)
}

func (h *LeaderboardHandler) Get(c *gin.Context) {
	var sessionKey *int
	if raw := c.Query("session_key"); raw != "" {
		k, err := strconv.Atoi(raw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_key"})
			return
		}
		sessionKey = &k
	}

	var schemaName *string
	if raw := c.Query("schema_name"); raw != "" {
		schemaName = &raw
	}

	rows, err := h.svc.Get(c.Request.Context(), sessionKey, schemaName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rows)
}
```

- [ ] **Step 4: Router + main.go verdrahten**

In `internal/router/router.go` im `public`-Block ergänzen:

```go
	h.Leaderboard.RegisterPublicRoutes(public)
```

In `main.go`:

```go
	leaderboardRepo := repository.NewLeaderboardRepository(db)
	leaderboardService := service.NewLeaderboardService(leaderboardRepo)
	// ...
	handlers := router.Handlers{
		// ... bestehende Felder + Scoring aus Task 5 ...
		Leaderboard: handler.NewLeaderboardHandler(leaderboardService),
	}
```

- [ ] **Step 5: Build + Smoke-Test**

Run: `cd ../../f1-tip-game && go build ./...`
Expected: Kein Fehler.

Run (nach einem Scoring-Lauf aus Task 5):
```bash
curl -s http://localhost:8080/api/v1/leaderboard | jq .
curl -s "http://localhost:8080/api/v1/leaderboard?session_key=9158" | jq .
curl -s "http://localhost:8080/api/v1/leaderboard?schema_name=myDriverPlacement" | jq .
```
Expected: JSON-Array mit `player_id`, `username`, `display_name`, `total_score`, `scored_bets`, absteigend nach `total_score`.

- [ ] **Step 6: Commit**

```bash
cd ../../f1-tip-game
git add internal/repository/leaderboard_repository.go \
        internal/service/leaderboard_service.go \
        internal/handler/leaderboard_handler.go \
        internal/router/router.go main.go
git commit -m "feat(leaderboard): public GET /leaderboard with session/schema filters

Aggregates SUM(score) per player over scored coupons, JOINs players
for username/display_name. Optional ?session_key= and ?schema_name=
query params. Public — anyone can view the ranking."
```

---

### Task 7: Frontend — Token in Coupon-POST mitsenden

**Files:**
- Modify: `src/plugins/coupons/useCoupon.ts`

- [ ] **Step 1: `useCoupon` zieht Token aus Auth-Store und reicht ihn an `create`**

Oben in `useCoupon.ts` den Import ergänzen:

```ts
import { useAuthStore } from '@/stores/auth'
```

In `useCoupon()` nach `const store = useCouponsStore()` einfügen:

```ts
	const auth = useAuthStore()
```

Den `create`-Aufruf in `submit()` ersetzen durch:

```ts
			const created = await create(coupon, auth.token ?? undefined)
```

- [ ] **Step 2: Type-Check**

Run: `npm run type-check`
Expected: Kein Fehler.

- [ ] **Step 3: Manuelle Verifikation**

Run: `npm run dev` und im Browser:
1. Ohne Login einen Tipp abgeben → DevTools Network → POST `/coupons/...` **ohne** `Authorization`-Header, 201.
2. Einloggen, Tipp abgeben → POST `/coupons/...` **mit** `Authorization: Bearer ...`, 201. Response-JSON zeigt `player_id` ≠ null.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/coupons/useCoupon.ts
git commit -m "feat(coupons): attach JWT to coupon POSTs when logged in

Reads auth.token from the pinia store inside useCoupon.submit() and
forwards it to the create() API call. Anonymous flow is unchanged
(token is undefined → no Authorization header)."
```

---

### Task 8: Frontend — Leaderboard-Client

**Files:**
- Create: `src/plugins/scores.ts`

- [ ] **Step 1: Client schreiben**

```ts
/**
 * Punkteliste / Leaderboard des F1-Tippspiels.
 *
 * Backend-Endpoint: GET /api/v1/leaderboard[?session_key=&schema_name=]
 * Antwort: Array absteigend nach total_score; player_id/username/display_name
 * identifizieren den Spieler, total_score ist die Summe über alle gewerteten
 * Coupons (score IS NOT NULL im Backend).
 */

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

export type LeaderboardRow = {
	player_id: number
	username: string
	display_name: string
	total_score: number
	scored_bets: number
}

export type LeaderboardFilter = {
	/** Nur Coupons dieser Session werten (default: alle Sessions). */
	sessionKey?: number
	/** Nur Coupons dieses Schemas (z. B. 'myDriverPlacement'). */
	schemaName?: string
}

/**
 * Holt die aggregierte Punkteliste. Keine Auth nötig (öffentlich lesbar).
 */
export async function getLeaderboard (filter: LeaderboardFilter = {}): Promise<LeaderboardRow[]> {
	const params = new URLSearchParams()
	if (filter.sessionKey) params.set('session_key', String(filter.sessionKey))
	if (filter.schemaName) params.set('schema_name', filter.schemaName)
	const qs = params.toString()
	const url = `${API_BASE}/api/v1/leaderboard${qs ? `?${qs}` : ''}`

	const res = await fetch(url)
	if (!res.ok) {
		const msg = await res.text().catch(() => res.statusText)
		throw new Error(`Punkteliste konnte nicht geladen werden (HTTP ${res.status}): ${msg}`)
	}
	return await res.json() as LeaderboardRow[]
}
```

- [ ] **Step 2: Type-Check**

Run: `npm run type-check`
Expected: Kein Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/scores.ts
git commit -m "feat(scores): leaderboard API client

Thin fetch wrapper for GET /api/v1/leaderboard with optional
session_key / schema_name filters. No auth needed."
```

---

### Task 9: Frontend — Punkteliste-Seite

**Files:**
- Create: `src/pages/punkteliste.vue`

- [ ] **Step 1: Seite anlegen**

Ganzer Datei-Inhalt — **mit TABs einrücken** (wie im Rest des Repos):

```vue
<template>
	<v-container fluid class="mt-8 h-full flex items-center w-full flex-col grow">
		<div class="flex flex-col grow w-full max-w-5xl mx-auto">
			<v-container>
				<v-card class="flex flex-col custom-height py-5 px-6 rounded-3xl" rounded="3xl" variant="flat">
					<div class="flex items-center justify-between mb-4">
						<div>
							<div class="text-[10px] tracking-[0.3em] text-neutral-500">F1 TIPSPIEL · PUNKTELISTE</div>
							<div class="text-2xl font-mono mt-1">Rangliste</div>
							<div v-if="session.session" class="text-sm text-neutral-600 mt-1">
								Aktuelle Session:
								<span class="font-semibold">{{ session.session.country_name }} · {{ session.session.session_name }}</span>
							</div>
						</div>

						<v-btn
							:loading="loading"
							:disabled="loading"
							variant="plain"
							prepend-icon="mdi-refresh"
							@click="load"
						>
							Aktualisieren
						</v-btn>
					</div>

					<!-- Filter -->
					<div class="flex flex-wrap gap-3 mb-4">
						<v-btn-toggle
							v-model="scope"
							density="compact"
							color="primary"
							mandatory
							variant="outlined"
						>
							<v-btn value="all">Gesamt</v-btn>
							<v-btn value="session" :disabled="!session.sessionKey">Aktuelle Session</v-btn>
							<v-btn value="mein-fahrer">Nur „Mein Fahrer"</v-btn>
						</v-btn-toggle>
					</div>

					<v-alert v-if="error" type="error" variant="tonal" class="mb-4">
						{{ error }}
					</v-alert>

					<!-- Podest -->
					<div v-if="podium.length > 0" class="grid grid-cols-3 gap-3 mb-5">
						<div
							v-for="(row, i) in podium"
							:key="row.player_id"
							class="rounded-2xl p-4 font-mono text-center"
							:style="{ background: positionColors[i] ?? '#eee' }"
						>
							<div class="text-[10px] tracking-[0.3em] text-neutral-800/70">P{{ i + 1 }}</div>
							<div class="text-lg font-semibold mt-1 truncate">
								{{ displayNameFor(row) }}
							</div>
							<div class="text-2xl mt-1">{{ row.total_score }} Pkt.</div>
							<div class="text-[10px] text-neutral-800/60 mt-1">
								{{ row.scored_bets }} gewertete Tipps
							</div>
						</div>
					</div>

					<!-- Tabelle -->
					<v-table density="compact" class="font-mono bg-transparent">
						<thead>
							<tr>
								<th class="text-left">#</th>
								<th class="text-left">Spieler</th>
								<th class="text-right">Punkte</th>
								<th class="text-right">Tipps</th>
							</tr>
						</thead>
						<tbody>
							<tr
								v-for="(row, i) in rest"
								:key="row.player_id"
								:class="{ 'bg-taupe-200': isMe(row) }"
							>
								<td>{{ i + 4 }}</td>
								<td>
									{{ displayNameFor(row) }}
									<span v-if="isMe(row)" class="text-[10px] tracking-[0.2em] text-neutral-500 ml-1">(DU)</span>
								</td>
								<td class="text-right">{{ row.total_score }}</td>
								<td class="text-right">{{ row.scored_bets }}</td>
							</tr>
							<tr v-if="rows.length === 0 && !loading">
								<td colspan="4" class="text-center text-neutral-500 py-6">
									Noch keine gewerteten Tipps.
								</td>
							</tr>
						</tbody>
					</v-table>
				</v-card>
			</v-container>
		</div>
	</v-container>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { getLeaderboard, type LeaderboardRow } from '@/plugins/scores'
import { positionColors } from '@/plugins/coupons/positionColors'
import { useAuthStore } from '@/stores/auth'
import { useSessionStore } from '@/stores/session'

const auth = useAuthStore()
const session = useSessionStore()

type Scope = 'all' | 'session' | 'mein-fahrer'
const scope = ref<Scope>('all')

const rows = ref<LeaderboardRow[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

async function load () {
	loading.value = true
	error.value = null
	try {
		rows.value = await getLeaderboard({
			sessionKey: scope.value === 'session' ? session.sessionKey || undefined : undefined,
			schemaName: scope.value === 'mein-fahrer' ? 'myDriverPlacement' : undefined,
		})
	} catch (e) {
		error.value = e instanceof Error ? e.message : String(e)
	} finally {
		loading.value = false
	}
}

onMounted(async () => {
	if (!session.session) await session.loadLatest()
	await load()
})

watch(scope, load)

const podium = computed(() => rows.value.slice(0, 3))
const rest = computed(() => rows.value.slice(3))

function displayNameFor (row: LeaderboardRow) {
	return row.display_name?.trim() ? row.display_name : row.username
}

function isMe (row: LeaderboardRow) {
	return auth.player?.id === row.player_id
}
</script>
```

- [ ] **Step 2: Type-Check**

Run: `npm run type-check`
Expected: Kein Fehler.

- [ ] **Step 3: Route prüfen**

`src/pages/*.vue` wird in diesem Projekt vermutlich über `unplugin-vue-router` oder `vite-plugin-pages` automatisch zu Routen gemappt (siehe andere Seiten, die ohne manuelle Router-Config erreichbar sind). Sichern:

Run: `grep -rn "vite-plugin-pages\|unplugin-vue-router\|VueRouter\|routes:" vite.config.* src/plugins/ 2>/dev/null | head -10`
Expected: Ein Treffer, der File-System-Routing bestätigt.

Falls **kein** File-System-Routing aktiv ist → in `src/router/index.ts` (oder dem jeweiligen Konfig-File) die neue Route `{ path: '/punkteliste', component: () => import('@/pages/punkteliste.vue') }` ergänzen, dann Type-Check wiederholen.

- [ ] **Step 4: Manuelle Verifikation**

Run: `npm run dev`, Browser auf `http://localhost:3000/punkteliste` (bzw. den tatsächlichen Dev-Port). Erwartet:
- Mit Daten: Podest (3 Karten in Gold/Silber/Bronze) + Tabelle.
- Ohne Daten: „Noch keine gewerteten Tipps."
- Eingeloggt: eigene Zeile mit `bg-taupe-200` + „(DU)"-Suffix.
- Toggle „Aktuelle Session" / „Nur Mein Fahrer" → `scores.ts` wird neu aufgerufen, Rows ändern sich.

- [ ] **Step 5: Commit**

```bash
git add src/pages/punkteliste.vue
git commit -m "feat(punkteliste): ranking page with podium, filters, self-highlight

Fetches /api/v1/leaderboard, shows top-3 as a podium colored via
positionColors (gold/silver/bronze), rest as table, highlights the
current user's row via auth.player.id. Toggle between overall /
current session / mein-fahrer-only."
```

---

### Task 10: Frontend — Nav-Eintrag

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: Punkteliste in Nav-Gruppe „Mein Fahrer" ganz oben einfügen**

In `src/App.vue` die Nav-Gruppe `Mein Fahrer` ersetzen durch:

```ts
	{
		title: 'Mein Fahrer',
		items: [
			{ to: '/punkteliste', exact: false, label: 'Punkteliste', icon: 'mdi-trophy-award' },
			{ to: '/mein-fahrer', exact: false, label: 'Mein Fahrer', icon: 'mdi-account-star' },
			{ to: '/driver-championship', exact: false, label: 'Fahrer-WM', icon: 'mdi-trophy' },
			{ to: '/constructor-championship', exact: false, label: 'Konstrukteurs-WM', icon: 'mdi-car-sports' },
		],
	},
```

> **Hinweis:** Vorhandene Datei nutzt 2-Space Indent im `<script>`-Block (siehe `onLogout`), aber TAB im Rest. Die Einrückung **genauso lassen, wie sie im File ist** — nicht neu formatieren. Falls das Original die Gruppe mit 6 Spaces einrückt, auch den Ersatz mit 6 Spaces.

- [ ] **Step 2: Type-Check + visuelle Prüfung**

Run: `npm run type-check`
Expected: Kein Fehler.

Run: `npm run dev` → Drawer öffnen → „Punkteliste" ganz oben in Gruppe „Mein Fahrer", Klick navigiert zur neuen Seite.

- [ ] **Step 3: Commit**

```bash
git add src/App.vue
git commit -m "feat(nav): add Punkteliste entry to Mein-Fahrer group"
```

---

### Task 11: End-to-End-Verifikation

Keine Code-Änderungen — nur ein vollständiger Durchlauf, der das ganze Feature zusammen prüft.

- [ ] **Step 1: Backend starten**

Run: `cd ../../f1-tip-game && docker-compose up -d && go run .`
Erwartet: Server läuft auf :8080, `AutoMigrate` loggt die `coupons`-Tabelle mit `player_id` + `score`.

- [ ] **Step 2: FE starten**

Run: `npm run dev`
Erwartet: Vite-Server läuft, keine Konsolen-Fehler.

- [ ] **Step 3: Test-User registrieren + einloggen (im UI)**

Über `/login` → Register → zweiten User registrieren → einloggen.

- [ ] **Step 4: Tipps abgeben (eingeloggt)**

Mit beiden Usern je einen Top-3-Tipp und einen Mein-Fahrer-Tipp abgeben. In DevTools → Network → POST `/coupons/...` muss `Authorization: Bearer ...` enthalten. Response-JSON zeigt `player_id`.

- [ ] **Step 5: Results + Scoring triggern (Admin-User nötig)**

```bash
# Admin-Token holen (Admin-User muss in DB existieren mit role='admin')
ADMIN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<pw>"}' | jq -r .token)

# Results für die relevante Session syncen
curl -s -X POST http://localhost:8080/api/v1/results/<sessionKey>/sync \
  -H "Authorization: Bearer $ADMIN"

# Scoring auslösen
curl -s -X POST http://localhost:8080/api/v1/scoring/<sessionKey> \
  -H "Authorization: Bearer $ADMIN" | jq .
```
Erwartet: `{ "session_key": ..., "scored_coupons": <n> }` mit n ≥ 1.

- [ ] **Step 6: Punkteliste prüfen**

Browser `/punkteliste` → beide User tauchen auf, einer in Podium (P1 gold), eigene Zeile hervorgehoben. Toggle „Nur Mein Fahrer" filtert korrekt.

- [ ] **Step 7: Dokumentation aktualisieren**

Den Plan-Status-Hinweis in `docs/superpowers/plans/2026-10-21-scoring-leaderboard.md` ersetzen durch einen Link auf diesen Umsetzungsplan + Commit-Range:

```md
> Status: **umgesetzt** (Variante C). Siehe
> [2026-10-23-scoring-leaderboard-impl.md](./2026-10-23-scoring-leaderboard-impl.md).
> MVP-Umfang: top3/top10/myDriverPlacement scoren tatsächlich; weitere
> Schemas liefern 0 bis die Datenquellen (Qualifying-P1, DotD, Lap-Zeiten,
> Saison-Ende) angebunden sind.
```

- [ ] **Step 8: Commit (nur Doc)**

```bash
git add docs/superpowers/plans/2026-10-21-scoring-leaderboard.md
git commit -m "docs(plans): mark Phase 3b scoring/leaderboard as implemented"
```

---

## Offene Punkte (nicht Teil dieses Plans)

- **Weitere Schemas scoren.** `polePosition`, `fastestLap`, `firstDnf`, `driverOfTheDay`, `teamDuell`, `driverChampionship`, `constructorChampionship`. Pole = P1 der Qualifying-Session (Starting-Grid-Repo liefert's bereits). DotD / schnellste Runde / erster DNF brauchen eigene OpenF1-Felder (Verfügbarkeit prüfen). Championships: Saison-Ende, Trigger separat.
- **Punkte in `meinFahrer.vue`.** Timeline des Saison-Fahrers könnte pro vergangenem Rennen die eigenen `myDriverPlacement`-Punkte zeigen. Braucht einen weiteren Endpoint `GET /api/v1/leaderboard/me?schema_name=myDriverPlacement` oder einen zusätzlichen Filter `?player_id=`.
- **Admin-UI für Scoring.** Momentan nur per `curl`. Ein kleiner Admin-Button im Starting-Grid (wo Session-Sync schon da ist) wäre naheliegend.
