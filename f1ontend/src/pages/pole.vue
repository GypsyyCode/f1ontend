<template>
	<SingleDriverBetCard
		name="Pole Position"
		subtitle="Wer holt sich die Pole im Qualifying?"
		:session="session"
		:locked="isStarted"
		:driver="driver"
		:created-id="createdId"
		:placed-at="placedAt"
		:submitting="submitting"
		:error="error"
		@update:driver="d => driver = d"
		@submit="submit"
	/>
</template>

<script setup lang="ts">
	import { storeToRefs } from 'pinia'
	import { onMounted } from 'vue'
	import SingleDriverBetCard from '@/components/single-driver-bet/single-driver-bet-card.vue'
	import { useDriverBet } from '@/plugins/coupons/useDriverBet'
	import { useSessionStore } from '@/stores/session'

	const sessionStore = useSessionStore()
	const { session, isStarted } = storeToRefs(sessionStore)
	onMounted(() => sessionStore.loadLatest())

	const { driver, submitting, error, createdId, placedAt, submit } = useDriverBet('pole', 'polePosition', 'Pole Position')
</script>
