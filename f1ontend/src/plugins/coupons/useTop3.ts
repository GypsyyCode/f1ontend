import createTop3Coupon from './top3'
import { useCoupon, type PodiumDriver } from './useCoupon'

export type { PodiumDriver }

/**
 * Komponisable für eine Top-3-Wette: hält das Podium, den Request-Status
 * und schickt die Wette per API an das Backend.
 */
export function useTop3 (initialPodium: PodiumDriver[]) {
	const { picks, submitting, error, createdId, submit, swapPicks } = useCoupon(
		initialPodium,
		createTop3Coupon,
	)

	return { podium: picks, submitting, error, createdId, submit, swapPicks }
}
