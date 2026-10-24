import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSeasonStore } from '@/stores/season'
import { create } from '../coupon'
import createConstructorChampionshipCoupon, { type ConstructorChampionshipData } from './constructorChampionship'
import type { TeamPick } from './types'

/**
 * Konstrukteurs-Championship: Nutzer wählt genau ein Team + Rang-Tipp.
 * Eigener (nicht generischer) Submit-Flow, weil die Datenform (team_id,
 * position) nicht in das `Placement`-Schema der anderen Coupons passt.
 */
export function useConstructorChampionship (initialPick: TeamPick, initialRank = 1) {
	const auth = useAuthStore()
	const season = useSeasonStore()

	const pick = ref<TeamPick>(initialPick)
	const rank = ref<number>(initialRank)
	const submitting = ref(false)
	const error = ref<string | null>(null)
	const createdId = ref<string | null>(null)
	const placedAt = ref<string | null>(null)

	async function submit () {
		submitting.value = true
		error.value = null
		try {
			const coupon = createConstructorChampionshipCoupon(
				pick.value.team_id,
				rank.value,
				{ seasonYear: season.year || undefined },
			)
			const created = await create<ConstructorChampionshipData>(coupon, auth.token ?? undefined)
			createdId.value = created.id
			placedAt.value = new Date().toISOString()
		} catch (e) {
			error.value = e instanceof Error ? e.message : String(e)
		} finally {
			submitting.value = false
		}
	}

	function reset () {
		createdId.value = null
		placedAt.value = null
		error.value = null
	}

	return { pick, rank, submitting, error, createdId, placedAt, submit, reset }
}
