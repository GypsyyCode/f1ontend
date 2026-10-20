<template>
	<div class="bg-neutral-100 v-card v-theme--light v-card--density-default v-card--variant-flat coupon font-mono text-neutral-900 mb-6">
	<v-list lines="two" class="bg-neutral-100 mx-4 px-4 py-1 rounded-2xl">
		<div
			v-for="(pick, i) in picks"
			:key="`${pick.driver_id}-${i}`"
			:draggable="reorderable || undefined"
			class="row transition-opacity"
			:class="{
				'cursor-grab': reorderable,
				'opacity-40': dragIndex === i,
				'drop-target': dragOverIndex === i && dragIndex !== i,
			}"
			@dragstart="onDragStart(i, $event)"
			@dragover.prevent="onDragOver(i)"
			@dragleave="onDragLeave(i)"
			@drop.prevent="onDrop(i)"
			@dragend="onDragEnd"
		>
			<ListItem
				:title="pick.name"
				:subtitle="subtitle"
				:count="i + 1"
				:color="colors?.[i]"
				:reorderable="reorderable && picks.length > 1"
				:can-move-up="i > 0"
				:can-move-down="i < picks.length - 1"
				@move-up="emit('reorder', { from: i, to: i - 1 })"
				@move-down="emit('reorder', { from: i, to: i + 1 })"
			/>
		</div>
	</v-list>
</div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ListItem from './list-item.vue'
import type { PodiumDriver } from '@/plugins/coupons/useCoupon'

const props = defineProps<{
	picks: PodiumDriver[]
	subtitle?: string
	/** HEX-Farbe pro Item für die count-Zahl, z. B. ["#e10600", "#00d2be", "#ff8700"] */
	colors?: string[]
	/** Erlaubt Drag & Drop sowie Up/Down-Buttons zum Umsortieren. */
	reorderable?: boolean
}>()

const emit = defineEmits<{
	reorder: [payload: { from: number, to: number }]
}>()

const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function onDragStart (i: number, event: DragEvent) {
	if (!props.reorderable) return
	dragIndex.value = i
	// Nötig damit Chromium den drag überhaupt startet.
	event.dataTransfer?.setData('text/plain', String(i))
	if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDragOver (i: number) {
	if (!props.reorderable || dragIndex.value === null) return
	dragOverIndex.value = i
}

function onDragLeave (i: number) {
	if (dragOverIndex.value === i) dragOverIndex.value = null
}

function onDrop (i: number) {
	if (!props.reorderable) return
	const from = dragIndex.value
	if (from === null || from === i) return
	emit('reorder', { from, to: i })
	dragIndex.value = null
	dragOverIndex.value = null
}

function onDragEnd () {
	dragIndex.value = null
	dragOverIndex.value = null
}
</script>

<style scoped>
.row {
	border-radius: 12px;
}
.drop-target {
	outline: 2px dashed rgb(59 130 246 / 0.6);
	outline-offset: -2px;
	background: rgb(59 130 246 / 0.05);
}

.coupon{
	border-radius: 14px;
	box-shadow:
		0 1px 2px rgb(0 0 0 / 0.04),
		0 10px 30px -10px rgb(0 0 0 / 0.15);
	position: relative;
	overflow: hidden;

	/* Gleiche Coupon-Breite wie BettingSlip + Wettschein-Dialog. */
	width: 100%;
	max-width: 560px;
	margin-inline: auto;
}
</style>
