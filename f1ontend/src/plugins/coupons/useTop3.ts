import { ref } from 'vue'
import { create } from '../coupon'
import createTop3Coupon from './top3'

export type PodiumDriver = {
	driver_id: number
	name: string
}

/**
 * Komponisable für eine Top-3-Wette: hält das Podium, den Request-Status
 * und schickt die Wette per API an das Backend.
 */
export function useTop3 (initialPodium: PodiumDriver[]) {
	const podium = ref<PodiumDriver[]>(initialPodium)
	const submitting = ref(false)
	const error = ref<string | null>(null)
	const createdId = ref<string | null>(null)

	async function submit () {
		submitting.value = true
		error.value = null
		createdId.value = null

		try {
			const coupon = createTop3Coupon(
				podium.value.map((d, i) => ({ driver_id: d.driver_id, position: i + 1 })),
			)
			const created = await create(coupon)
			createdId.value = created.id
		} catch (e) {
			error.value = e instanceof Error ? e.message : String(e)
		} finally {
			submitting.value = false
		}
	}

	return { podium, submitting, error, createdId, submit }
}
