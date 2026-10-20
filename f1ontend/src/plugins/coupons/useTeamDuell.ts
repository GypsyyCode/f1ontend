import createTeamDuellCoupon from './teamDuell'
import type { PodiumDriver } from './types'
import { useCoupon } from './useCoupon'

/**
 * Komponisable für die Team-Duell-Wette: zwei Picks (Sieger auf Position 1,
 * Verlierer auf Position 2 des Duells). State liegt im Pinia-Store und wird
 * in IndexedDB persistiert.
 */
export function useTeamDuell (initialPicks: [PodiumDriver, PodiumDriver]) {
	const { picks, submitting, error, createdId, placedAt, submit, swapPicks, reset }
		= useCoupon('teamDuell', initialPicks, createTeamDuellCoupon)

	return { picks, submitting, error, createdId, placedAt, submit, swapPicks, reset }
}
