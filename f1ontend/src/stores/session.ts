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

	/**
	 * True, sobald die aktive Session laut `date_start` begonnen hat.
	 *
	 * Momentaufnahme: wird nur neu berechnet, wenn sich `session` ändert (also
	 * bei jedem `loadLatest()` / Page-Mount). Läuft der Start-Zeitpunkt ab,
	 * während die Seite offen bleibt, greift der Lock erst beim nächsten Laden.
	 * Reicht für Phase 1; eine feinere Logik kommt mit dem „kommende Session"-
	 * Endpoint (Phase 0).
	 */
	const isStarted = computed(() => {
		if (!session.value) return false
		const start = new Date(session.value.date_start).getTime()
		return !Number.isNaN(start) && start <= Date.now()
	})

	/** Lädt die aktuellste Session vom Backend und setzt sie als aktiv. */
	async function loadLatest () {
		// Parallele Aufrufe (z. B. zwei Renn-Seiten) nicht doppelt feuern lassen.
		if (loading.value) return
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
