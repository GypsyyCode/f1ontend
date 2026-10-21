import type { Coupon, CouponContext, Placement } from '../coupon'

/** Schema-Daten der "Top 3 Wette" (genau 3 Platzierungen erwartet). */
export type Top3Data = {
	placements: Placement[]
	/** Session, auf die sich die Wette bezieht (optional; Backend ignoriert sie bis Phase 0). */
	session_key?: number
}

/**
 * Baut eine "Top 3 Wette" für die Coupon-API (Kategorie "race", Schema "top3coupon").
 *
 * @param placements Genau 3 Platzierungen (Fahrer auf Position 1–3).
 * @param ctx        Optionaler Kontext; `sessionKey` wird – falls gesetzt – als
 *                   `session_key` mitgeschickt.
 */
export default function createTop3Coupon (
	placements: Placement[],
	ctx: CouponContext = {},
): Coupon<Top3Data> {
	return {
		name: 'Top 3 Wette',
		category: 'race',
		schemaName: 'top3coupon',
		data: {
			placements,
			...(ctx.sessionKey ? { session_key: ctx.sessionKey } : {}),
		},
	}
}
