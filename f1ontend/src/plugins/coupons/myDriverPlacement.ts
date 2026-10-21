import type { Coupon } from '../coupon'

/** Schema-Daten des „Mein Fahrer"-Platzierungstipps für eine Session. */
export type MyDriverPlacementData = {
	driver_id: number
	position: number
	/** Session, auf die sich der Tipp bezieht (optional). */
	session_key?: number
}

/**
 * Baut den „Mein Fahrer"-Coupon (Kategorie "race", Schema "myDriverPlacement").
 *
 * @param driverId   Der Saison-Fahrer (driver_number).
 * @param position   Getippte Zielplatzierung (1–20).
 * @param sessionKey Optionaler Session-Key.
 */
export function createMyDriverPlacementCoupon (
	driverId: number,
	position: number,
	sessionKey?: number,
): Coupon<MyDriverPlacementData> {
	return {
		name: 'Mein Fahrer',
		category: 'race',
		schemaName: 'myDriverPlacement',
		data: {
			driver_id: driverId,
			position,
			...(sessionKey ? { session_key: sessionKey } : {}),
		},
	}
}
