# Phase 3b: Scoring-Engine & Punkteliste (Leaderboard)

> Status: **umgesetzt (Variante C: Hybrid), E2E-Verifikation steht aus.** Siehe
> den Umsetzungsplan unter
> [2026-10-23-scoring-leaderboard-impl.md](./2026-10-23-scoring-leaderboard-impl.md)
> (Branch `phase3b-scoring` in beiden Repos). MVP-Umfang: `top3coupon` /
> `top10coupon` / `myDriverPlacement` werden tatsächlich gewertet; `polePosition`,
> `fastestLap`, `firstDnf`, `driverOfTheDay`, `teamDuell` und beide Championship-
> Wetten liefern aktuell 0, bis die Datenquellen (Qualifying-P1, DotD, Lap-Zeiten,
> Saison-Ende) angebunden sind.

## Ausgangslage (verifiziert im Backend `../../f1-tip-game`)

- **Zwei parallele Wett-Systeme:**
  1. `coupons` (generisch, `coupons/*`): global, **nicht** nutzergebunden. **Das Frontend
     nutzt ausschließlich dieses System.** Route `/api/v1/coupons/{category}/{schemaName}`,
     öffentlich (ohne Auth).
  2. `Wettschein`/`Wette` (`internal/models/wettschein.go`): **nutzergebunden** (`PlayerID`),
     hat ein Feld `Punkte *int`. Routen `/api/v1/wettscheine` (auth-geschützt). **Vom
     Frontend aktuell ungenutzt.**
- **Auth/Player ist vollständig vorhanden** (JWT, register/login, Middleware). Frontend-Auth
  ist jetzt angebunden (`src/stores/auth.ts`, `src/pages/login.vue`).
- **Scoring existiert NICHT:** `coupons.ResultBase[T].Score` ist nur ein Feld, wird nie
  berechnet. Keine Scoring-Service-Logik, kein Trigger-Endpoint.
- **Ergebnisse vorhanden:** `result_service.FetchAndStoreResults(sessionKey)` holt echte
  Session-Ergebnisse von OpenF1 (`models.Result`: Position, Points, DNF, …), admin-Route
  `POST /api/v1/results/:sessionKey/sync`.
- **Leaderboard-Endpoint existiert NICHT.**

## Die Weggabelung (muss vor der Umsetzung entschieden werden)

Ein Multi-User-Ranking braucht **nutzergebundene, gewertete Tipps**. Die Coupons sind aber
global. Optionen:

- **(A) Coupons nutzergebunden machen.** `player_id` an `CouponBase` ergänzen, Coupon-POST
  hinter Auth hängen, Scoring + Leaderboard über Coupons. → **Ändert den aktuell anonymen
  Flow** (Tippen erfordert dann Login). Wenig FE-Umbau (bestehende Seiten bleiben, nur Token
  mitsenden + Login erzwingen).
- **(B) Auf das `Wettschein`-System wechseln.** Es ist genau dafür gebaut (PlayerID +
  Punkte). → Großer **Frontend**-Umbau (alle Wett-Composables/Seiten müssten von `coupons`
  auf `wettscheine` migrieren).
- **(C) Empfehlung – schlanker Hybrid:** Coupons bleiben der „Tipp-Inhalt". `player_id`
  **optional** an Coupons ergänzen (default null = anonym, bricht nichts). Neuer
  Scoring-Service wertet Coupons mit `player_id` + `session_key` gegen `models.Result`.
  Leaderboard aggregiert über gewertete Coupons je Player. Frontend sendet den (bereits
  vorhandenen) JWT bei Coupon-POST mit, sobald eingeloggt. → Kleinste Störung des laufenden
  Systems, baut auf allem Bestehenden auf.

Der Plan unten setzt **(C)** um.

## Backend-Aufgaben (Repo `../../f1-tip-game`, verifizieren mit `go build ./...` + lokal `docker-compose up`)

1. **`player_id` (optional) an Coupons.** `CouponBase` um `PlayerID *uint` erweitern; im
   `coupons`-Handler `create` die PlayerID aus dem (optionalen) Auth-Context ziehen. Coupon-
   Routen von „public mux" in die `protected`/optional-auth-Gruppe heben (oder Middleware so,
   dass Token optional ist). AutoMigrate zieht die Spalte.
2. **Scoring-Service** (`coupons/scoring.go` o. ä.): Funktion je `schemaName`, die aus
   Schema-Daten + `[]models.Result` der Session den `Score` berechnet:
   - `top3coupon`/`top10coupon`: je Position exakt = 3, ±1 = 1, sonst 0.
   - `myDriverPlacement`: exakt = 3, ±1 = 1, sonst 0.
   - `polePosition`/`fastestLap`/`firstDnf`/`driverOfTheDay`: Treffer = feste Punkte, sonst 0
     (benötigt passende Ergebnisquellen; Pole = Quali-P1, FastestLap/DotD ggf. separate
     OpenF1-Felder – hier Datenverfügbarkeit prüfen).
   - Championship/TeamDuell: Saison-Ende.
3. **Trigger-Endpoint** (admin): `POST /api/v1/scoring/:sessionKey` → lädt Ergebnisse
   (bzw. nutzt gespeicherte), berechnet + persistiert Scores je Coupon der Session.
4. **Leaderboard-Endpoint** (public oder auth): `GET /api/v1/leaderboard[?session_key=]` →
   Summe der Coupon-Scores je Player, sortiert absteigend, mit Anzeige-Name. Optional Filter
   auf eine Session oder nur `myDriverPlacement`.

## Frontend-Aufgaben (verifizieren mit `npm run type-check` + `npm run build`)

1. **Token mitsenden:** In `src/plugins/coupon.ts` (`create`/`listCoupons`) und den
   Composables den JWT aus `useAuthStore()` übergeben (Parameter existiert bereits). Nur
   eingeloggt → Coupon wird dem Player zugeordnet.
2. **`src/plugins/scores.ts`:** Client für `GET /api/v1/leaderboard`.
3. **`src/pages/punkteliste.vue`:** Ranking-Seite – Top-3 als Podest (nutzt `positionColors`
   Gold/Silber/Bronze), darunter Tabelle, **eigene Zeile hervorgehoben** (via `auth.player`).
   Filter Gesamt / Session / nur „Mein Fahrer".
4. **Nav:** Eintrag „Punkteliste" in der Gruppe „Übersicht" (`src/App.vue`).
5. **Mein-Fahrer-Timeline + Coupon-Punkte:** sobald `GET /leaderboard` bzw. ein
   Coupon-Score-Feld vorliegt, die Punkte in `meinFahrer.vue` (Saison-Verlauf) und ggf. im
   Wettschein anzeigen.

## Verifikation (end-to-end)

`docker-compose up` im Backend; FE gegen `VITE_API_URL`. Registrieren → einloggen → Tipp
abgeben (Coupon trägt player_id) → `POST /results/:sessionKey/sync` → `POST
/scoring/:sessionKey` → `GET /leaderboard` zeigt Punkte; eigene Zeile hervorgehoben.

## Offene Datenfragen

- Liefert OpenF1 „Fahrer des Tages" / „schnellste Runde" zuverlässig? Falls nein, diese zwei
  Wettarten erst scoren, wenn die Datenquelle steht (Tipp-Abgabe funktioniert schon).
- Pole = P1 der Qualifying-Session (Startaufstellung ist bereits verfügbar).
