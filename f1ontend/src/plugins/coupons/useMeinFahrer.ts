import { computed, ref } from 'vue'
import { useCouponsStore } from '@/stores/coupons'
import { useMeinFahrerStore } from '@/stores/meinFahrer'
import { useSessionStore } from '@/stores/session'
import { create } from '../coupon'
import { createMyDriverPlacementCoupon } from './myDriverPlacement'

/**
 * Hook für den „Mein Fahrer"-Session-Tipp: nimmt den Saison-Fahrer aus dem
 * meinFahrer-Store, die getippte Platzierung und die aktive Session und
 * schickt den Platzierungs-Coupon ans Backend.
 */
export function useMeinFahrer () {
	const meinFahrer = useMeinFahrerStore()
	const session = useSessionStore()
	const store = useCouponsStore()

	/** Getippte Zielplatzierung (1–20). */
	const position = ref(1)

	const createdId = computed<string | null>({
		get: () => store.createdIds.myDriverPlacement ?? null,
		set: value => store.setCreatedId('myDriverPlacement', value),
	})
	const placedAt = computed<string | null>(() => store.placedAt.myDriverPlacement ?? null)

	const submitting = ref(false)
	const error = ref<string | null>(null)

	async function submit () {
		if (!meinFahrer.driverId) {
			error.value = 'Bitte zuerst deinen Saison-Fahrer wählen.'
			return
		}
		submitting.value = true
		error.value = null
		createdId.value = null
		try {
			const coupon = createMyDriverPlacementCoupon(
				meinFahrer.driverId,
				position.value,
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

	return { position, submitting, error, createdId, placedAt, submit }
}
