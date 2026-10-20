import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Allgemeine, pageübergreifende Einstellungen. Aktuell nur der zuletzt
 * verwendete Session-Key der Startaufstellungs-Seite; bewusst als zentraler
 * Settings-Store angelegt, damit weitere Einstellungen hier dazukommen können.
 */
export const useSettingsStore = defineStore('settings', () => {
	/** Zuletzt verwendeter Session-Key für die Startaufstellungs-Seite. */
	const startingGridSessionKey = ref<number>(0)

	return { startingGridSessionKey }
})
