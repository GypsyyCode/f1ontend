import { useSessionStore } from '@/stores/session'
import createTop3Coupon from './top3'
import type { PodiumDriver } from './types'
import { useCoupon } from './useCoupon'

export type { PodiumDriver }

/**
 * Komponisable für eine Top-3-Wette: hält das Podium (via Pinia-Store,
 * persistiert in IndexedDB), den Request-Status und schickt die Wette per
 * API an das Backend.
 */
export function useTop3 (initialPodium: PodiumDriver[]) {
	const session = useSessionStore()
	const { picks, submitting, error, createdId, placedAt, submit, swapPicks, reset }
		= useCoupon('top3', initialPodium, createTop3Coupon, () => session.sessionKey || undefined)

	return { podium: picks, submitting, error, createdId, placedAt, submit, swapPicks, reset }
}
