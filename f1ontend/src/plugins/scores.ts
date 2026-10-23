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
