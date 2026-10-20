import createTeamDuellCoupon from './teamDuell'
import { useCoupon, type PodiumDriver } from './useCoupon'

/**
 * Komponisable für die Team-Duell-Wette: zwei Picks (Sieger auf Position 1,
 * Verlierer auf Position 2 des Duells).
 */
export function useTeamDuell (initialPicks: [PodiumDriver, PodiumDriver]) {
	const { picks, submitting, error, createdId, submit, swapPicks } = useCoupon(
		initialPicks,
		createTeamDuellCoupon,
	)

	return { picks, submitting, error, createdId, submit, swapPicks }
}
