import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getSeasonStart, type SessionInfo } from '@/plugins/startingGrid'

/**
 * App-weiter Saison-Zustand: die aktuell relevante F1-Saison.
 *
 * Analog zu `useSessionStore` (Phase 1), aber auf Jahr-Ebene. Hält
 * zusätzlich die erste Session des Jahres als Lock-Grundlage für die
 * drei Saison-Wetten.
 */
export const useSeasonStore = defineStore('season', () => {
	/** Aktuelles Jahr (0 = noch nicht initialisiert). */
	const year = ref<number>(0)
	/** Erste Session des Jahres, für Lock + Banner. */
	const firstSession = ref<SessionInfo | null>(null)
	const loading = ref(false)
	const error = ref<string | null>(null)

	/** True, sobald die erste Session der Saison laut `date_start` begonnen hat. */
	const isStarted = computed(() => {
		if (!firstSession.value) return false
		const start = new Date(firstSession.value.date_start).getTime()
		return !Number.isNaN(start) && start <= Date.now()
	})

	/**
	 * Lädt die erste Session des aktuellen Jahres (UTC). Setzt `year`
	 * aus deren `date_start` ab, damit Jahreswechsel sauber abgebildet
	 * sind (keine Dezember-vs-Januar-Diskrepanz).
	 */
	async function loadCurrent () {
		loading.value = true
		error.value = null
		try {
			const session = await getSeasonStart(new Date().getUTCFullYear())
			firstSession.value = session
			year.value = new Date(session.date_start).getUTCFullYear()
		} catch (e) {
			error.value = e instanceof Error ? e.message : String(e)
			// Fallback: aktuelles UTC-Jahr, damit UI nicht komplett blockt.
			if (year.value === 0) year.value = new Date().getUTCFullYear()
		} finally {
			loading.value = false
		}
	}

	return { year, firstSession, loading, error, isStarted, loadCurrent }
})
