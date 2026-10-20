<template>
	<BetCard
		name="Constructor Championship Wette"
		:picks="picks"
		subtitle="Dein Tipp auf den Konstrukteurs-Weltmeister"
		:colors="['#FFD700']"
		:submitting="submitting"
		:error="error"
		:created-id="createdId"
		@submit="submit"
	/>
</template>

<script setup lang="ts">
	import BetCard from '@/components/bet-card/bet-card.vue'
	import { useConstructorChampionship } from '@/plugins/coupons/useConstructorChampionship'

	const { picks, submitting, error, createdId, submit } = useConstructorChampionship(
		{ driver_id: 1, name: 'Red Bull Racing' },
	)
</script>
