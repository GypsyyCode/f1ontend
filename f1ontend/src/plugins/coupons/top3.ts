import type { Coupon, Placement } from '../coupon'

/** Schema-Daten der "Top 3 Wette" (genau 3 Platzierungen erwartet). */
export type Top3Data = {
	placements: Placement[]
}

/**
 * Baut eine "Top 3 Wette" für die Coupon-API (Kategorie "race", Schema "top3coupon").
 *
 * @param placements Genau 3 Platzierungen (Fahrer auf Position 1–3).
 */
export default function createTop3Coupon (placements: Placement[]): Coupon<Top3Data> {
	return {
		name: 'Top 3 Wette',
		category: 'race',
		schemaName: 'top3coupon',
		data: { placements },
	}
}
