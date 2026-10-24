<template>
	<v-container fluid class="mt-8 h-full flex items-center w-full flex-col grow">
		<div class="flex flex-col grow w-full max-w-5xl mx-auto gap-6">
			<!-- Saison-Fahrer / Hero -->
			<v-card class="py-6 px-6 shape-lg" variant="flat">
				<div class="text-[10px] tracking-[0.3em] text-neutral-500">F1 TIPSPIEL · MEIN FAHRER</div>

				<div v-if="driverName && !editDriver" class="flex items-center gap-5 mt-4">
					<div class="hero-badge">{{ driverAcronym ?? '—' }}</div>
					<div class="flex-1 min-w-0">
						<div class="text-[10px] tracking-[0.3em] text-neutral-500">DEIN SAISON-FAHRER</div>
						<div class="text-3xl font-bold tracking-tight truncate">{{ driverName }}</div>
					</div>
					<v-btn variant="text" size="small" prepend-icon="mdi-pencil" @click="editDriver = true">
						Ändern
					</v-btn>
				</div>

				<div v-else class="mt-4">
					<div class="text-xl font-bold mb-1">Wähle deinen Saison-Fahrer</div>
					<div class="text-sm text-neutral-500 mb-4">
						Auf diesen Fahrer tippst du die ganze Saison über – Session für Session.
					</div>
					<DriverSelect
						:model-value="driverId"
						label="Saison-Fahrer"
						@select="onSelectSeasonDriver"
					/>
				</div>
			</v-card>

			<!-- Session-Platzierungstipp -->
			<v-card class="py-6 px-6 shape-lg" variant="flat">
				<div class="text-xl font-bold mb-1">Platzierungs-Tipp</div>

				<div v-if="!driverId" class="text-sm text-neutral-500">
					Wähle zuerst oben deinen Saison-Fahrer.
				</div>

				<template v-else>
					<div v-if="session" class="mb-3">
						<div class="text-[10px] tracking-[0.3em] text-neutral-500">TIPP FÜR</div>
						<div class="text-sm">
							<strong>{{ session.country_name }}</strong>
							<span class="text-neutral-500"> · {{ session.session_name }}</span>
						</div>
					</div>

					<v-alert v-if="locked" type="warning" variant="tonal" class="mb-3">
						Diese Session hat bereits begonnen – ein Tipp ist nicht mehr möglich.
					</v-alert>

					<!-- Bestätigung -->
					<div
						v-if="createdId"
						class="font-mono rounded-xl p-6 text-center"
						style="border: 2px dashed #c0b89a; background: #fef9ec;"
					>
						<v-icon icon="mdi-check-decagram" size="40" class="text-green-700" />
						<div class="mt-2 text-sm">
							Tipp: <strong>{{ driverName }}</strong> wird <strong>P{{ position }}</strong>
						</div>
						<div class="mt-3 text-[10px] tracking-[0.3em] text-neutral-500">WETTSCHEIN-NR.</div>
						<div class="font-sans text-xs tracking-wider text-neutral-800 break-all">{{ createdId }}</div>
						<div v-if="placedAt" class="text-[11px] font-sans text-neutral-600 mt-2">
							ausgestellt am <strong>{{ placedAt }}</strong>
						</div>
					</div>

					<!-- Platzierungs-Dial -->
					<template v-else>
						<div class="text-sm text-neutral-500 mb-2">
							Auf welcher Position landet <strong>{{ driverName }}</strong>?
						</div>
						<div class="flex items-center gap-4">
							<v-btn icon="mdi-minus" variant="tonal" :disabled="locked || position <= 1" @click="dec" />
							<div class="dial">P{{ position }}</div>
							<v-btn icon="mdi-plus" variant="tonal" :disabled="locked || position >= 20" @click="inc" />
							<v-spacer />
							<v-btn
								:loading="submitting"
								:disabled="submitting || locked"
								color="primary"
								@click="submit"
							>
								Tipp abgeben
							</v-btn>
						</div>
					</template>

					<v-alert v-if="error" type="error" class="mt-3">{{ error }}</v-alert>
				</template>
			</v-card>

			<!-- Saison-Verlauf (Punkte folgen mit dem Backend-Scoring) -->
			<v-card class="py-5 px-6 shape-lg" variant="flat">
				<div class="text-xl font-bold mb-1">Saison-Verlauf</div>
				<div class="text-sm text-neutral-500">
					Pro Session: Tipp → Ergebnis → Punkte. Die Punkte erscheinen hier, sobald das
					Backend die Session gewertet hat (exakt = 3, ±1 = 1, sonst 0).
				</div>
			</v-card>
		</div>
	</v-container>
</template>

<script setup lang="ts">
	import { storeToRefs } from 'pinia'
	import { onMounted, ref } from 'vue'
	import DriverSelect from '@/components/driver-select/driver-select.vue'
	import { useMeinFahrer } from '@/plugins/coupons/useMeinFahrer'
	import type { DriverInfo } from '@/plugins/drivers'
	import { useMeinFahrerStore } from '@/stores/meinFahrer'
	import { useSessionStore } from '@/stores/session'

	const meinFahrerStore = useMeinFahrerStore()
	const { driverId, driverName, driverAcronym } = storeToRefs(meinFahrerStore)

	const sessionStore = useSessionStore()
	const { session, isStarted: locked } = storeToRefs(sessionStore)
	onMounted(() => sessionStore.loadLatest())

	const { position, submitting, error, createdId, placedAt, submit } = useMeinFahrer()

	const editDriver = ref(false)

	function onSelectSeasonDriver (d: DriverInfo | null) {
		meinFahrerStore.setDriver(d ? { driver_id: d.driver_number, name: d.full_name, acronym: d.name_acronym } : null)
		editDriver.value = false
	}

	function inc () {
		if (position.value < 20) position.value++
	}
	function dec () {
		if (position.value > 1) position.value--
	}
</script>

<style scoped>
.hero-badge {
	width: 64px;
	height: 64px;
	border-radius: 12px;
	display: flex;
	align-items: center;
	justify-content: center;
	font-family: monospace;
	font-weight: 700;
	font-size: 20px;
	color: #171717;
	background: #fef9ec;
	border: 2px solid #c0b89a;
	flex-shrink: 0;
}
.dial {
	min-width: 84px;
	text-align: center;
	font-family: monospace;
	font-weight: 700;
	font-size: 28px;
}
</style>
