<template>
	<BetCard
		name="Top 10 Wette"
		:picks="top10"
		subtitle="Deine Top-10-Wette fürs nächste Rennen"
		:submitting="submitting"
		:error="error"
		:created-id="createdId"
		:placed-at="placedAt"
		:session="session"
		:locked="isStarted"
		@submit="submit"
		@reorder="({ from, to }) => swapPicks(from, to)"
	/>
</template>

<script setup lang="ts">
	import { storeToRefs } from 'pinia'
	import { onMounted } from 'vue'
	import BetCard from '@/components/bet-card/bet-card.vue'
	import { useTop10 } from '@/plugins/coupons/useTop10'
	import { useSessionStore } from '@/stores/session'

	const sessionStore = useSessionStore()
	const { session, isStarted } = storeToRefs(sessionStore)
	onMounted(() => sessionStore.loadLatest())

	const { top10, submitting, error, createdId, placedAt, submit, swapPicks } = useTop10([
		{ driver_id: 1, name: 'Max Verstappen' },
		{ driver_id: 12, name: 'Kimi Antonelli' },
		{ driver_id: 44, name: 'Lewis Hamilton' },
		{ driver_id: 4, name: 'Lando Norris' },
		{ driver_id: 16, name: 'Charles Leclerc' },
		{ driver_id: 55, name: 'Carlos Sainz' },
		{ driver_id: 63, name: 'George Russell' },
		{ driver_id: 81, name: 'Oscar Piastri' },
		{ driver_id: 14, name: 'Fernando Alonso' },
		{ driver_id: 11, name: 'Sergio Pérez' },
	])
</script>
