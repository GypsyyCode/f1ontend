import type { Coupon } from '../coupon'

/** Schema-Daten einer Wette mit genau einem getippten Fahrer (Pole, schnellste Runde, …). */
export type SingleDriverData = {
	driver_id: number
	/** Session, auf die sich die Wette bezieht (optional). */
	session_key?: number
}

/**
 * Baut einen „Ein-Fahrer"-Coupon (Kategorie "race").
 *
 * @param name       Anzeigename der Wette (Coupon-Name).
 * @param schemaName Backend-Schema (z. B. "polePosition").
 * @param driverId   Getippte driver_number.
 * @param sessionKey Optionaler Session-Key; wird nur gesetzt, wenn vorhanden.
 */
export function createSingleDriverCoupon (
	name: string,
	schemaName: string,
	driverId: number,
	sessionKey?: number,
): Coupon<SingleDriverData> {
	return {
		name,
		category: 'race',
		schemaName,
		data: {
			driver_id: driverId,
			...(sessionKey ? { session_key: sessionKey } : {}),
		},
	}
}
