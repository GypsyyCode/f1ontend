import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PodiumDriver } from '@/plugins/coupons/types'

/** Alle vom Frontend unterstützten Wettarten. */
export type BetType =
	| 'top3'
	| 'top10'
	| 'driverChampionship'
	| 'constructorChampionship'
	| 'teamDuell'
	| 'pole'
	| 'fastestLap'
	| 'firstDnf'
	| 'driverOfTheDay'
	| 'myDriverPlacement'

/**
 * Persistiertes State pro Wettart: die aktuell gesetzten Picks (Reihenfolge =
 * getippte Platzierung), die vom Backend vergebene Coupon-ID des zuletzt
 * abgegebenen Coupons sowie der zugehörige Zeitstempel.
 *
 * Reicht als Snapshot für die Anzeige des Wettscheins nach Reload und für
 * den "Nach-Abgabe-Zustand" (Picks nicht mehr verschiebbar) der BetCard.
 */
export const useCouponsStore = defineStore('coupons', () => {
	const picks = ref<Record<string, PodiumDriver[]>>({})
	const createdIds = ref<Record<string, string | null>>({})
	const placedAt = ref<Record<string, string | null>>({})

	/** Setzt Defaults nur, wenn die Wettart noch keine Picks hat (nach Hydrate). */
	function ensureDefaults (betType: BetType, defaults: PodiumDriver[]) {
		if (!picks.value[betType] || picks.value[betType].length === 0) {
			picks.value[betType] = [...defaults]
		}
	}

	function setPicks (betType: BetType, next: PodiumDriver[]) {
		picks.value[betType] = next
	}

	/** Tauscht zwei Picks an den gegebenen Indizes. No-op bei ungültigem Input. */
	function swapPicks (betType: BetType, a: number, b: number) {
		const arr = picks.value[betType]
		if (!arr || a === b) return
		if (a < 0 || a >= arr.length) return
		if (b < 0 || b >= arr.length) return

		const next = [...arr]
		;[next[a], next[b]] = [next[b], next[a]]
		picks.value[betType] = next
	}

	function setCreatedId (betType: BetType, id: string | null) {
		createdIds.value[betType] = id
		placedAt.value[betType] = id
			? new Date().toLocaleString('de-DE', {
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit',
			})
			: null
	}

	/** Setzt eine Wettart komplett zurück – z. B. um nach Abgabe neu zu tippen. */
	function reset (betType: BetType) {
		delete picks.value[betType]
		delete createdIds.value[betType]
		delete placedAt.value[betType]
	}

	return {
		picks,
		createdIds,
		placedAt,
		ensureDefaults,
		setPicks,
		swapPicks,
		setCreatedId,
		reset,
	}
})
