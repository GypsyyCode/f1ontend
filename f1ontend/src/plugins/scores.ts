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

export type ScoringResult = {
	session_key: number
	scored_coupons: number
}

/**
 * Löst das Scoring für eine Session aus (admin-geschützt).
 *
 * Backend-Endpoint: POST /api/v1/scoring/:sessionKey
 * Setzt für alle Coupons mit matching session_key das `score`-Feld.
 */
export async function triggerScoring (sessionKey: number, token: string): Promise<ScoringResult> {
	const res = await fetch(`${API_BASE}/api/v1/scoring/${sessionKey}`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}` },
	})
	if (!res.ok) {
		const msg = await res.text().catch(() => res.statusText)
		throw new Error(`Scoring konnte nicht ausgelöst werden (HTTP ${res.status}): ${msg}`)
	}
	return await res.json() as ScoringResult
}

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
