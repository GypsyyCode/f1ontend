import type { Coupon, Placement } from '../coupon'

/**
 * Schema-Daten der "Constructor Championship Wette".
 *
 * Analog zur Fahrer-Championship liegt die Platzierung unter dem Schlüssel
 * `placement` (Singular), wie es das Backend-Schema vorgibt.
 */
export type ConstructorChampionshipData = {
	placement: Placement
}

/**
 * Baut eine "Constructor Championship Wette" (Kategorie "season", Schema
 * "constructorChampionshipRank"). Erwartet genau eine Platzierung.
 */
export default function createConstructorChampionshipCoupon (
	placements: Placement[],
): Coupon<ConstructorChampionshipData> {
	const [placement] = placements
	if (!placement) {
		throw new Error('Constructor Championship Wette benötigt genau eine Platzierung.')
	}

	return {
		name: 'Constructor Championship Wette',
		category: 'season',
		schemaName: 'constructorChampionshipRank',
		data: { placement },
	}
}
