<template>
	<v-card v-if="!createdId" class="custom-height py-3 rounded-3xl" rounded="3xl" variant="flat">
		<div v-if="firstSession" class="px-4 pt-4">
			<div class="text-[10px] tracking-[0.3em] text-neutral-500">TIPP FÜR SAISON</div>
			<div class="text-sm">
				<strong>{{ year }}</strong>
				<span class="text-neutral-500"> · Start am {{ formatDate(firstSession.date_start) }}</span>
			</div>
		</div>

		<v-alert v-if="isStarted" type="warning" variant="tonal" class="mx-4 mt-3">
			Die Saison hat bereits begonnen – ein Tipp ist nicht mehr möglich.
		</v-alert>

		<div class="px-4 mt-3">
			<v-select
				v-model="selectedTeam"
				:items="teamItems"
				label="Team"
				variant="outlined"
				:disabled="isStarted || submitting"
			/>
			<v-text-field
				v-model.number="rank"
				type="number"
				min="1"
				max="20"
				label="WM-Rang (1 = Weltmeister)"
				variant="outlined"
				:disabled="isStarted || submitting"
			/>
		</div>

		<v-card-actions class="justify-end">
			<v-btn
				class="bg-taupe-500 text-taupe-100"
				:loading="submitting"
				:disabled="submitting || isStarted || !selectedTeam"
				color="primary"
				@click="onSubmit"
			>
				Wette abschließen
			</v-btn>
		</v-card-actions>

		<v-alert v-if="error" type="error" class="mt-3">{{ error }}</v-alert>
	</v-card>

	<v-card v-else class="custom-height py-3 rounded-3xl text-center" rounded="3xl" variant="flat">
		<div class="text-sm text-neutral-500">Wette platziert · {{ placedAt }}</div>
		<div class="text-xs">ID: {{ createdId }}</div>
		<v-btn variant="plain" @click="reset">Neue Wette</v-btn>
	</v-card>
</template>

<script setup lang="ts">
	import { storeToRefs } from 'pinia'
	import { computed, onMounted, ref } from 'vue'
	import { listTeams, type Team } from '@/plugins/season'
	import { useConstructorChampionship } from '@/plugins/coupons/useConstructorChampionship'
	import { useSeasonStore } from '@/stores/season'

	const seasonStore = useSeasonStore()
	const { year, firstSession, isStarted } = storeToRefs(seasonStore)

	const { pick, rank, submitting, error, createdId, placedAt, submit, reset } = useConstructorChampionship(
		{ team_id: 0, name: '' },
		1,
	)

	const teams = ref<Team[]>([])

	const teamItems = computed(() => teams.value.map(t => ({ title: t.team_name, value: t.id })))
	const selectedTeam = computed({
		get: () => pick.value.team_id,
		set: (id: number) => {
			const t = teams.value.find(x => x.id === id)
			if (t) pick.value = { team_id: t.id, name: t.team_name }
		},
	})

	onMounted(async () => {
		await seasonStore.loadCurrent()
		try {
			teams.value = await listTeams()
			if (pick.value.team_id === 0 && teams.value.length > 0) {
				pick.value = { team_id: teams.value[0].id, name: teams.value[0].team_name }
			}
		} catch (e) {
			// Teams-Load schlägt fehl → Button bleibt disabled über !selectedTeam
			console.error('[constructorChampionship] listTeams failed:', e)
		}
	})

	function onSubmit () {
		void submit()
	}

	function formatDate (iso: string): string {
		return new Date(iso).toLocaleDateString('de-DE', {
			day: '2-digit', month: '2-digit', year: 'numeric',
		})
	}
</script>
