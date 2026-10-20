<template>
	<BetCard
		name="Fahrer Championship Wette"
		:picks="picks"
		subtitle="Dein Tipp auf den Fahrer-Weltmeister"
		:colors="['#FFD700']"
		:submitting="submitting"
		:error="error"
		:created-id="createdId"
		@submit="submit"
	/>
</template>

<script setup lang="ts">
	import BetCard from '@/components/bet-card/bet-card.vue'
	import { useDriverChampionship } from '@/plugins/coupons/useDriverChampionship'

	const { picks, submitting, error, createdId, submit } = useDriverChampionship(
		{ driver_id: 1, name: 'Max Verstappen' },
	)
</script>
