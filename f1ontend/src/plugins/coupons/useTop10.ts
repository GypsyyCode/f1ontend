import createTop10Coupon from './top10'
import type { PodiumDriver } from './types'
import { useCoupon } from './useCoupon'

/**
 * Komponisable für eine Top-10-Wette: hält die 10 getippten Fahrer (via
 * Pinia-Store, persistiert in IndexedDB) in der Reihenfolge der Zielplatzierungen
 * und schickt die Wette an das Backend.
 */
export function useTop10 (initialTop10: PodiumDriver[]) {
	const { picks, submitting, error, createdId, placedAt, submit, swapPicks, reset }
		= useCoupon('top10', initialTop10, createTop10Coupon)

	return { top10: picks, submitting, error, createdId, placedAt, submit, swapPicks, reset }
}
