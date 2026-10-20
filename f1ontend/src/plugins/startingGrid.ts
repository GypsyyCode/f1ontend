/**
 * Starting-Grid Endpunkte des F1-Tippspiels.
 *
 *   POST /api/v1/results/{sessionKey}/grid/sync   // zieht die Grid-Daten
 *                                                 // von OpenF1 ins Backend
 *   GET  /api/v1/results/{sessionKey}/grid        // liefert die gespeicherten
 *                                                 // Grid-Einträge
 *
 * Beide Routen sind im Backend öffentlich (RegisterPublicRoutes), eine
 * Authentifizierung wird nicht benötigt.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

/** Ein Eintrag der Startaufstellung (spiegelt models.StartingGrid). */
export type StartingGridEntry = {
	id: number
	session_key: number
	meeting_key: number
	driver_number: number
	position: number | null
	lap_duration: number | null
}

/** Metadaten einer F1-Session (spiegelt models.Session). */
export type SessionInfo = {
	id: number
	session_key: number
	meeting_key: number
	year: number
	country_name: string
	session_name: string
	session_type: string
	date_start: string
}

async function readError (res: Response): Promise<string> {
	const text = await res.text().catch(() => '')
	try {
		const parsed = JSON.parse(text) as { error?: string }
		if (parsed.error) return parsed.error
	} catch {
		// kein JSON – text direkt verwenden
	}
	return text || res.statusText
}

/**
 * Stößt das Nachladen der Startaufstellung aus OpenF1 ins Backend an.
 * Antwort ist `{status: "synced"}`, die eigentlichen Daten liefert `getStartingGrid`.
 */
export async function syncStartingGrid (sessionKey: number): Promise<void> {
	const res = await fetch(
		`${API_BASE}/api/v1/results/${sessionKey}/grid/sync`,
		{ method: 'POST' },
	)

	if (!res.ok) {
		throw new Error(
			`Starting Grid Sync fehlgeschlagen (HTTP ${res.status}): ${await readError(res)}`,
		)
	}
}

/** Liest die im Backend gespeicherte Startaufstellung einer Session. */
export async function getStartingGrid (sessionKey: number): Promise<StartingGridEntry[]> {
	const res = await fetch(`${API_BASE}/api/v1/results/${sessionKey}/grid`)

	if (!res.ok) {
		throw new Error(
			`Starting Grid konnte nicht geladen werden (HTTP ${res.status}): ${await readError(res)}`,
		)
	}

	return await res.json() as StartingGridEntry[]
}

/**
 * Fragt das Backend nach der aktuellsten F1-Session (via OpenF1
 * `session_key=latest`). Wird genutzt, um die Startaufstellung ohne
 * manuelle Eingabe des Session-Keys automatisch laden zu können.
 */
export async function getLatestSession (): Promise<SessionInfo> {
	const res = await fetch(`${API_BASE}/api/v1/sessions/latest`)

	if (!res.ok) {
		throw new Error(
			`Letzte Session konnte nicht ermittelt werden (HTTP ${res.status}): ${await readError(res)}`,
		)
	}

	return await res.json() as SessionInfo
}
