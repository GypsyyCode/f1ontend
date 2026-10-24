import type { Coupon, CouponContext } from '../coupon'

/**
 * Schema-Daten der "Constructor Championship Wette".
 *
 * Backend-Schema (neu, mit Team-ID): placement.team_id = Team-ID,
 * placement.position = getippter WM-Rang.
 */
export type ConstructorChampionshipData = {
	placement: {
		team_id: number
		position: number
	}
	season_year?: number
}

export default function createConstructorChampionshipCoupon (
	teamId: number,
	rank: number,
	ctx: CouponContext = {},
): Coupon<ConstructorChampionshipData> {
	return {
		name: 'Constructor Championship Wette',
		category: 'season',
		schemaName: 'constructorChampionshipRank',
		data: {
			placement: { team_id: teamId, position: rank },
			...(ctx.seasonYear ? { season_year: ctx.seasonYear } : {}),
		},
	}
}
