import { ref } from 'vue'
import { listCoupons, type CreatedCoupon, type Placement } from '../coupon'
import { listDrivers, type DriverInfo } from '../drivers'

/** Eine normalisierte Zeile der Wettschein-Matrix (ein Wetttyp). */
export type WettscheinRow = {
	key: string
	/** Anzeigename der Wettart (z. B. "Top 3"). */
	name: string
	/** Platzierungen des zuletzt platzierten Coupons dieser Wettart (leer wenn keiner). */
	placements: Placement[]
	/** Coupon-ID des zuletzt platzierten Coupons (für die Anzeige). */
	couponId?: string
}

type PlacementsSchema = { placements: Placement[] }
type PlacementSchema = { placement: Placement }

/** Nimmt den jüngsten Coupon einer Liste (API liefert ohne definierten Sort). */
function latest<T> (coupons: CreatedCoupon<T>[]): CreatedCoupon<T> | undefined {
	return coupons.at(-1)
}

/**
 * Lädt pro Wettart den jüngsten Coupon sowie die Fahrerliste parallel und
 * baut daraus die Zeilen der Wettschein-Matrix.
 */
export function useWettschein () {
	const rows = ref<WettscheinRow[]>([])
	const drivers = ref<Record<number, DriverInfo>>({})
	const loading = ref(false)
	const error = ref<string | null>(null)

	async function load () {
		loading.value = true
		error.value = null

		try {
			const [top3, top10, driverChamp, constructorChamp, teamDuell, driverList] = await Promise.all([
				listCoupons<PlacementsSchema>('race', 'top3coupon'),
				listCoupons<PlacementsSchema>('race', 'top10coupon'),
				listCoupons<PlacementSchema>('season', 'driverChampionshipRank'),
				listCoupons<PlacementSchema>('season', 'constructorChampionshipRank'),
				listCoupons<PlacementsSchema>('season', 'teamDuell'),
				// Fahrerliste ist optional – ohne sie zeigen wir nur die Fahrer-ID.
				listDrivers().catch(() => [] as DriverInfo[]),
			])

			drivers.value = Object.fromEntries(driverList.map(d => [d.driver_number, d]))

			const latestTop3 = latest(top3)
			const latestTop10 = latest(top10)
			const latestDriverChamp = latest(driverChamp)
			const latestConstructorChamp = latest(constructorChamp)
			const latestTeamDuell = latest(teamDuell)

			rows.value = [
				{
					key: 'top3',
					name: 'Top 3',
					placements: latestTop3?.schema.data.placements ?? [],
					couponId: latestTop3?.id,
				},
				{
					key: 'top10',
					name: 'Top 10',
					placements: latestTop10?.schema.data.placements ?? [],
					couponId: latestTop10?.id,
				},
				{
					key: 'driverChampionship',
					name: 'Fahrer-WM',
					placements: latestDriverChamp ? [latestDriverChamp.schema.data.placement] : [],
					couponId: latestDriverChamp?.id,
				},
				{
					key: 'constructorChampionship',
					name: 'Konstrukteurs-WM',
					placements: latestConstructorChamp ? [latestConstructorChamp.schema.data.placement] : [],
					couponId: latestConstructorChamp?.id,
				},
				{
					key: 'teamDuell',
					name: 'Team-Duell',
					placements: latestTeamDuell?.schema.data.placements ?? [],
					couponId: latestTeamDuell?.id,
				},
			]
		} catch (e) {
			error.value = e instanceof Error ? e.message : String(e)
		} finally {
			loading.value = false
		}
	}

	return { rows, drivers, loading, error, load }
}
