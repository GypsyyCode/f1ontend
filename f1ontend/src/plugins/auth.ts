/**
 * Auth-Client des F1-Tippspiels (Backend-Endpunkte existieren bereits):
 *   POST /api/v1/auth/register  { username, email, password }
 *   POST /api/v1/auth/login     { username, password }
 * Antwort jeweils: { token, player }.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

/** Spielerprofil (spiegelt models.Player; PasswordHash wird nie geliefert). */
export type Player = {
	id: number
	username: string
	email: string
	display_name: string
	favorite_team_id?: number | null
	role: string
	created_at: string
	updated_at: string
}

export type AuthResult = {
	token: string
	player: Player
}

async function post (path: string, body: unknown): Promise<AuthResult> {
	const res = await fetch(`${API_BASE}/api/v1${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	})
	if (!res.ok) {
		let message = res.statusText
		try {
			const parsed = await res.json() as { error?: string }
			if (parsed.error) message = parsed.error
		} catch {
			// keine JSON-Fehlermeldung – statusText verwenden
		}
		throw new Error(message)
	}
	return await res.json() as AuthResult
}

export function register (username: string, email: string, password: string): Promise<AuthResult> {
	return post('/auth/register', { username, email, password })
}

export function login (username: string, password: string): Promise<AuthResult> {
	return post('/auth/login', { username, password })
}
