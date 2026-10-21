<template>
	<div>
		<v-autocomplete
			:model-value="modelValue"
			:items="drivers"
			:loading="loading"
			item-title="full_name"
			item-value="driver_number"
			:label="label ?? 'Fahrer wählen'"
			:disabled="disabled"
			density="comfortable"
			variant="outlined"
			hide-details="auto"
			clearable
			@update:model-value="onSelect"
		/>
		<v-alert v-if="error" type="error" density="compact" class="mt-2">{{ error }}</v-alert>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { listDrivers, type DriverInfo } from '@/plugins/drivers'

defineProps<{
	/** Aktuell gewählte driver_number (oder null). */
	modelValue: number | null
	label?: string
	disabled?: boolean
}>()

const emit = defineEmits<{
	'update:modelValue': [driverNumber: number | null]
	select: [driver: DriverInfo | null]
}>()

const drivers = ref<DriverInfo[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

async function load () {
	loading.value = true
	error.value = null
	try {
		drivers.value = await listDrivers()
	} catch (e) {
		error.value = e instanceof Error ? e.message : String(e)
	} finally {
		loading.value = false
	}
}

function onSelect (value: number | null) {
	emit('update:modelValue', value)
	emit('select', drivers.value.find(d => d.driver_number === value) ?? null)
}

onMounted(load)
</script>
