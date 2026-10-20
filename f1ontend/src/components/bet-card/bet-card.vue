<template>
	<v-container fluid class="mt-8 h-full flex items-center w-full flex-col grow">
		<div class="flex flex-col grow w-full max-w-5xl mx-auto">
			<v-container>
				<!-- Nach dem Abschließen: Coupon zuerst, Formular drunter -->
				<BettingSlip
					v-if="createdId"
					class="mb-6"
					:title="name"
					:coupon-id="createdId"
					:picks="picks"
					:colors="colors"
					:placed-at="placedAt"
				/>

				<v-card class="py-3 rounded-3xl transition-[border-radius] hover:rounded-lg" rounded="3xl" variant="flat">
					<List
						class="bg-neutral-100"
						:picks="picks"
						:subtitle="subtitle"
						:colors="colors"
						:reorderable="reorderable && !createdId"
						@reorder="emit('reorder', $event)"
					/>

					<v-card-actions class="justify-end">
						<v-btn
							:loading="submitting"
							:disabled="submitting"
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
import { ref, watch } from 'vue'
import BettingSlip from '@/components/betting-slip/betting-slip.vue'
import List from '@/components/list/list.vue'
import type { PodiumDriver } from '@/plugins/coupons/useCoupon'

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
	submitLabel?: string
	/** Reorder-Controls (Drag & Up/Down) in der Liste anbieten. Default: true. */
	reorderable?: boolean
}>(), {
	colors: undefined,
	submitLabel: undefined,
	reorderable: true,
})

const emit = defineEmits<{
	submit: []
	reorder: [payload: { from: number, to: number }]
}>()

/** Zeitstempel der Abgabe – wird beim ersten createdId gesetzt. */
const placedAt = ref<string | undefined>()

watch(() => props.createdId, id => {
	if (!id) return
	placedAt.value = new Date().toLocaleString('de-DE', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	})
	// Nach erfolgreichem Abschluss nach oben scrollen, damit der Coupon
	// prominent oben sichtbar ist.
	window.scrollTo({ top: 0, behavior: 'smooth' })
})
</script>
