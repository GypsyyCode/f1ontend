import type { Coupon, Placement } from '../coupon'

/** Schema-Daten der "Team Duell Wette" (genau 2 Platzierungen). */
export type TeamDuellData = {
	placements: Placement[]
}

/**
 * Baut eine "Team Duell Wette".
 *
 * Achtung: Das Backend-Schema liegt zwar im Package `team`, meldet seine
 * Kategorie in `Meta()` aber als `Season` – daraus baut der Server die Route
 * `/api/v1/coupons/season/teamDuell`. Daher ist category hier bewusst
 * `"season"` und nicht `"team"`.
 */
export default function createTeamDuellCoupon (placements: Placement[]): Coupon<TeamDuellData> {
	return {
		name: 'Team Duell Wette',
		category: 'season',
		schemaName: 'teamDuell',
		data: { placements },
	}
}
