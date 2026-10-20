import type { Coupon, Placement } from '../coupon'

/**
 * Schema-Daten der "Fahrer Championship Wette".
 *
 * Hintergrund: Im Backend ist das Schema eine eingebettete `Placement` mit
 * dem JSON-Tag `placement` (Singular), die Daten liegen also unter `placement`
 * und *nicht* unter `placements`.
 */
export type DriverChampionshipData = {
	placement: Placement
}

/**
 * Baut eine "Fahrer Championship Wette" (Kategorie "season", Schema
 * "driverChampionshipRank"). Erwartet genau eine Platzierung, deren Position
 * dem getippten Championship-Rang entspricht.
 */
export default function createDriverChampionshipCoupon (
	placements: Placement[],
): Coupon<DriverChampionshipData> {
	const [placement] = placements
	if (!placement) {
		throw new Error('Fahrer Championship Wette benötigt genau eine Platzierung.')
	}

	return {
		name: 'Fahrer Championship Wette',
		category: 'season',
		schemaName: 'driverChampionshipRank',
		data: { placement },
	}
}
