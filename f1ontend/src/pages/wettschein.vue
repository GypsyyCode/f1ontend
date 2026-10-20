<template>
	<v-container fluid class="mt-8 h-full flex items-center w-full flex-col grow">
		<div class="flex flex-col grow w-full max-w-5xl mx-auto">
			<v-container>
				<v-card class="py-5 px-6 rounded-3xl" rounded="3xl" variant="flat">
					<div class="flex items-center justify-between mb-4">
						<div>
							<div class="text-[10px] tracking-[0.3em] text-neutral-500">F1 TIPSPIEL · ÜBERSICHT</div>
							<div class="text-xl font-bold">Dein Wettschein</div>
						</div>
						<v-btn
							:loading="loading"
							:disabled="loading"
							variant="tonal"
							prepend-icon="mdi-refresh"
							@click="load"
						>
							Neu laden
						</v-btn>
					</div>

					<v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>

					<div class="overflow-x-auto">
						<table class="matrix w-full border-separate border-spacing-1">
							<thead>
								<tr>
									<th class="text-left text-xs tracking-[0.2em] text-neutral-500 font-normal pr-3">
										WETTART
									</th>
									<th
										v-for="n in 10"
										:key="n"
										class="text-center text-xs text-neutral-500 font-mono w-12"
									>
										{{ n }}
									</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="row in rows" :key="row.key">
									<td class="pr-3 py-2 align-middle">
										<div class="font-semibold text-sm">{{ row.name }}</div>
										<div v-if="row.couponId" class="text-[10px] text-neutral-400 font-mono truncate max-w-[160px]">
											{{ row.couponId }}
										</div>
										<div v-else class="text-[10px] text-neutral-400 italic">
											keine Wette
										</div>
									</td>
									<td
										v-for="n in 10"
										:key="n"
										class="p-0"
									>
										<MatrixCell
											:placement="placementFor(row, n)"
											:position="n"
											:driver="driverFor(placementFor(row, n))"
										/>
									</td>
								</tr>
							</tbody>
						</table>
					</div>

					<!-- Legende -->
					<div class="mt-5 flex flex-wrap gap-3 text-[10px] tracking-[0.2em] text-neutral-500">
						<div
							v-for="(c, i) in positionColors"
							:key="i"
							class="flex items-center gap-1"
						>
							<span
								class="inline-block w-3 h-3 rounded-sm border border-neutral-400"
								:style="{ backgroundColor: c }"
							/>
							<span>POS. {{ i + 1 }}</span>
						</div>
					</div>
				</v-card>
			</v-container>
		</div>
	</v-container>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import MatrixCell from '@/components/wettschein-matrix/matrix-cell.vue'
import type { Placement } from '@/plugins/coupon'
import type { DriverInfo } from '@/plugins/drivers'
import { positionColors } from '@/plugins/coupons/positionColors'
import { useWettschein, type WettscheinRow } from '@/plugins/coupons/useWettschein'

const { rows, drivers, loading, error, load } = useWettschein()

function placementFor (row: WettscheinRow, position: number): Placement | undefined {
	return row.placements.find(p => p.position === position)
}

function driverFor (placement: Placement | undefined): DriverInfo | undefined {
	return placement ? drivers.value[placement.driver_id] : undefined
}

onMounted(load)
</script>
