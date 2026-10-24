<template>
	<v-container fluid class="mt-8 h-full flex items-center w-full flex-col grow">
		<div class="flex flex-col grow w-full max-w-5xl mx-auto">
			<v-container>
				<!-- Nach Abgabe: kompakte Bestätigung -->
				<v-card
					v-if="createdId"
					variant="flat"
					class="font-mono rounded-xl p-8 text-center mb-6"
					style="border: 2px dashed #c0b89a; background: #fef9ec;"
				>
					<div class="text-[10px] tracking-[0.4em] text-neutral-500">F1 TIPSPIEL</div>
					<div class="text-body-medium tracking-[0.3em] text-neutral-700 mt-1">★ {{ name.toUpperCase() }} ★</div>
					<v-icon icon="mdi-check-decagram" size="48" class="mt-5 text-green-700" />
					<div class="text-2xl font-bold tracking-tight mt-3">{{ driver?.name ?? '—' }}</div>
					<div class="mt-4 text-[10px] tracking-[0.3em] text-neutral-500">WETTSCHEIN-NR.</div>
					<div class="font-sans text-body-small tracking-wider text-neutral-800 break-all px-4">{{ createdId }}</div>
					<div v-if="placedAt" class="text-[11px] font-sans text-neutral-600 mt-3">
						ausgestellt am <strong>{{ placedAt }}</strong>
					</div>
				</v-card>

				<v-card v-else class="py-6 px-6 shape-lg" variant="flat">
					<div class="mb-1">
						<div class="text-[10px] tracking-[0.3em] text-neutral-500">F1 TIPSPIEL</div>
						<div class="text-xl font-bold">{{ name }}</div>
						<div v-if="subtitle" class="text-body-medium text-neutral-500 mt-1">{{ subtitle }}</div>
					</div>

					<div v-if="session" class="mt-3">
						<div class="text-[10px] tracking-[0.3em] text-neutral-500">TIPP FÜR</div>
						<div class="text-body-medium">
							<strong>{{ session.country_name }}</strong>
							<span class="text-neutral-500"> · {{ session.session_name }}</span>
						</div>
					</div>

					<v-alert v-if="locked" type="warning" variant="tonal" class="mt-3">
						Diese Session hat bereits begonnen – ein Tipp ist nicht mehr möglich.
					</v-alert>

					<DriverSelect
						class="mt-5"
						:model-value="driver?.driver_id ?? null"
						:disabled="locked"
						@select="onSelect"
					/>

					<div class="flex justify-end mt-5">
						<v-btn
							:loading="submitting"
							:disabled="submitting || locked || !driver"
							color="primary"
							@click="emit('submit')"
						>
							Tipp abgeben
						</v-btn>
					</div>

					<v-alert v-if="error" type="error" class="mt-3">{{ error }}</v-alert>
				</v-card>
			</v-container>
		</div>
	</v-container>
</template>

<script setup lang="ts">
import DriverSelect from '@/components/driver-select/driver-select.vue'
import type { PodiumDriver } from '@/plugins/coupons/types'
import type { DriverInfo } from '@/plugins/drivers'
import type { SessionInfo } from '@/plugins/startingGrid'

defineProps<{
	/** Anzeigename der Wette. */
	name: string
	subtitle?: string
	/** Aktive Session (für Banner + Lock). */
	session?: SessionInfo | null
	/** Sperrt die Abgabe (Session bereits gestartet). */
	locked?: boolean
	/** Aktuell gewählter Fahrer (oder null). */
	driver: PodiumDriver | null
	createdId: string | null
	placedAt?: string | null
	submitting: boolean
	error: string | null
}>()

const emit = defineEmits<{
	'update:driver': [driver: PodiumDriver | null]
	submit: []
}>()

function onSelect (d: DriverInfo | null) {
	emit('update:driver', d ? { driver_id: d.driver_number, name: d.full_name } : null)
}
</script>
