import { ref } from 'vue'
import { create, type Coupon, type Placement } from '../coupon'

export type PodiumDriver = {
	driver_id: number
	name: string
}

/** Baut aus den Picks des Nutzers den zu sendenden Coupon. */
export type CouponBuilder<TData extends object> = (placements: Placement[]) => Coupon<TData>

/**
 * Generischer Hook für eine Wette:
 * - hält die Fahrer-Picks und den Request-Status
 * - leitet aus der Reihenfolge der Picks die Platzierungen ab (Index + 1)
 * - übergibt sie an einen Coupon-Builder und schickt den Coupon an das Backend.
 */
export function useCoupon<TData extends object> (
	initialPicks: PodiumDriver[],
	buildCoupon: CouponBuilder<TData>,
) {
	const picks = ref<PodiumDriver[]>(initialPicks)
	const submitting = ref(false)
	const error = ref<string | null>(null)
	const createdId = ref<string | null>(null)

	async function submit () {
		submitting.value = true
		error.value = null
		createdId.value = null

		try {
			const coupon = buildCoupon(
				picks.value.map((d, i) => ({ driver_id: d.driver_id, position: i + 1 })),
			)
			const created = await create(coupon)
			createdId.value = created.id
		} catch (e) {
			error.value = e instanceof Error ? e.message : String(e)
		} finally {
			submitting.value = false
		}
	}

	/**
	 * Tauscht die Picks an den Indizes `a` und `b`.
	 * Indizes sind 0-basiert; ungültige Indizes oder `a === b` sind no-ops.
	 *
	 * Beispiel: swapPicks(0, 6) macht aus [A,B,C,D,E,F,G,H] → [G,B,C,D,E,F,A,H].
	 */
	function swapPicks (a: number, b: number) {
		const arr = picks.value
		if (a === b) return
		if (a < 0 || a >= arr.length) return
		if (b < 0 || b >= arr.length) return

		const next = [...arr]
		;[next[a], next[b]] = [next[b], next[a]]
		picks.value = next
	}

	return { picks, submitting, error, createdId, submit, swapPicks }
}
