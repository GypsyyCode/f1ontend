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
