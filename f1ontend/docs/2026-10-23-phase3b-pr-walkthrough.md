# Phase 3b — Scoring & Punkteliste · PR-Walkthrough

Hi, hier ist meine Erklärung zu Phase 3b. Ich habe versucht, es so aufzuschreiben, dass du nicht die ganzen 13 Commits einzeln lesen musst, um zu verstehen, was warum passiert ist. Wo ich mir noch unsicher bin, markiere ich das explizit mit „🤔".

**Branches:**
- Frontend: `phase3b-scoring` → PR: https://github.com/GypsyyCode/f1ontend/pull/new/phase3b-scoring
- Backend:  `phase3b-scoring` → PR: https://github.com/GypsyyCode/f1-tip-game/pull/new/phase3b-scoring

**Was man im Browser sieht nach dem Merge:** eine neue Seite `/punkteliste` mit Podium + Tabelle, eine neue Nav-Zeile ganz oben in „Mein Fahrer", und — nur für Admins — einen Button „Scoring auslösen" auf der Punkteliste-Seite.

---

## Was war das Problem?

Vor Phase 3b konnte man im Frontend tippen, aber kein Tipp gehörte zu einer Person und kein Tipp hatte je einen Score. Der Backend-Code hatte zwei parallele Welten:

1. `coupons/*` → generisch, **global**, ohne Nutzerbezug. Davon lebt das FE komplett.
2. `wettscheine/*` → mit `PlayerID`, mit `Punkte`-Feld, aber **vom FE ungenutzt**.

Die Design-Diskussion ist dokumentiert in `docs/superpowers/plans/2026-10-21-scoring-leaderboard.md` (Weggabel A/B/C). Wir haben uns für **Variante C — schlanker Hybrid** entschieden: Coupons bleiben der Tipp-Inhalt, bekommen aber ein **optionales** `player_id` + ein `score`-Feld. Das heißt: anonymes Tippen bleibt wie es war, und wer eingeloggt tippt, taucht in der Rangliste auf.

Der Umsetzungsplan (`docs/superpowers/plans/2026-10-23-scoring-leaderboard-impl.md`) hat das in 11 Tasks zerlegt.

---

## Backend — Walkthrough

Repo: `f1-tip-game`, Branch `phase3b-scoring`. Commits chronologisch:

### 1. `58ac6ae` — `feat(coupons): add nullable player_id + score to CouponBase`

Zwei neue Spalten auf `CouponBase[T]`:

```go
PlayerID *uint `gorm:"index" json:"player_id,omitempty"`
Score    *int  `gorm:"index" json:"score,omitempty"`
```

**Warum Pointer?** `*uint` / `*int` sind nullable in GORM, Werttypen (`uint` / `int`) nicht. `nil` = anonymer Tipp bzw. noch nicht gewertet. Bestehende Zeilen bekommen durch `AutoMigrate` NULL in beiden Spalten — kein Datenverlust, kein Migration-Script nötig.

**Warum `gorm:"index"`?** Die Punkteliste macht `SUM(score) GROUP BY player_id` — ohne Index wäre das ein Full-Table-Scan. Ich halte Index-Entscheidungen bei nullable Spalten für diskutabel; die Index-Kardinalität ist natürlich geringer, wenn viele Zeilen NULL sind. 🤔 Lässt sich später droppen, wenn sich zeigt, dass es nix bringt.

### 2. `3d8b225` — `feat(auth): optional-auth middleware with playerID in request ctx`

Das ist meiner Meinung nach **die wichtigste architektonische Entscheidung** in diesem PR. Ich erkläre erst das Problem.

Das Backend nutzt Gin für die meisten Routen, aber **Coupons** laufen über einen `net/http.ServeMux`, der in Gin eingehängt wird:

```go
r.Any("/api/v1/coupons/*path", gin.WrapH(mux))
```

Die bestehende `AuthMiddleware` ist eine Gin-Middleware und arbeitet mit `gin.Context`. Sie zu benutzen würde zwei Probleme machen:
1. Sie 401t ohne Token — wir wollen anonymes Tippen aber behalten.
2. Selbst wenn man sie laxer baut: `gin.WrapH(mux)` reicht an den `http.Handler` nur den `*http.Request` weiter. Der Gin-Context ist für den Mux-Handler nicht erreichbar.

Lösung: eine Middleware, die bei gültigem Token **beides** macht — Gin-Context UND Request-Context:

```go
c.Set("playerID", claims.PlayerID)
c.Set("role", claims.Role)
c.Request = c.Request.WithContext(WithPlayerID(c.Request.Context(), claims.PlayerID))
```

Ohne/mit ungültigem Token: einfach `c.Next()` — kein 401. Der Coupon-Handler kann dann `auth.PlayerIDFromContext(r.Context())` nutzen.

Ich habe TDD gefahren (3 Tests: kein Token, gültiger Token, ungültiger Token). Hat sich gelohnt — ich hatte in der ersten Version vergessen, dass `strings.HasPrefix` für den leeren Header auch false liefert, und wollte das als Edge-Case extra abfragen. Der Test „kein Token" hat gezeigt, dass die eine Prüfung reicht.

🤔 **Context-Key-Typ:** Ich habe einen privaten `ctxKey int` genommen (`playerIDCtxKey ctxKey = 1`). Das ist das klassische Go-Pattern gegen Context-Key-Collisions. Alternativ hätte man einen String-Key nutzen können — fände ich hässlicher, aber ist Geschmack.

### 3. `f5b97af` — `feat(coupons): attach player_id on POST when optional token present`

Drei kleine Änderungen, die zusammen das Attribution-Feature scharf schalten:

**Router** (`internal/router/router.go`): Coupons werden nicht mehr direkt eingehängt, sondern in eine eigene Gruppe mit Optional-Auth:

```go
couponsGroup := r.Group("/api/v1/coupons")
couponsGroup.Use(auth.OptionalAuthMiddleware(jwtManager))
couponsGroup.Any("/*path", gin.WrapH(mux))
```

`entrant` bleibt unverändert — wir wollen die Middleware nur vor den Coupons.

**Service** (`coupons/service.go`): `Create` nimmt jetzt ein `playerID *uint`. Da `Service.Create` nur einen Caller hat (den `handler.create`), ist die breakende Signatur-Änderung okay.

**Handler** (`coupons/handler.go`):
```go
var playerID *uint
if pid, ok := auth.PlayerIDFromContext(r.Context()); ok {
    playerID = &pid
}
c, err := h.svc.Create(r.Context(), req.Schema, playerID)
```

Das Pattern „`var ptr *T; if (v, ok := ...); ptr = &v`" ist das, was man in Go nutzt, um ein optionales Pointer-Feld aus einem Nicht-Pointer-Wert zu bauen. Ja, man könnte `coupons.Service.Create` auch zwei Argumente geben (`playerID uint, hasPlayer bool`) — fand ich klobiger als ein `*uint`.

### 4. `05ad076` — `feat(scoring): per-schema score functions for top3/top10/myDriver`

Neues Package `coupons/scoring`. Rein funktional, kein DB-Zugriff, perfekt für TDD. 8 Tests.

**Punkte-Regel (MVP):**
- Pro Platzierung: exakt = 3 Pkt, ±1 Position = 1 Pkt, sonst 0.
- Fahrer mit `Position == nil` (DNF/DNS/DSQ ohne gezählten Platz) = 0.

**Design:**

```go
func positionByDriver(results []models.Result) map[int]int { ... }
func scorePlacement(tipped int, actual int) int { ... }       // 3/1/0
func scorePlacementList(placements, results) int              // Hilfs-Loop
```

Dann die drei öffentlichen Funktionen `ScoreTop3`, `ScoreTop10`, `ScoreMyDriverPlacement` — alle delegieren an `scorePlacementList` bzw. direkt an `scorePlacement`. Ich finde das sauber, weil die Regel nur einmal lebt. 🤔 Man könnte argumentieren, dass `ScoreTop3`/`ScoreTop10` so dünn sind, dass sie wegabstrahiert werden könnten (per `[]coupons.Placement`-Interface auf Schema). Habe ich bewusst nicht gemacht — die Schema-Typen sind nicht einheitlich (`MyDriverPlacementSchema` hat kein `Placements`-Feld, sondern direkt `DriverId`/`Position`), und ich finde die drei expliziten Funktionen besser lesbar als ein generisches `Score(any, results)`.

**Was fehlt:** `polePosition`, `fastestLap`, `firstDnf`, `driverOfTheDay`, `teamDuell`, beide Championships. Jedes braucht entweder eine andere Datenquelle (Quali-P1, Lap-Zeiten, DotD-Feld) oder einen Saison-Trigger. Der Dispatcher in Task 5 gibt für die `(0, false)` zurück → kein Score geschrieben. Dokumentiert als TODO im Code + in den „Offene Punkte" im Plan.

### 5. `794a47f` — `feat(scoring): service + admin trigger POST /scoring/:sessionKey`

**Service** (`coupons/scoring/service.go`):

```go
type ResultsLoader interface {
    FindBySession(sessionKey int) ([]models.Result, error)
}
type Service struct { db *gorm.DB; results ResultsLoader }
```

`ResultsLoader` ist bewusst ein kleines Interface, nicht der ganze `repository.ResultRepository`. Macht den Service testbar, auch wenn ich hier noch keine Service-Tests geschrieben habe (die wären gegen eine In-Memory-DB oder einen Mock sinnvoll — habe ich mir für später aufgehoben). Die konkrete `ResultRepository` erfüllt das Interface strukturell (Duck Typing in Go), also kann `main.go` einfach `resultRepo` reinreichen.

**`ScoreSession(ctx, sessionKey)`:**
1. `FindBySession(sessionKey)` — alle `models.Result` dieser Session.
2. Wenn leer: Fehler „no results stored for session X — run /results/:sessionKey/sync first". Das ist bewusst eine helpful error message, weil der Scoring-Flow nur mit vorab synchronisierten Ergebnissen funktioniert.
3. Alle Coupons laden, die diesen `session_key` im JSONB-Schema haben:

```go
.Where("schema::jsonb -> 'data' ->> 'session_key' = ?", fmt.Sprint(sessionKey))
```

Das `->` navigiert, `->>` extrahiert als Text. Der Vergleich ist stringbasiert (deswegen `fmt.Sprint`) — JSONB speichert Zahlen auch als Zahlen, aber `->>` castet immer zu Text.

4. Pro Zeile `scoreOne(schemaName, schema, results)` aufrufen. Das deserialisiert `schema.data` typisiert passend zum SchemaName und ruft die Funktion aus Commit 4.
5. `UPDATE coupons SET score = ? WHERE id = ?`.

🤔 **Was ich hier etwas unsauber finde:** Ich lade die Coupons über eine `.Table("coupons")`-Query ohne das generische `CouponBase[T]`, weil GORM mit `T = any` nicht glücklich ist. Deswegen hole ich nur `id, schema_name, schema` als `[]byte` raw und deserialisiere im `scoreOne` von Hand. Fühlt sich ein bisschen „an GORM vorbei" an. Alternative wäre eine View oder ein zweiter nicht-generischer Repo-Typ. Bin offen für Vorschläge.

🤔 **Transaktion:** Scoring ist aktuell nicht transaktional — wenn ein `UPDATE` zwischen zwei Coupons fehlschlägt, haben wir inkonsistenten Zwischenzustand. Rein praktisch würde man die Scoring-Operation einfach noch mal laufen lassen (sie ist idempotent — gleicher Input = gleicher Score), aber eine Transaktion wäre sauberer. Verlagert auf später.

**Handler** (`internal/handler/scoring_handler.go`): Dünne HTTP-Schicht. Admin-geschützt (via Router-Gruppe). Antwort: `{session_key, scored_coupons}`.

### 6. `329417e` — `feat(leaderboard): public GET /leaderboard with session/schema filters`

Drei Dateien (Repo + Service + Handler), weil ich dem bestehenden Pattern (`internal/repository/*`, `internal/service/*`, `internal/handler/*`) gefolgt bin.

**Query** (`LeaderboardRepository.Aggregate`):

```sql
SELECT c.player_id, p.username, p.display_name,
       COALESCE(SUM(c.score), 0) AS total_score,
       COUNT(c.id)                AS scored_bets
FROM coupons c
JOIN players p ON p.id = c.player_id
WHERE c.player_id IS NOT NULL AND c.score IS NOT NULL
GROUP BY c.player_id, p.username, p.display_name
ORDER BY total_score DESC, scored_bets DESC, p.username ASC
```

Optional gefiltert auf `session_key` (gleicher JSONB-Trick wie beim Scoring-Service) oder auf `schema_name` (direkte Spalte).

**Sortierung:** `total_score DESC` primär, bei Gleichstand `scored_bets DESC` (mehr Tipps = besser gewichtet), dann alphabetisch. Falls wir echten „Tiebreaker"-Bedarf haben, lässt sich das anpassen.

**Public, kein Auth.** Jeder soll die Rangliste sehen können — Sinn des Tippspiels ist Transparenz. Das ist auch die Grundlage dafür, dass die FE-Seite ohne Login funktioniert.

🤔 **`display_name` kann leer String sein** (DB-Default). Das Repo gibt es trotzdem zurück und das Frontend fällt dann auf `username` zurück. Alternativ hätte man `COALESCE` im SQL machen können — fand ich auf FE-Seite expliziter.

---

## Frontend — Walkthrough

Repo: `f1ontend`, Branch `phase3b-scoring`.

### 7. `90c18dc` — `feat(coupons): attach JWT to coupon POSTs when logged in`

Drei-Zeilen-Change in `src/plugins/coupons/useCoupon.ts`:

```ts
import { useAuthStore } from '@/stores/auth'
// ...
const auth = useAuthStore()
// ...
const created = await create(coupon, auth.token ?? undefined)
```

Warum nicht `|| undefined`? Weil `auth.token` den Typ `Ref<string | null>` hat. Beide operatoren verhalten sich hier gleich (leerer String ist nicht möglich → wir setzen entweder einen echten Token oder `null`), aber `??` ist präziser in der Intention.

Das war's — der Rest der Pipeline (`create()` in `src/plugins/coupon.ts`) akzeptiert bereits `token?: string` und setzt den `Authorization`-Header nur wenn truthy. Da waren schon Vor-Phasen vorausschauend.

### 8. `f858f5e` — `feat(scores): leaderboard API client`

Neue Datei `src/plugins/scores.ts`. Pattern wie `auth.ts`, `coupon.ts`, `startingGrid.ts`:
- `API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'`
- Ein `type LeaderboardRow` der die Backend-JSON-Form 1:1 widerspiegelt (snake_case Keys, weil sie direkt aus `JSON.parse` kommen)
- Ein `type LeaderboardFilter` mit camelCase (idiomatisch für TS) — die Funktion mappt beim Serialisieren.

```ts
export async function getLeaderboard (filter: LeaderboardFilter = {}): Promise<LeaderboardRow[]>
```

Beim späteren Admin-Button-Commit (`ee207ec`) kam `triggerScoring(sessionKey, token)` + `type ScoringResult` dazu — gleicher Stil.

### 9. `ce73a0f` — `feat(punkteliste): ranking page with podium, filters, self-highlight`

Die eigentliche UI. Ich habe mich eng an `wettschein.vue` orientiert, weil ich finde, dass das Projekt eine einheitliche Design-Sprache hat:

- Card mit `.custom-height` (die SCSS-Utility, die wir in `main.scss` haben)
- „F1 TIPSPIEL · PUNKTELISTE"-Eyebrow in `text-[10px] tracking-[0.3em] text-neutral-500`
- Refresh-Button mit `variant="plain"` + `mdi-refresh`

**Podium:** drei Karten mit `:style="{ background: positionColors[i] }"` — damit kriegen die Top-3 die gleichen Gold/Silber/Bronze-Farben wie die Positions-Legende auf dem Wettschein. Visuelle Konsistenz.

**Self-Highlight:** Spielerzeilen in der Tabelle bekommen `bg-taupe-200` + ein `(DU)`-Suffix wenn `auth.player?.id === row.player_id`. Gleicher Taupe-Ton wie die restlichen List-Items im Repo.

**Filter:** `v-btn-toggle` mit drei Werten (`all` / `session` / `mein-fahrer`). `watch(scope, load)` löst bei Toggle den API-Call neu aus. Session-Filter ist disabled, wenn der Session-Store noch keine aktive Session hat.

🤔 **Zu wenig geprüft:** Empty-Case habe ich mit einer Zeile „Noch keine gewerteten Tipps" bedacht, aber Fehler-States sind nur ein `v-alert` am oberen Rand. Ein Netzwerkabbruch mitten im Toggle würde den Zustand zurücklassen. Reicht fürs MVP.

**Routing:** Ich hatte zuerst gedacht, das Projekt nutzt `vite-plugin-pages` (File-System-Routing). Hat es nicht — es gibt eine manuelle `src/router/index.ts`. Also habe ich dort einen Import + einen Routes-Eintrag hinzugefügt. (Die IDE-gopls-Warnungen zu `@/pages/*.vue`-Imports waren Stale-Caching; `npm run type-check` lief trotzdem grün.)

### 10. `b79a9a1` — `feat(nav): add Punkteliste entry to Mein-Fahrer group`

Einzeilen-Change in `App.vue`:

```ts
{ to: '/punkteliste', exact: false, label: 'Punkteliste', icon: 'mdi-trophy-award' },
```

Als **erster** Eintrag in Gruppe „Mein Fahrer" — der Rank ist das primäre „Was-habe-ich-erreicht"-Signal, deswegen oben. Icon `mdi-trophy-award` statt `mdi-trophy` (`mdi-trophy` ist schon für „Fahrer-WM" belegt).

### 11. `ee207ec` — `feat(punkteliste): admin button to trigger scoring for current session`

Was-fehlt-noch-Commit nachdem die Grundfunktion stand. Zwei Änderungen:

**Client** (`src/plugins/scores.ts`): neue Funktion `triggerScoring(sessionKey, token)` die den bestehenden Admin-Endpoint callt.

**Page** (`src/pages/punkteliste.vue`): Button nur wenn `auth.player?.role === 'admin'`. Zeigt sich neben dem Refresh-Button. Nach Erfolg: Success-Alert mit der Anzahl gewerteter Coupons, danach `await load()` zum Refreshen der Punkteliste.

🤔 **Role-Check nur im Frontend:** Der Button ist nur sichtbar für Admins, aber das Backend prüft die Rolle sowieso (admin-Group mit `RequireAdmin()`-Middleware). Wenn ein Nicht-Admin mit DevTools den Button sichtbar machen würde und drückt, bekommt er 403. Doppelte Prüfung ist hier bewusst — FE-Check für die UX (nichts anzeigen was man nicht benutzen kann), BE-Check für die Sicherheit.

---

## Was ich **nicht** gemacht habe (bewusst)

Alles davon steht im „Offene Punkte"-Abschnitt des Umsetzungsplans — ich halte es für wichtig, das transparent zu halten:

1. **Scoring für die anderen Wettarten.** Pole/FastestLap/FirstDnf/DotD/TeamDuell/Championships werden noch nicht gewertet. Jedes braucht eine eigene Datenquelle. Keine wartet unmittelbar — der Flow „tippen → gewertet werden" funktioniert für die drei MVP-Schemas, und das sind die mit der höchsten Spiel-Frequenz.
2. **Scoring-Service-Tests.** Pure Funktionen (`ScoreTop3` etc.) sind getestet, der Service (DB-Dispatch) nicht. Dafür bräuchte ich eine Test-DB oder einen Mock-DB-Treiber.
3. **Transaktionen** beim Scoring (siehe oben).
4. **Punkte im Mein-Fahrer-Timeline.** Wäre eine schöne Ergänzung, braucht aber einen weiteren Filter auf `/leaderboard?player_id=` o. ä.
5. **E2E-Test.** Konnte ich nicht autonom laufen lassen (brauche Docker + Admin-User). Habe für dich eine Checkliste zum Durchspielen hinterlassen.

---

## Review-Fokus — wo ich am ehesten was übersehen habe

Wenn du nur begrenzt Zeit hast, würde ich mir in dieser Reihenfolge Feedback wünschen:

1. **`coupons/scoring/service.go:ScoreSession`** — JSONB-Query + raw-Row-Dispatch (Commit 5). Das ist der heikelste Teil.
2. **`internal/auth/optional_middleware.go`** — der Dual-Context-Trick (Commit 2). Habe ich das Edge-Case-Verhalten korrekt getroffen?
3. **`internal/repository/leaderboard_repository.go`** — die Aggregat-Query (Commit 6), insbesondere Sortierreihenfolge und `COALESCE`.
4. Alles andere ist entweder Convention-Following oder reines Plumbing.

Danke fürs Reviewen 🙂
