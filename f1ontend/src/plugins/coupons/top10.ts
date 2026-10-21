import type { Coupon, CouponContext, Placement } from '../coupon'

/** Schema-Daten der "Top 10 Wette" (genau 10 Platzierungen erwartet). */
export type Top10Data = {
	placements: Placement[]
	/** Session, auf die sich die Wette bezieht (optional; Backend ignoriert sie bis Phase 0). */
	session_key?: number
}

/**
 * Baut eine "Top 10 Wette" für die Coupon-API (Kategorie "race", Schema "top10coupon").
 *
 * @param placements Genau 10 Platzierungen (Fahrer auf Position 1–10).
 * @param ctx        Optionaler Kontext; `sessionKey` wird – falls gesetzt – als
 *                   `session_key` mitgeschickt.
 */
export default function createTop10Coupon (
	placements: Placement[],
	ctx: CouponContext = {},
): Coupon<Top10Data> {
	return {
		name: 'Top 10 Wette',
		category: 'race',
		schemaName: 'top10coupon',
		data: {
			placements,
			...(ctx.sessionKey ? { session_key: ctx.sessionKey } : {}),
		},
	}
}
