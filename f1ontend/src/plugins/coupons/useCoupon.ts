import { computed, ref } from 'vue'
import { useCouponsStore, type BetType } from '@/stores/coupons'
import { useAuthStore } from '@/stores/auth'
import { create, type Coupon, type CouponContext, type Placement } from '../coupon'
import type { PodiumDriver } from './types'

export type { PodiumDriver }

/** Baut aus den Picks des Nutzers (+ optionalem Kontext) den zu sendenden Coupon. */
export type CouponBuilder<TData extends object> = (
	placements: Placement[],
	ctx: CouponContext,
) => Coupon<TData>

/**
 * Generischer Hook für eine Wette:
 *  - liest/schreibt Picks + Coupon-ID + Zeitstempel aus dem Pinia-Store
 *    (persistiert via IndexedDB)
 *  - leitet aus der Reihenfolge der Picks die Platzierungen ab (Index + 1)
 *  - übergibt sie an einen Coupon-Builder und schickt den Coupon ans Backend
 *
 * `submitting` / `error` bleiben bewusst lokaler, flüchtiger Composable-State
 * (gehört nicht in den persistierten Store).
 */
export function useCoupon<TData extends object> (
	betType: BetType,
	initialPicks: PodiumDriver[],
	buildCoupon: CouponBuilder<TData>,
	getSessionKey?: () => number | undefined,
) {
	const store = useCouponsStore()
	const auth = useAuthStore()
	store.ensureDefaults(betType, initialPicks)

	const picks = computed<PodiumDriver[]>({
		get: () => store.picks[betType] ?? initialPicks,
		set: value => store.setPicks(betType, value),
	})

	const createdId = computed<string | null>({
		get: () => store.createdIds[betType] ?? null,
		set: value => store.setCreatedId(betType, value),
	})

	const placedAt = computed<string | null>(() => store.placedAt[betType] ?? null)

	const submitting = ref(false)
	const error = ref<string | null>(null)

	async function submit () {
		submitting.value = true
		error.value = null
		createdId.value = null

		try {
			const coupon = buildCoupon(
				picks.value.map((d, i) => ({ driver_id: d.driver_id, position: i + 1 })),
				{ sessionKey: getSessionKey?.() },
			)
			const created = await create(coupon, auth.token ?? undefined)
			createdId.value = created.id
		} catch (e) {
			error.value = e instanceof Error ? e.message : String(e)
		} finally {
			submitting.value = false
		}
	}

	function swapPicks (a: number, b: number) {
		store.swapPicks(betType, a, b)
	}

	/** Setzt den Zustand dieser Wettart (Picks, Coupon-ID, Zeitstempel) komplett zurück. */
	function reset () {
		store.reset(betType)
		store.ensureDefaults(betType, initialPicks)
	}

	return { picks, submitting, error, createdId, placedAt, submit, swapPicks, reset }
}
