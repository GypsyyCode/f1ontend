<template>
	<BetCard
		name="Fahrer Championship Wette"
		:picks="picks"
		subtitle="Dein Tipp auf den Fahrer-Weltmeister"
		:colors="['#FFD700']"
		:submitting="submitting"
		:error="error"
		:created-id="createdId"
		:placed-at="placedAt"
		:session="firstSession"
		:locked="isStarted"
		@submit="submit"
	/>
</template>

<script setup lang="ts">
	import { storeToRefs } from 'pinia'
	import { onMounted } from 'vue'
	import BetCard from '@/components/bet-card/bet-card.vue'
	import { useDriverChampionship } from '@/plugins/coupons/useDriverChampionship'
	import { useSeasonStore } from '@/stores/season'

	const seasonStore = useSeasonStore()
	const { firstSession, isStarted } = storeToRefs(seasonStore)
	onMounted(() => seasonStore.loadCurrent())

	const { picks, submitting, error, createdId, placedAt, submit } = useDriverChampionship(
		{ driver_id: 1, name: 'Max Verstappen' },
	)
</script>
