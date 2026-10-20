import createDriverChampionshipCoupon from './driverChampionship'
import { useCoupon, type PodiumDriver } from './useCoupon'

/**
 * Komponisable für die Fahrer-Championship-Wette: ein Fahrer-Pick, dessen
 * Position dem getippten Championship-Rang entspricht.
 */
export function useDriverChampionship (initialPick: PodiumDriver) {
	const { picks, submitting, error, createdId, submit, swapPicks } = useCoupon(
		[initialPick],
		createDriverChampionshipCoupon,
	)

	return { picks, submitting, error, createdId, submit, swapPicks }
}
