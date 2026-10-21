import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * „Mein Fahrer": der zu Saisonbeginn gewählte Fahrer, auf dessen Platzierung
 * man Session für Session tippt. Persistiert via piniaIdb.
 */
export const useMeinFahrerStore = defineStore('meinFahrer', () => {
	/** driver_number des Saison-Fahrers (null = noch nicht gewählt). */
	const driverId = ref<number | null>(null)
	/** Anzeigename – gespeichert, damit keine erneute Auflösung nötig ist. */
	const driverName = ref<string | null>(null)
	/** Kürzel (z. B. "VER"), optional. */
	const driverAcronym = ref<string | null>(null)

	/** Setzt (oder löscht mit null) den Saison-Fahrer. */
	function setDriver (d: { driver_id: number, name: string, acronym?: string } | null) {
		driverId.value = d?.driver_id ?? null
		driverName.value = d?.name ?? null
		driverAcronym.value = d?.acronym ?? null
	}

	return { driverId, driverName, driverAcronym, setDriver }
})
