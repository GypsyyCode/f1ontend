import type { Coupon, CouponContext, Placement } from '../coupon'

/**
 * Schema-Daten der "Fahrer Championship Wette".
 *
 * Backend-Schema trägt den JSON-Tag `placement` (Singular). `season_year`
 * wird vom Season-Store gefüttert (für Scoring am Saisonende).
 */
export type DriverChampionshipData = {
	placement: Placement
	season_year?: number
}

export default function createDriverChampionshipCoupon (
	placements: Placement[],
	ctx: CouponContext = {},
): Coupon<DriverChampionshipData> {
	const [placement] = placements
	if (!placement) {
		throw new Error('Fahrer Championship Wette benötigt genau eine Platzierung.')
	}
	return {
		name: 'Fahrer Championship Wette',
		category: 'season',
		schemaName: 'driverChampionshipRank',
		data: {
			placement,
			...(ctx.seasonYear ? { season_year: ctx.seasonYear } : {}),
		},
	}
}
