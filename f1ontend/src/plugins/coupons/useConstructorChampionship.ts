import createConstructorChampionshipCoupon from './constructorChampionship'
import type { PodiumDriver } from './types'
import { useCoupon } from './useCoupon'

/**
 * Komponisable für die Constructor-Championship-Wette: ein Pick, dessen
 * Position dem getippten Konstrukteurs-Championship-Rang entspricht.
 * State über Pinia-Store mit IndexedDB-Persistenz.
 */
export function useConstructorChampionship (initialPick: PodiumDriver) {
	const { picks, submitting, error, createdId, placedAt, submit, swapPicks, reset }
		= useCoupon('constructorChampionship', [initialPick], createConstructorChampionshipCoupon)

	return { picks, submitting, error, createdId, placedAt, submit, swapPicks, reset }
}
