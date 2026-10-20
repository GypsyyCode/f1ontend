<template>
	<v-container fluid class="mt-24 h-full flex items-center w-full flex-col grow">
		<div class="flex flex-col grow w-full max-w-5xl mx-auto">
			<v-container>
				<v-card class="py-3 rounded-3xl transition-[border-radius] hover:rounded-lg" rounded="3xl" variant="flat">
					<List
						class="bg-neutral-100"
						:title="podium.map(d => d.name)"
						subtitle="Deine Top-3-Wette fürs nächste Rennen"
						:colors="['#FFD700', '#C0C0C0', '#CD7F32']"
					/>

					<v-card-actions class="justify-end">
						<v-btn :loading="submitting" :disabled="submitting" color="primary" @click="submit">
							Wette abschließen
						</v-btn>
					</v-card-actions>

					<v-alert v-if="error" type="error" class="mt-3">{{ error }}</v-alert>
					<v-alert v-if="createdId" type="success" class="mt-3">
						Wette angelegt (ID: {{ createdId }})
					</v-alert>
				</v-card>
			</v-container>
		</div>
	</v-container>
</template>

<script setup lang="ts">
	import List from '@/components/list/list.vue'
	import { useTop3 } from '@/plugins/coupons/useTop3'

	const { podium, submitting, error, createdId, submit } = useTop3([
		{ driver_id: 1, name: 'Max Verstappen' },
		{ driver_id: 12, name: 'Kimi Antonelli' },
		{ driver_id: 44, name: 'Lewis Hamilton' },
	])
</script>
