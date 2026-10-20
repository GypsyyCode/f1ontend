/**
 * Thin Wrapper um den öffentlichen `/api/v1/drivers`-Endpoint des F1-Tippspiels.
 * Dient dazu, in der Wettschein-Matrix zu driver_id → Fahrername aufzulösen.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

/** Minimal benötigte Felder aus dem Driver-Model. */
export type DriverInfo = {
	driver_number: number
	full_name: string
	first_name: string
	last_name: string
	name_acronym: string
}

export async function listDrivers (): Promise<DriverInfo[]> {
	const res = await fetch(`${API_BASE}/api/v1/drivers`)
	if (!res.ok) {
		const message = await res.text().catch(() => res.statusText)
		throw new Error(`Fahrer konnten nicht geladen werden (HTTP ${res.status}): ${message}`)
	}
	return await res.json() as DriverInfo[]
}
