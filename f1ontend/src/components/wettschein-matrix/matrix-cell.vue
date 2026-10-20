<template>
	<v-tooltip
		v-if="placement"
		:text="tooltipText"
		location="top"
	>
		<template #activator="{ props: tooltipProps }">
			<div
				v-bind="tooltipProps"
				class="matrix-cell filled"
				:style="{ backgroundColor: colorForPosition(position) ?? '#e5e7eb' }"
			>
				<v-icon icon="mdi-check-bold" size="20" class="check" />
				<span class="acronym">{{ acronym }}</span>
			</div>
		</template>
	</v-tooltip>

	<div v-else class="matrix-cell empty" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Placement } from '@/plugins/coupon'
import { colorForPosition } from '@/plugins/coupons/positionColors'
import type { DriverInfo } from '@/plugins/drivers'

const props = defineProps<{
	/** Platzierung in dieser Spalte, oder undefined wenn keine Wette hier liegt. */
	placement?: Placement
	/** Spalten-Position (1-basiert, aus dem Tabellen-Header). */
	position: number
	/** Aufgelöster Driver, falls die Driver-Map geladen wurde. */
	driver?: DriverInfo
}>()

const acronym = computed(() => {
	if (props.driver?.name_acronym) return props.driver.name_acronym
	if (props.placement) return `#${props.placement.driver_id}`
	return ''
})

const tooltipText = computed(() => {
	if (!props.placement) return ''
	if (props.driver?.full_name) {
		return `${props.driver.full_name} (#${props.placement.driver_id})`
	}
	return `Fahrer #${props.placement.driver_id}`
})
</script>

<style scoped>
.matrix-cell {
	width: 100%;
	aspect-ratio: 1 / 1;
	border-radius: 6px;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	line-height: 1;
}

.matrix-cell.filled {
	border: 2px solid rgb(23 23 23 / 0.8);
	color: rgb(23 23 23);
	box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
}

.matrix-cell.empty {
	border: 2px dashed rgb(229 229 229);
	background: rgb(250 250 250);
}

.check {
	transform: rotate(-6deg);
}

.acronym {
	font-size: 9px;
	font-family: ui-monospace, SFMono-Regular, monospace;
	letter-spacing: 0.05em;
	margin-top: 2px;
	text-shadow: 0 1px 0 rgb(255 255 255 / 0.4);
}
</style>
