<template>
	<BetCard
		name="Team Duell Wette"
		:picks="picks"
		subtitle="Dein Tipp: Sieger und Verlierer des Team-Duells"
		:colors="['#FFD700', '#C0C0C0']"
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
	import { useTeamDuell } from '@/plugins/coupons/useTeamDuell'

	const { picks, submitting, error, createdId, placedAt, submit, swapPicks } = useTeamDuell([
		{ driver_id: 1, name: 'Max Verstappen' },
		{ driver_id: 11, name: 'Sergio Pérez' },
	])
</script>
