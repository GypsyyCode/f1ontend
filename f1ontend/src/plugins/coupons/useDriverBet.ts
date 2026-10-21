import { computed, ref } from 'vue'
import { useCouponsStore, type BetType } from '@/stores/coupons'
import { useSessionStore } from '@/stores/session'
import { create } from '../coupon'
import { createSingleDriverCoupon } from './singleDriver'
import type { PodiumDriver } from './types'

/**
 * Generischer Hook für „Ein-Fahrer"-Wetten (Pole, schnellste Runde, erster
 * Ausfall, Fahrer des Tages). Hält den gewählten Fahrer als 1-Element-Pick im
 * Coupons-Store (persistiert via IndexedDB) und schickt den Coupon ans Backend.
 *
 * @param betType    Schlüssel im Coupons-Store.
 * @param schemaName Backend-Schema-Name.
 * @param name       Anzeigename der Wette.
 */
export function useDriverBet (betType: BetType, schemaName: string, name: string) {
	const store = useCouponsStore()
	const session = useSessionStore()

	const driver = computed<PodiumDriver | null>({
		get: () => store.picks[betType]?.[0] ?? null,
		set: value => store.setPicks(betType, value ? [value] : []),
	})

	const createdId = computed<string | null>({
		get: () => store.createdIds[betType] ?? null,
		set: value => store.setCreatedId(betType, value),
	})
	const placedAt = computed<string | null>(() => store.placedAt[betType] ?? null)

	const submitting = ref(false)
	const error = ref<string | null>(null)

	async function submit () {
		if (!driver.value) {
			error.value = 'Bitte zuerst einen Fahrer wählen.'
			return
		}
		submitting.value = true
		error.value = null
		createdId.value = null
		try {
			const coupon = createSingleDriverCoupon(
				name,
				schemaName,
				driver.value.driver_id,
				session.sessionKey || undefined,
			)
			const created = await create(coupon)
			createdId.value = created.id
		} catch (e) {
			error.value = e instanceof Error ? e.message : String(e)
		} finally {
			submitting.value = false
		}
	}

	function reset () {
		store.reset(betType)
	}

	return { driver, submitting, error, createdId, placedAt, submit, reset }
}
