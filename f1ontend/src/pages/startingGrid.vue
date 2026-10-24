<template>
	<v-container fluid class="mt-8 h-full flex items-center w-full flex-col grow">
		<div class="flex flex-col grow w-full max-w-5xl mx-auto">
			<v-container>
				<v-card class="py-5 px-6 shape-lg" variant="flat">
					<div class="mb-4">
						<div class="text-[10px] tracking-[0.3em] text-neutral-500">F1 TIPSPIEL · ÜBERSICHT</div>
						<div class="text-xl font-bold">Startaufstellung</div>
						<div v-if="latestSession" class="text-sm text-neutral-700 mt-1">
							<strong>{{ latestSession.country_name }}</strong>
							<span class="text-neutral-500"> · {{ latestSession.session_name }}</span>
							<span class="text-neutral-500"> · {{ formatSessionDate(latestSession.date_start) }}</span>
						</div>
						<div class="text-xs text-neutral-500 mt-1">
							Automatisch für die jüngste Session geladen; Session-Key manuell anpassbar.
						</div>
					</div>

					<div class="grid gap-3 md:grid-cols-[1fr_auto] items-end mb-4">
						<v-text-field
							v-model.number="sessionKey"
							type="number"
							label="Session-Key"
							hint="OpenF1-Session (z. B. 9636)"
							persistent-hint
							density="comfortable"
							hide-spin-buttons
						/>
						<div class="flex gap-2">
							<v-btn
								:loading="loading"
								:disabled="loading || !sessionKey"
								color="primary"
								prepend-icon="mdi-cloud-download"
								@click="sync"
							>
								Synchronisieren
							</v-btn>
							<v-btn
								:loading="loading"
								:disabled="loading || !sessionKey"
								variant="tonal"
								prepend-icon="mdi-refresh"
								@click="reload"
							>
								Nur laden
							</v-btn>
						</div>
					</div>

					<v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>

					<div v-if="orderedEntries.length === 0 && !loading && !error" class="text-sm text-neutral-500 italic">
						Noch keine Grid-Daten – Session-Key eintragen und "Synchronisieren" klicken.
					</div>

					<div v-else class="overflow-x-auto">
						<table class="w-full border-separate border-spacing-y-1">
							<thead>
								<tr class="text-left text-xs tracking-[0.2em] text-neutral-500">
									<th class="py-2 pr-3 w-14 text-center">POS.</th>
									<th class="py-2 pr-3 w-16 text-center">#</th>
									<th class="py-2 pr-3">FAHRER</th>
									<th class="py-2 pr-3 text-right">Q-ZEIT</th>
								</tr>
							</thead>
							<tbody>
								<tr
									v-for="entry in orderedEntries"
									:key="entry.id"
									class="bg-neutral-50 hover:bg-neutral-100 transition-colors"
								>
									<td class="py-2 pr-3 text-center">
										<span
											class="inline-flex items-center justify-center w-8 h-8 rounded-md border-2 border-neutral-700 font-mono text-sm font-bold"
											:style="positionStyle(entry.position)"
										>
											{{ entry.position ?? '–' }}
										</span>
									</td>
									<td class="py-2 pr-3 text-center font-mono text-sm text-neutral-500">
										{{ entry.driver_number }}
									</td>
									<td class="py-2 pr-3">
										<div class="font-semibold text-sm">
											{{ driverName(entry.driver_number) }}
										</div>
										<div v-if="driverAcronym(entry.driver_number)" class="text-[10px] tracking-[0.2em] text-neutral-500 font-mono">
											{{ driverAcronym(entry.driver_number) }}
										</div>
									</td>
									<td class="py-2 pr-3 text-right font-mono text-sm">
										{{ formatLap(entry.lap_duration) }}
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</v-card>
			</v-container>
		</div>
	</v-container>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { colorForPosition } from '@/plugins/coupons/positionColors'
import { useStartingGrid } from '@/plugins/coupons/useStartingGrid'

const {
	sessionKey,
	orderedEntries,
	drivers,
	latestSession,
	loading,
	error,
	autoLoad,
	sync,
	reload,
} = useStartingGrid()

function formatSessionDate (iso: string): string {
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return iso
	return d.toLocaleString('de-DE', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	})
}

onMounted(autoLoad)

function driverName (number: number): string {
	const d = drivers.value[number]
	return d?.full_name ?? `Fahrer #${number}`
}

function driverAcronym (number: number): string | undefined {
	return drivers.value[number]?.name_acronym
}

function formatLap (duration: number | null): string {
	if (duration == null) return '–'
	// z. B. 83.456 → "1:23.456"
	const minutes = Math.floor(duration / 60)
	const seconds = duration - minutes * 60
	return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`
}

function positionStyle (position: number | null) {
	if (position == null) return {}
	const color = colorForPosition(position)
	return color ? { backgroundColor: color } : {}
}
</script>
