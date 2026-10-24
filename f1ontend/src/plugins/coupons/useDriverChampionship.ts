import { useSeasonStore } from '@/stores/season'
import createDriverChampionshipCoupon from './driverChampionship'
import type { PodiumDriver } from './types'
import { useCoupon } from './useCoupon'

export function useDriverChampionship (initialPick: PodiumDriver) {
	const season = useSeasonStore()
	const { picks, submitting, error, createdId, placedAt, submit, swapPicks, reset }
		= useCoupon(
			'driverChampionship',
			[initialPick],
			createDriverChampionshipCoupon,
			undefined,
			() => season.year || undefined,
		)
	return { picks, submitting, error, createdId, placedAt, submit, swapPicks, reset }
}
