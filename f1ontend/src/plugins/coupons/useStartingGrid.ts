import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { listDrivers, type DriverInfo } from '../drivers'
import { getStartingGrid, syncStartingGrid, type StartingGridEntry } from '../startingGrid'

/**
 * Hält Session-Key, Admin-Token und die geladenen Grid-Daten einer Session.
 *
 * Session-Key und Admin-Token liegen bewusst im Settings-Store (persistiert
 * via IndexedDB), damit beide zwischen Reloads und Pages erhalten bleiben.
 * Die eigentlichen Grid-/Driver-Daten sind flüchtig und bleiben als lokale
 * Refs im Composable, da sie bei Bedarf frisch vom Backend geladen werden.
 *
 * Workflow:
 *  - `sync()`   → POST /grid/sync + anschließend GET /grid
 *  - `reload()` → nur GET /grid (ohne erneuten OpenF1-Fetch)
 */
export function useStartingGrid () {
	const settings = useSettingsStore()
	const { adminToken, startingGridSessionKey } = storeToRefs(settings)

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
				getStartingGrid(startingGridSessionKey.value, adminToken.value || undefined),
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
			await syncStartingGrid(startingGridSessionKey.value, adminToken.value || undefined)
			entries.value = await getStartingGrid(
				startingGridSessionKey.value,
				adminToken.value || undefined,
			)
			if (Object.keys(drivers.value).length === 0) {
				await loadDrivers()
			}
		} catch (e) {
			error.value = e instanceof Error ? e.message : String(e)
		} finally {
			loading.value = false
		}
	}

	return {
		sessionKey: startingGridSessionKey,
		token: adminToken,
		entries,
		orderedEntries,
		drivers,
		loading,
		error,
		sync,
		reload,
	}
}
