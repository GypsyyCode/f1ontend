import type { Coupon, CouponContext, Placement } from '../coupon'

/** Schema-Daten der "Team Duell Wette" (genau 2 Platzierungen). */
export type TeamDuellData = {
	placements: Placement[]
	/** Saisonjahr; wird vom Season-Store gefüttert. Backend ignoriert ohne. */
	season_year?: number
}

/**
 * Baut eine "Team Duell Wette".
 *
 * Backend-Package liegt in `team`, Kategorie ist aber `Season` (Route
 * `/api/v1/coupons/season/teamDuell`) — kein Tippfehler. Mit `ctx.seasonYear`
 * wird `season_year` ins Schema geschrieben, Pflicht für Season-Scoring.
 */
export default function createTeamDuellCoupon (
	placements: Placement[],
	ctx: CouponContext = {},
): Coupon<TeamDuellData> {
	return {
		name: 'Team Duell Wette',
		category: 'season',
		schemaName: 'teamDuell',
		data: {
			placements,
			...(ctx.seasonYear ? { season_year: ctx.seasonYear } : {}),
		},
	}
}
