import createConstructorChampionshipCoupon from './constructorChampionship'
import { useCoupon, type PodiumDriver } from './useCoupon'

/**
 * Komponisable für die Constructor-Championship-Wette: ein Pick, dessen
 * Position dem getippten Konstrukteurs-Championship-Rang entspricht.
 */
export function useConstructorChampionship (initialPick: PodiumDriver) {
	const { picks, submitting, error, createdId, submit, swapPicks } = useCoupon(
		[initialPick],
		createConstructorChampionshipCoupon,
	)

	return { picks, submitting, error, createdId, submit, swapPicks }
}
