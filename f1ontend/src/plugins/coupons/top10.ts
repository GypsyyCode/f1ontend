import type { Coupon, Placement } from '../coupon'

/** Schema-Daten der "Top 10 Wette" (genau 10 Platzierungen erwartet). */
export type Top10Data = {
	placements: Placement[]
}

/**
 * Baut eine "Top 10 Wette" für die Coupon-API (Kategorie "race", Schema "top10coupon").
 *
 * @param placements Genau 10 Platzierungen (Fahrer auf Position 1–10).
 */
export default function createTop10Coupon (placements: Placement[]): Coupon<Top10Data> {
	return {
		name: 'Top 10 Wette',
		category: 'race',
		schemaName: 'top10coupon',
		data: { placements },
	}
}
