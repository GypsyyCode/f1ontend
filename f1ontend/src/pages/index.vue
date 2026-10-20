<template>
	<BetCard
		name="Top 3 Wette"
		:picks="podium"
		subtitle="Deine Top-3-Wette fürs nächste Rennen"
		:colors="['#FFD700', '#C0C0C0', '#CD7F32']"
		:submitting="submitting"
		:error="error"
		:created-id="createdId"
		:placed-at="placedAt"
		@submit="submit"
		@reorder="({ from, to }) => swapPicks(from, to)"
	/>
</template>

<script setup lang="ts">
	import BetCard from '@/components/bet-card/bet-card.vue'
	import { useTop3 } from '@/plugins/coupons/useTop3'

	const { podium, submitting, error, createdId, placedAt, submit, swapPicks } = useTop3([
		{ driver_id: 1, name: 'Max Verstappen' },
		{ driver_id: 12, name: 'Kimi Antonelli' },
		{ driver_id: 44, name: 'Lewis Hamilton' },
	])
</script>
