import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useSessionStore } from '@/stores/session'
import { listDrivers, type DriverInfo } from '../drivers'
import {
	getLatestSession,
	getStartingGrid,
	syncStartingGrid,
	type StartingGridEntry,
} from '../startingGrid'

/**
 * Hält Session-Key und die geladenen Grid-Daten einer Session.
 *
 * Der Session-Key liegt im Settings-Store (persistiert via IndexedDB), damit
 * er zwischen Reloads und Pages erhalten bleibt. Die eigentlichen Grid-/
 * Driver-Daten sind flüchtig und werden bei Bedarf frisch geladen.
 *
 * Workflow:
 *  - `autoLoad()` → ermittelt die aktuellste Session, setzt den Key, synct
 *                   die Grid-Daten und lädt sie. Beim Mount der Page genutzt.
 *  - `sync()`     → POST /grid/sync + anschließend GET /grid für den aktuell
 *                   im Store hinterlegten Key.
 *  - `reload()`   → nur GET /grid (ohne erneuten OpenF1-Fetch).
 */
export function useStartingGrid () {
	const sessionStore = useSessionStore()
	const { sessionKey: startingGridSessionKey, session: latestSession } = storeToRefs(sessionStore)

	const entries = ref<StartingGridEntry[]>([])
	const drivers = ref<Record<number, DriverInfo>>({})
	const loading = ref(false)
	const error = ref<string | null>(null)

	/** Entries nach Position aufsteigend; Einträge ohne Position landen hinten. */
	const orderedEntries = computed(() => {
		return [...entries.value].sort((a, b) => {
			const pa = a.position ?? Number.POSITIVE_INFINITY
			const pb = b.position ?? Number.POSITIVE_INFINITY
			return pa - pb
		})
	})

	async function loadDrivers () {
		// Fahrerliste ist nice-to-have (für Namensauflösung); Fehler schlucken.
		try {
			const list = await listDrivers()
			drivers.value = Object.fromEntries(list.map(d => [d.driver_number, d]))
		} catch {
			drivers.value = {}
		}
	}

	async function reload () {
		if (!startingGridSessionKey.value) {
			error.value = 'Bitte zuerst einen Session-Key angeben.'
			return
		}
		loading.value = true
		error.value = null
		try {
			const [grid] = await Promise.all([
				getStartingGrid(startingGridSessionKey.value),
				Object.keys(drivers.value).length === 0 ? loadDrivers() : Promise.resolve(),
			])
			entries.value = grid
		} catch (e) {
			error.value = e instanceof Error ? e.message : String(e)
		} finally {
			loading.value = false
		}
	}

	async function sync () {
		if (!startingGridSessionKey.value) {
			error.value = 'Bitte zuerst einen Session-Key angeben.'
			return
		}
		loading.value = true
		error.value = null
		try {
			await syncStartingGrid(startingGridSessionKey.value)
			entries.value = await getStartingGrid(startingGridSessionKey.value)
			if (Object.keys(drivers.value).length === 0) {
				await loadDrivers()
			}
		} catch (e) {
			error.value = e instanceof Error ? e.message : String(e)
		} finally {
			loading.value = false
		}
	}

	/**
	 * Ermittelt die jüngste Session via Backend, speichert ihren Key und
	 * synct anschließend die Grid-Daten. Wird vom Page-Component beim Mount
	 * aufgerufen, damit der Nutzer nichts manuell eintragen muss.
	 *
	 * Der Sync ist best-effort: Scheitert er (z. B. weil OpenF1 für die
	 * jüngste Session noch keine Grid-Daten publiziert hat), versuchen wir
	 * trotzdem, das bereits im Backend-DB abgelegte Grid zu laden. Scheitert
	 * auch das, landet der Fehler im `error`-Ref.
	 */
	async function autoLoad () {
		loading.value = true
		error.value = null

		let session
		try {
			session = await getLatestSession()
		} catch (e) {
			error.value = e instanceof Error ? e.message : String(e)
			loading.value = false
			return
		}

		sessionStore.setSession(session)

		let syncError: unknown
		try {
			await syncStartingGrid(session.session_key)
		} catch (e) {
			syncError = e
			console.warn('[startingGrid] sync failed, falling back to stored grid', e)
		}

		try {
			entries.value = await getStartingGrid(session.session_key)
			if (Object.keys(drivers.value).length === 0) {
				await loadDrivers()
			}
			// Falls Sync fehlgeschlagen ist, aber im DB bereits Daten lagen,
			// zeigen wir sie an – kein Error. Hat auch das GET keine Daten,
			// propagieren wir den Sync-Fehler, damit der Nutzer ihn sieht.
			if (syncError && entries.value.length === 0) {
				error.value = syncError instanceof Error ? syncError.message : String(syncError)
			}
		} catch (e) {
			error.value = e instanceof Error ? e.message : String(e)
		} finally {
			loading.value = false
		}
	}

	return {
		sessionKey: startingGridSessionKey,
		entries,
		orderedEntries,
		drivers,
		latestSession,
		loading,
		error,
		autoLoad,
		sync,
		reload,
	}
}
