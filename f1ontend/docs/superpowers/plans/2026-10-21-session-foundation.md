# Phase 1: Session-Fundament – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Einen geteilten, app-weiten Session-Zustand einführen, damit Renn-Wetten wissen, für welche F1-Session getippt wird, und ihn als Fundament für das spätere Scoring (`session_key`) sowie eine Lock-Anzeige nutzbar machen.

**Architecture:** Neuer Pinia-Setup-Store `session` als **einzige Quelle** für die aktive Session (`SessionInfo` + `session_key`), persistiert über das bestehende `piniaIdb`-Plugin. `useStartingGrid` wird darauf umgestellt (statt des bisherigen `settings.startingGridSessionKey`). Renn-Coupon-Builder (Top 3 / Top 10) bekommen über einen optionalen `CouponContext` einen `session_key` in die Payload. `BetCard` zeigt die aktive Session an und sperrt die Abgabe, sobald die Session begonnen hat.

**Tech Stack:** Vue 3 (Composition API), Pinia (Setup-Stores), TypeScript, Vuetify 3, Tailwind. Kein Unit-Test-Runner im Projekt → Verifikation durch `npm run type-check` und manuelles `npm run dev`.

> **WICHTIG – Code-Stil & Lint:** Das gesamte Repo ist mit **TABs** eingerückt. `npm run lint` (`eslint-config-vuetify`) schlägt **repo-weit** fehl (es erwartet 2-Space) und ist **kein** brauchbares Gate. Darum: **mit TABs schreiben** (wie alle Bestandsdateien), `catch (e)` beibehalten, und **niemals `eslint`/`npm run lint:fix` ausführen** – das würde Bestandsdateien massenhaft auf 2-Space umformatieren und riesige Fremd-Diffs erzeugen. Einziges Gate: `npm run type-check`.

**Backend-Hinweis:** Das Go-Backend (`../../f1-tip-game`) dekodiert Coupon-JSON in typisierte Structs **ohne** `DisallowUnknownFields` → ein zusätzliches `session_key`-Feld in `schema.data` wird aktuell **ignoriert** (bricht nichts), aber erst gespeichert/verwertet, wenn in Phase 0 das jeweilige Schema-Struct (z. B. `race.Top3Schema`) das Feld erhält. Task 3 legt also die Frontend-Seite der Naht an.

---

## File Structure

- Create: `src/stores/session.ts` — geteilter Session-Store (aktive `SessionInfo`, `session_key`, `isStarted`).
- Modify: `src/plugins/coupons/useStartingGrid.ts` — Session-Key aus dem neuen Store statt aus `settings`.
- Delete: `src/stores/settings.ts` — enthielt nur noch `startingGridSessionKey`, jetzt obsolet.
- Modify: `src/plugins/coupon.ts` — `CouponContext`-Typ ergänzen.
- Modify: `src/plugins/coupons/useCoupon.ts` — Builder bekommt `CouponContext`; optionaler `getSessionKey`.
- Modify: `src/plugins/coupons/top3.ts`, `src/plugins/coupons/top10.ts` — `session_key` optional in die Payload.
- Modify: `src/plugins/coupons/useTop3.ts`, `src/plugins/coupons/useTop10.ts` — Session-Key-Getter durchreichen.
- Modify: `src/components/bet-card/bet-card.vue` — Session-Banner + Lock.
- Modify: `src/pages/index.vue`, `src/pages/top10.vue` — Session beim Mount laden, an `BetCard` geben.

---

### Task 1: Geteilter Session-Store

**Files:**
- Create: `src/stores/session.ts`

- [ ] **Step 1: Store schreiben**

```ts
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getLatestSession, type SessionInfo } from '@/plugins/startingGrid'

/**
 * App-weiter Session-Zustand: die aktuell relevante F1-Session.
 *
 * Einzige Quelle für den Session-Key (vorher lag er im Settings-Store und war
 * nur der Startaufstellungs-Seite bekannt). Der Key wird über das piniaIdb-
 * Plugin persistiert; die Session-Metadaten werden bei Bedarf frisch geladen.
 */
export const useSessionStore = defineStore('session', () => {
	/** Aktiver Session-Key (0 = noch keiner ermittelt). */
	const sessionKey = ref<number>(0)
	/** Metadaten der aktiven Session. */
	const session = ref<SessionInfo | null>(null)
	const loading = ref(false)
	const error = ref<string | null>(null)

	/** True, sobald die aktive Session laut `date_start` begonnen hat. */
	const isStarted = computed(() => {
		if (!session.value) return false
		const start = new Date(session.value.date_start).getTime()
		return !Number.isNaN(start) && start <= Date.now()
	})

	/** Lädt die aktuellste Session vom Backend und setzt sie als aktiv. */
	async function loadLatest () {
		loading.value = true
		error.value = null
		try {
			const s = await getLatestSession()
			session.value = s
			sessionKey.value = s.session_key
		} catch (e) {
			error.value = e instanceof Error ? e.message : String(e)
		} finally {
			loading.value = false
		}
	}

	/** Setzt eine bereits geladene Session (z. B. aus useStartingGrid). */
	function setSession (s: SessionInfo) {
		session.value = s
		sessionKey.value = s.session_key
	}

	return { sessionKey, session, loading, error, isStarted, loadLatest, setSession }
})
```

- [ ] **Step 2: Type-Check**

Run: `npm run type-check`
Expected: keine Fehler (neuer Store kompiliert, noch kein Consumer).

- [ ] **Step 3: Commit**

```bash
git add src/stores/session.ts
git commit -m "feat(session): add shared session store"
```

---

### Task 2: useStartingGrid auf Session-Store umstellen

**Files:**
- Modify: `src/plugins/coupons/useStartingGrid.ts`
- Delete: `src/stores/settings.ts`

- [ ] **Step 1: Prüfen, dass nur useStartingGrid den Settings-Store nutzt**

Run: `grep -rn "useSettingsStore\|stores/settings" src`
Expected: Treffer nur in `src/plugins/coupons/useStartingGrid.ts`. Falls weitere Dateien auftauchen, diese zuerst ebenfalls auf `useSessionStore` umstellen, bevor gelöscht wird.

- [ ] **Step 2: Imports in useStartingGrid austauschen**

In `src/plugins/coupons/useStartingGrid.ts` den Settings-Import ersetzen. Alt:

```ts
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
```

Neu:

```ts
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useSessionStore } from '@/stores/session'
```

- [ ] **Step 3: Store-Anbindung + `latestSession` umstellen**

Alt (Kopf der `useStartingGrid`-Funktion):

```ts
	const settings = useSettingsStore()
	const { startingGridSessionKey } = storeToRefs(settings)

	const entries = ref<StartingGridEntry[]>([])
	const drivers = ref<Record<number, DriverInfo>>({})
	const latestSession = ref<SessionInfo | null>(null)
	const loading = ref(false)
	const error = ref<string | null>(null)
```

Neu:

```ts
	const sessionStore = useSessionStore()
	const { sessionKey: startingGridSessionKey, session: latestSession } = storeToRefs(sessionStore)

	const entries = ref<StartingGridEntry[]>([])
	const drivers = ref<Record<number, DriverInfo>>({})
	const loading = ref(false)
	const error = ref<string | null>(null)
```

(Die lokalen Namen `startingGridSessionKey` / `latestSession` bleiben erhalten, sodass der restliche Funktionskörper und die zurückgegebenen Keys unverändert bleiben.)

- [ ] **Step 4: Session-Zuweisung in `autoLoad` über den Store-Setter**

In `autoLoad` die zwei Zeilen nach erfolgreichem `getLatestSession()` anpassen. Alt:

```ts
		latestSession.value = session
		startingGridSessionKey.value = session.session_key
```

Neu:

```ts
		sessionStore.setSession(session)
```

- [ ] **Step 5: Ungenutztes `SessionInfo`-Import entfernen**

Nach Step 3 kommt `latestSession` aus `storeToRefs`, d. h. der `SessionInfo`-Typ wird in `useStartingGrid.ts` nicht mehr direkt verwendet. Den `startingGrid`-Import entsprechend reduzieren (TypeScript `verbatimModuleSyntax`/type-check meldet den ungenutzten Typ-Import sonst):

```ts
import {
	getLatestSession,
	getStartingGrid,
	syncStartingGrid,
	type StartingGridEntry,
} from '../startingGrid'
```

- [ ] **Step 6: Settings-Store löschen**

```bash
git rm src/stores/settings.ts
```

- [ ] **Step 7: Type-Check**

Run: `npm run type-check`
Expected: keine Fehler; keine verbleibenden Referenzen auf `settings`.

- [ ] **Step 8: Manuell prüfen**

Run: `npm run dev`
Öffne `/starting-grid`: Die Seite lädt wie zuvor automatisch die jüngste Session, Session-Key-Feld und „Synchronisieren"/„Nur laden" funktionieren unverändert.

- [ ] **Step 9: Commit**

```bash
git add src/plugins/coupons/useStartingGrid.ts
git commit -m "refactor(session): source starting grid session from shared store"
```

---

### Task 3: session_key in Renn-Coupons

**Files:**
- Modify: `src/plugins/coupon.ts`
- Modify: `src/plugins/coupons/useCoupon.ts`
- Modify: `src/plugins/coupons/top3.ts`, `src/plugins/coupons/top10.ts`
- Modify: `src/plugins/coupons/useTop3.ts`, `src/plugins/coupons/useTop10.ts`

- [ ] **Step 1: `CouponContext` in coupon.ts ergänzen**

In `src/plugins/coupon.ts` direkt nach dem `Placement`-Typ einfügen:

```ts
/**
 * Zusätzlicher Kontext, den ein Coupon-Builder beim Bauen nutzen kann –
 * z. B. die aktive Session für Renn-Wetten.
 */
export type CouponContext = {
	sessionKey?: number
}
```

- [ ] **Step 2: Builder-Signatur in useCoupon.ts erweitern**

In `src/plugins/coupons/useCoupon.ts` den Import und den `CouponBuilder`-Typ anpassen. Alt:

```ts
import { create, type Coupon, type Placement } from '../coupon'
import type { PodiumDriver } from './types'

export type { PodiumDriver }

/** Baut aus den Picks des Nutzers den zu sendenden Coupon. */
export type CouponBuilder<TData extends object> = (placements: Placement[]) => Coupon<TData>
```

Neu:

```ts
import { create, type Coupon, type CouponContext, type Placement } from '../coupon'
import type { PodiumDriver } from './types'

export type { PodiumDriver }

/** Baut aus den Picks des Nutzers (+ optionalem Kontext) den zu sendenden Coupon. */
export type CouponBuilder<TData extends object> = (
	placements: Placement[],
	ctx: CouponContext,
) => Coupon<TData>
```

- [ ] **Step 3: useCoupon um optionalen Session-Key-Getter erweitern**

Signatur anpassen. Alt:

```ts
export function useCoupon<TData extends object> (
	betType: BetType,
	initialPicks: PodiumDriver[],
	buildCoupon: CouponBuilder<TData>,
) {
```

Neu:

```ts
export function useCoupon<TData extends object> (
	betType: BetType,
	initialPicks: PodiumDriver[],
	buildCoupon: CouponBuilder<TData>,
	getSessionKey?: () => number | undefined,
) {
```

Und im `submit()` den Builder-Aufruf. Alt:

```ts
			const coupon = buildCoupon(
				picks.value.map((d, i) => ({ driver_id: d.driver_id, position: i + 1 })),
			)
```

Neu:

```ts
			const coupon = buildCoupon(
				picks.value.map((d, i) => ({ driver_id: d.driver_id, position: i + 1 })),
				{ sessionKey: getSessionKey?.() },
			)
```

- [ ] **Step 4: top3.ts auf Kontext + session_key umstellen**

`src/plugins/coupons/top3.ts` komplett ersetzen:

```ts
import type { Coupon, CouponContext, Placement } from '../coupon'

/** Schema-Daten der "Top 3 Wette" (genau 3 Platzierungen erwartet). */
export type Top3Data = {
	placements: Placement[]
	/** Session, auf die sich die Wette bezieht (optional, Backend ignoriert sie bis Phase 0). */
	session_key?: number
}

/**
 * Baut eine "Top 3 Wette" für die Coupon-API (Kategorie "race", Schema "top3coupon").
 *
 * @param placements Genau 3 Platzierungen (Fahrer auf Position 1–3).
 * @param ctx        Optionaler Kontext; `sessionKey` wird – falls gesetzt – als
 *                   `session_key` mitgeschickt.
 */
export default function createTop3Coupon (
	placements: Placement[],
	ctx: CouponContext = {},
): Coupon<Top3Data> {
	return {
		name: 'Top 3 Wette',
		category: 'race',
		schemaName: 'top3coupon',
		data: {
			placements,
			...(ctx.sessionKey ? { session_key: ctx.sessionKey } : {}),
		},
	}
}
```

- [ ] **Step 5: top10.ts analog umstellen**

`src/plugins/coupons/top10.ts` komplett ersetzen:

```ts
import type { Coupon, CouponContext, Placement } from '../coupon'

/** Schema-Daten der "Top 10 Wette" (genau 10 Platzierungen erwartet). */
export type Top10Data = {
	placements: Placement[]
	/** Session, auf die sich die Wette bezieht (optional, Backend ignoriert sie bis Phase 0). */
	session_key?: number
}

/**
 * Baut eine "Top 10 Wette" für die Coupon-API (Kategorie "race", Schema "top10coupon").
 *
 * @param placements Genau 10 Platzierungen (Fahrer auf Position 1–10).
 * @param ctx        Optionaler Kontext; `sessionKey` wird – falls gesetzt – als
 *                   `session_key` mitgeschickt.
 */
export default function createTop10Coupon (
	placements: Placement[],
	ctx: CouponContext = {},
): Coupon<Top10Data> {
	return {
		name: 'Top 10 Wette',
		category: 'race',
		schemaName: 'top10coupon',
		data: {
			placements,
			...(ctx.sessionKey ? { session_key: ctx.sessionKey } : {}),
		},
	}
}
```

- [ ] **Step 6: useTop3 den Session-Key-Getter übergeben**

`src/plugins/coupons/useTop3.ts` – Import ergänzen und `useCoupon`-Aufruf erweitern:

```ts
import { useSessionStore } from '@/stores/session'
import createTop3Coupon from './top3'
import type { PodiumDriver } from './types'
import { useCoupon } from './useCoupon'

export type { PodiumDriver }

export function useTop3 (initialPodium: PodiumDriver[]) {
	const session = useSessionStore()
	const { picks, submitting, error, createdId, placedAt, submit, swapPicks, reset }
		= useCoupon('top3', initialPodium, createTop3Coupon, () => session.sessionKey || undefined)

	return { podium: picks, submitting, error, createdId, placedAt, submit, swapPicks, reset }
}
```

- [ ] **Step 7: useTop10 analog**

`src/plugins/coupons/useTop10.ts` – Import ergänzen und `useCoupon`-Aufruf erweitern:

```ts
import { useSessionStore } from '@/stores/session'
import createTop10Coupon from './top10'
import type { PodiumDriver } from './types'
import { useCoupon } from './useCoupon'

export function useTop10 (initialTop10: PodiumDriver[]) {
	const session = useSessionStore()
	const { picks, submitting, error, createdId, placedAt, submit, swapPicks, reset }
		= useCoupon('top10', initialTop10, createTop10Coupon, () => session.sessionKey || undefined)

	return { top10: picks, submitting, error, createdId, placedAt, submit, swapPicks, reset }
}
```

- [ ] **Step 8: Type-Check**

Run: `npm run type-check`
Expected: keine Fehler. Die Saison-/Team-Builder (`driverChampionship.ts` etc.) bleiben `(placements) => ...` und sind weiterhin zum erweiterten `CouponBuilder`-Typ zuweisbar (weniger Parameter sind in TS zulässig).

- [ ] **Step 9: Commit**

```bash
git add src/plugins/coupon.ts src/plugins/coupons/useCoupon.ts \
	src/plugins/coupons/top3.ts src/plugins/coupons/top10.ts \
	src/plugins/coupons/useTop3.ts src/plugins/coupons/useTop10.ts
git commit -m "feat(coupons): thread active session_key into race bets"
```

---

### Task 4: Session-Anzeige & Lock in BetCard + Renn-Seiten

**Files:**
- Modify: `src/components/bet-card/bet-card.vue`
- Modify: `src/pages/index.vue`, `src/pages/top10.vue`

- [ ] **Step 1: BetCard-Props um `session` und `locked` erweitern**

In `src/components/bet-card/bet-card.vue` im `<script setup>` den Typ-Import und die Props ergänzen. Alt:

```ts
import { watch } from 'vue'
import BettingSlip from '@/components/betting-slip/betting-slip.vue'
import List from '@/components/list/list.vue'
import type { PodiumDriver } from '@/plugins/coupons/types'
```

Neu:

```ts
import { watch } from 'vue'
import BettingSlip from '@/components/betting-slip/betting-slip.vue'
import List from '@/components/list/list.vue'
import type { PodiumDriver } from '@/plugins/coupons/types'
import type { SessionInfo } from '@/plugins/startingGrid'
```

Im `defineProps`-Objekt diese beiden Felder hinzufügen (nach `reorderable?: boolean`):

```ts
	/** Aktive Session, auf die sich eine Renn-Wette bezieht (optional). */
	session?: SessionInfo | null
	/** Sperrt die Abgabe (z. B. weil die Session bereits begonnen hat). */
	locked?: boolean
```

Und in den `withDefaults`-Defaults ergänzen:

```ts
	session: null,
	locked: false,
```

- [ ] **Step 2: Template – Session-Banner, Lock-Hinweis, Submit sperren**

In `src/components/bet-card/bet-card.vue` den Formular-Block (`<v-card v-if="!createdId" ...>`) ersetzen durch den folgenden. **Wichtig:** Die vom Nutzer gesetzten Styling-Klassen (`custom-height` am `v-card`, `bg-taupe-500 text-taupe-100` am Button) bleiben erhalten – nur Session-Banner, Lock-Hinweis und die `locked`-Bindungen kommen hinzu:

```html
			<v-card v-if="!createdId" class="custom-height py-3 rounded-3xl transition-[border-radius] hover:rounded-lg" rounded="3xl" variant="flat">
				<div v-if="session" class="px-4 pt-4">
					<div class="text-[10px] tracking-[0.3em] text-neutral-500">TIPP FÜR</div>
					<div class="text-sm">
						<strong>{{ session.country_name }}</strong>
						<span class="text-neutral-500"> · {{ session.session_name }}</span>
					</div>
				</div>

				<v-alert v-if="locked" type="warning" variant="tonal" class="mx-4 mt-3">
					Diese Session hat bereits begonnen – ein Tipp ist nicht mehr möglich.
				</v-alert>

				<List
					class="bg-neutral-100"
					:picks="picks"
					:subtitle="subtitle"
					:colors="colors"
					:reorderable="reorderable && !createdId && !locked"
					@reorder="emit('reorder', $event)"
				/>

				<v-card-actions class="justify-end">
					<v-btn
						class="bg-taupe-500 text-taupe-100"
						:loading="submitting"
						:disabled="submitting || locked"
						color="primary"
						@click="$emit('submit')"
					>
						{{ submitLabel ?? 'Wette abschließen' }}
					</v-btn>
				</v-card-actions>

				<v-alert v-if="error" type="error" class="mt-3">{{ error }}</v-alert>
			</v-card>
```

- [ ] **Step 3: index.vue (Top 3) Session laden und übergeben**

`src/pages/index.vue` komplett ersetzen:

```vue
<template>
	<BetCard
		name="Top 3 Wette"
		:picks="podium"
		subtitle="Deine Top-3-Wette fürs nächste Rennen"
		:colors="['#FFD700', '#C0C0C0', '#CD7F32']"
		:submitting="submitting"
		:error="error"
		:created-id="createdId"
		:placed-at="placedAt"
		:session="session"
		:locked="isStarted"
		@submit="submit"
		@reorder="({ from, to }) => swapPicks(from, to)"
	/>
</template>

<script setup lang="ts">
	import { storeToRefs } from 'pinia'
	import { onMounted } from 'vue'
	import BetCard from '@/components/bet-card/bet-card.vue'
	import { useTop3 } from '@/plugins/coupons/useTop3'
	import { useSessionStore } from '@/stores/session'

	const sessionStore = useSessionStore()
	const { session, isStarted } = storeToRefs(sessionStore)
	onMounted(() => sessionStore.loadLatest())

	const { podium, submitting, error, createdId, placedAt, submit, swapPicks } = useTop3([
		{ driver_id: 1, name: 'Max Verstappen' },
		{ driver_id: 12, name: 'Kimi Antonelli' },
		{ driver_id: 44, name: 'Lewis Hamilton' },
	])
</script>
```

- [ ] **Step 4: top10.vue Session laden und übergeben**

`src/pages/top10.vue` komplett ersetzen:

```vue
<template>
	<BetCard
		name="Top 10 Wette"
		:picks="top10"
		subtitle="Deine Top-10-Wette fürs nächste Rennen"
		:submitting="submitting"
		:error="error"
		:created-id="createdId"
		:placed-at="placedAt"
		:session="session"
		:locked="isStarted"
		@submit="submit"
		@reorder="({ from, to }) => swapPicks(from, to)"
	/>
</template>

<script setup lang="ts">
	import { storeToRefs } from 'pinia'
	import { onMounted } from 'vue'
	import BetCard from '@/components/bet-card/bet-card.vue'
	import { useTop10 } from '@/plugins/coupons/useTop10'
	import { useSessionStore } from '@/stores/session'

	const sessionStore = useSessionStore()
	const { session, isStarted } = storeToRefs(sessionStore)
	onMounted(() => sessionStore.loadLatest())

	const { top10, submitting, error, createdId, placedAt, submit, swapPicks } = useTop10([
		{ driver_id: 1, name: 'Max Verstappen' },
		{ driver_id: 12, name: 'Kimi Antonelli' },
		{ driver_id: 44, name: 'Lewis Hamilton' },
		{ driver_id: 4, name: 'Lando Norris' },
		{ driver_id: 16, name: 'Charles Leclerc' },
		{ driver_id: 55, name: 'Carlos Sainz' },
		{ driver_id: 63, name: 'George Russell' },
		{ driver_id: 81, name: 'Oscar Piastri' },
		{ driver_id: 14, name: 'Fernando Alonso' },
		{ driver_id: 11, name: 'Sergio Pérez' },
	])
</script>
```

- [ ] **Step 5: Type-Check**

Run: `npm run type-check`
Expected: keine Fehler.

- [ ] **Step 6: Manuell prüfen**

Run: `npm run dev`
- `/` (Top 3) und `/top10`: Oberhalb der Liste erscheint „TIPP FÜR <Land> · <Session>".
- Netzwerk-Tab beim Abschließen: Der POST-Body `schema.data` enthält `session_key` (sofern das Backend eine Session lieferte).
- Wenn die geladene Session laut `date_start` in der Vergangenheit liegt, ist der Button gesperrt und der Warnhinweis sichtbar.
- Saison-/Team-Wetten (`/driver-championship`, `/team-duell`) zeigen **keinen** Session-Banner (Props nicht gesetzt) und funktionieren unverändert.

- [ ] **Step 7: Commit**

```bash
git add src/components/bet-card/bet-card.vue src/pages/index.vue src/pages/top10.vue
git commit -m "feat(bet-card): show active session and lock after session start"
```

---

## Verifikation (End-to-End, nach allen Tasks)

1. `npm run type-check` → grün.
2. `npm run dev`:
   - `/starting-grid` lädt automatisch die jüngste Session (Session-Store als Quelle), manuelle Key-Eingabe wirkt weiter.
   - `/` und `/top10` zeigen die aktive Session; `session_key` liegt im POST-Payload; Lock greift bei bereits begonnener Session.
   - Übrige Wettarten unverändert; kein verbleibender Verweis auf `stores/settings`.
3. `git log --oneline` zeigt vier fokussierte Commits (ein Commit pro Task).

## Offene Punkte / Folge-Phasen

- **Phase 0 (Backend):** `session_key`-Feld in die Renn-Schema-Structs (`race.Top3Schema`, `race.Top10Schema`) aufnehmen, damit es gespeichert wird; Endpoint für die **kommende** Session (`/api/v1/sessions/upcoming`), damit der Lock „vor dem Rennen tippen" sinnvoll greift statt nur gegen die jüngste Session.
- **Phase 2:** Session-Store ist Voraussetzung für den „Mein Fahrer"-Session-Loop.
- `session_key` wird bewusst noch nicht lokal pro Coupon gespeichert (kein Consumer); kommt mit der Punkte-/Wettschein-Anzeige in Phase 3.
```
