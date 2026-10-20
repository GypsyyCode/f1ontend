/**
 * Starting-Grid Endpunkte des F1-Tippspiels.
 *
 * Beide Routen hängen im Backend an der Admin-Gruppe (JWT + Admin-Rolle),
 * daher wird ein Token entgegengenommen und – falls gesetzt – als
 * `Authorization: Bearer <token>` mitgeschickt.
 *
 *   POST /api/v1/results/{sessionKey}/grid/sync   // zieht die Grid-Daten
 *                                                 // von OpenF1 ins Backend
 *   GET  /api/v1/results/{sessionKey}/grid        // liefert die gespeicherten
 *                                                 // Grid-Einträge
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

function authHeader (token?: string): Record<string, string> {
	return token ? { Authorization: `Bearer ${token}` } : {}
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
export async function syncStartingGrid (sessionKey: number, token?: string): Promise<void> {
	const res = await fetch(
		`${API_BASE}/api/v1/results/${sessionKey}/grid/sync`,
		{
			method: 'POST',
			headers: authHeader(token),
		},
	)

	if (!res.ok) {
		throw new Error(
			`Starting Grid Sync fehlgeschlagen (HTTP ${res.status}): ${await readError(res)}`,
		)
	}
}

/** Liest die im Backend gespeicherte Startaufstellung einer Session. */
export async function getStartingGrid (
	sessionKey: number,
	token?: string,
): Promise<StartingGridEntry[]> {
	const res = await fetch(
		`${API_BASE}/api/v1/results/${sessionKey}/grid`,
		{
			headers: authHeader(token),
		},
	)

	if (!res.ok) {
		throw new Error(
			`Starting Grid konnte nicht geladen werden (HTTP ${res.status}): ${await readError(res)}`,
		)
	}

	return await res.json() as StartingGridEntry[]
}
