import createDriverChampionshipCoupon from './driverChampionship'
import type { PodiumDriver } from './types'
import { useCoupon } from './useCoupon'

/**
 * Komponisable für die Fahrer-Championship-Wette: ein Fahrer-Pick, dessen
 * Position dem getippten Championship-Rang entspricht. State über Pinia-Store
 * mit IndexedDB-Persistenz.
 */
export function useDriverChampionship (initialPick: PodiumDriver) {
	const { picks, submitting, error, createdId, placedAt, submit, swapPicks, reset }
		= useCoupon('driverChampionship', [initialPick], createDriverChampionshipCoupon)

	return { picks, submitting, error, createdId, placedAt, submit, swapPicks, reset }
}
