<template>
	<v-container fluid class="mt-8 h-full flex items-center w-full flex-col grow">
		<div class="flex flex-col grow w-full max-w-5xl mx-auto">
			<v-container class="flex flex-col">
				<!-- Nach dem Abschließen: nur noch den Coupon zeigen, Liste ausblenden -->
				<BettingSlip
					v-if="createdId"
					class="mb-6"
					:title="name"
					:coupon-id="createdId"
					:picks="picks"
					:colors="colors"
					:placed-at="placedAt"
				/>

				<v-card v-if="!createdId" class="h-full grow flex flex-col custom-height py-3 shape-lg transition-[border-radius] hover:rounded-lg" variant="flat">
					<div v-if="session" class="px-4 pt-4">
						<div class="text-[10px] tracking-[0.3em] text-neutral-500">TIPP FÜR</div>
						<div class="text-sm">
							<strong>{{ session.country_name }}</strong>
							<span class="text-neutral-500"> · {{ session.session_name }}</span>
						</div>
					</div>

					<v-alert v-if="locked" type="warning" variant="tonal" class="mx-4 mt-3">
						Diese Session hat bereits begonnen – ein Tipp ist nicht mehr möglich.
					</v-alert>

					<List
						class="bg-neutral-100 mt-16"
						:picks="picks"
						:subtitle="subtitle"
						:colors="colors"
						:reorderable="reorderable && !createdId && !locked"
						@reorder="emit('reorder', $event)"
					/>

					<v-card-actions class="justify-end mx-16 align-bottom">
						<v-btn
							class="bg-primary text-on-primary"
							:loading="submitting"
							:disabled="submitting || locked"
							color="primary"
							@click="$emit('submit')"
						>
							{{ submitLabel ?? 'Wette abschließen' }}
						</v-btn>
					</v-card-actions>

					<v-alert v-if="error" type="error" class="mt-3">{{ error }}</v-alert>
				</v-card>
			</v-container>
		</div>
	</v-container>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import BettingSlip from '@/components/betting-slip/betting-slip.vue'
import List from '@/components/list/list.vue'
import type { PodiumDriver } from '@/plugins/coupons/types'
import type { SessionInfo } from '@/plugins/startingGrid'

const props = withDefaults(defineProps<{
	/** Anzeigename der Wette (z. B. "Top 3 Wette"). Für den Wettschein-Header. */
	name: string
	/** Die getippten Fahrer in Reihenfolge der Platzierungen 1..n. */
	picks: PodiumDriver[]
	/** Beschreibungstext unter jedem Listeneintrag. */
	subtitle: string
	/** Optionale HEX-Farben pro Platzierung für die count-Zahl / das Wettschein-Kästchen. */
	colors?: string[]
	submitting: boolean
	error: string | null
	createdId: string | null
	/** Zeitstempel der Abgabe – kommt aus dem Pinia-Store (persistiert). */
	placedAt?: string | null
	submitLabel?: string
	/** Reorder-Controls (Drag & Up/Down) in der Liste anbieten. Default: true. */
	reorderable?: boolean
	/** Aktive Session, auf die sich eine Renn-Wette bezieht (optional). */
	session?: SessionInfo | null
	/** Sperrt die Abgabe (z. B. weil die Session bereits begonnen hat). */
	locked?: boolean
}>(), {
	colors: undefined,
	placedAt: undefined,
	submitLabel: undefined,
	reorderable: true,
	session: null,
	locked: false,
})

const emit = defineEmits<{
	submit: []
	reorder: [payload: { from: number, to: number }]
}>()

// Nach erfolgreichem Abschluss nach oben scrollen, damit der Coupon oben
// prominent sichtbar wird. `placedAt` kommt aus dem Store und wird dort
// zusammen mit `createdId` gesetzt.
watch(() => props.createdId, id => {
	if (!id) return
	window.scrollTo({ top: 0, behavior: 'smooth' })
})
</script>

<style lang="css">
</style>
