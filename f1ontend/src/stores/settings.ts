import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Allgemeine, pageübergreifende Einstellungen. Hält aktuell nur die
 * zwei Werte für die Startaufstellungs-Seite (admin-geschützter Endpoint),
 * ist aber bewusst als zentraler Settings-Store angelegt, damit weitere
 * Einstellungen hier dazukommen können, ohne einen neuen Store aufzuziehen.
 */
export const useSettingsStore = defineStore('settings', () => {
	/** JWT eines Admin-Users für die admin-protected Grid-Routen. */
	const adminToken = ref<string>('')

	/** Zuletzt verwendeter Session-Key für die Startaufstellungs-Seite. */
	const startingGridSessionKey = ref<number>(0)

	return { adminToken, startingGridSessionKey }
})
