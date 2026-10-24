<template>
	<v-container fluid class="mt-8 h-full flex items-center w-full flex-col grow">
		<div class="flex flex-col grow w-full max-w-5xl mx-auto">
			<v-container>
				<v-card class="flex flex-col custom-height py-5 px-6 shape-lg" variant="flat">
					<div class="flex items-center justify-between mb-4">
						<div>
							<div class="text-[10px] tracking-[0.3em] text-neutral-500">F1 TIPSPIEL · ÜBERSICHT</div>
							<div class="text-xl font-bold">Dein Wettschein</div>
							<div class="text-body-small text-neutral-500 mt-1">
								Zeile anklicken, um den jeweiligen Wettschein anzuzeigen.
							</div>
						</div>
						<v-btn
							:loading="loading"
							:disabled="loading"
							variant="plain"
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
									<th class="text-left text-body-small tracking-[0.2em] text-neutral-500 font-normal pr-3">
										WETTART
									</th>
									<th
										v-for="n in 10"
										:key="n"
										class="text-center text-body-small text-neutral-500 font-mono w-12"
									>
										{{ n }}
									</th>
								</tr>
							</thead>
							<tbody>
								<tr
									v-for="row in rows"
									:key="row.key"
									class="cursor-pointer hover:bg-neutral-100 transition-colors"
									@click="openRow(row)"
								>
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
										<template v-if="row.key === 'constructorChampionship'">
											<MatrixCell
												v-if="constructorPlacementFor(row, n)"
												v-bind="constructorCellProps(constructorPlacementFor(row, n)!)"
												:position="n"
											/>
											<MatrixCell v-else :position="n" />
										</template>
										<MatrixCell
											v-else
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
					<div class=" mt-auto mb-1 mx-auto flex flex-wrap gap-3 text-[10px] tracking-[0.2em] text-neutral-500">
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

		<!-- Coupon-Popup -->
		<v-dialog v-model="dialogOpen" max-width="560" scrollable>
			<div class="relative">
				<v-btn
					icon="mdi-close"
					variant="text"
					size="small"
					class="dialog-close"
					@click="dialogOpen = false"
				/>

				<BettingSlip
					v-if="selectedRow && selectedRow.placements.length > 0"
					:title="`${selectedRow.name} Wette`"
					:coupon-id="selectedRow.couponId ?? '—'"
					:picks="selectedPicks"
					:colors="selectedColors"
				/>

				<v-card
					v-else-if="selectedRow"
					variant="flat"
					class="font-mono bg-white rounded-xl p-8 text-center"
					style="border: 2px dashed #c0b89a; background: #fef9ec;"
				>
					<div class="text-[10px] tracking-[0.4em] text-neutral-500">F1 TIPSPIEL</div>
					<div class="text-body-medium tracking-[0.3em] text-neutral-700 mt-1">★ WETTSCHEIN ★</div>
					<div class="text-2xl font-bold tracking-tight mt-3">
						{{ selectedRow.name }} Wette
					</div>
					<v-icon icon="mdi-ticket-confirmation-outline" size="48" class="mt-6 text-neutral-400" />
					<div class="mt-3 text-body-medium text-neutral-500">
						Noch keine Wette platziert.
					</div>
				</v-card>
			</div>
		</v-dialog>
	</v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BettingSlip from '@/components/betting-slip/betting-slip.vue'
import MatrixCell from '@/components/wettschein-matrix/matrix-cell.vue'
import type { Placement } from '@/plugins/coupon'
import { positionColors } from '@/plugins/coupons/positionColors'
import type { PodiumDriver } from '@/plugins/coupons/types'
import { useWettschein, type ConstructorPlacement, type WettscheinRow } from '@/plugins/coupons/useWettschein'
import type { DriverInfo } from '@/plugins/drivers'

const { rows, drivers, teams, loading, error, load } = useWettschein()

const dialogOpen = ref(false)
const selectedRow = ref<WettscheinRow | null>(null)

function placementFor (row: WettscheinRow, position: number): Placement | undefined {
	return row.placements.find(p => p.position === position)
}

function driverFor (placement: Placement | undefined): DriverInfo | undefined {
	return placement ? drivers.value[placement.driver_id] : undefined
}

/** Für Konstrukteurs-Zeile: Konstrukteurs-Platzierung an einer Position finden. */
function constructorPlacementFor (row: WettscheinRow, position: number): ConstructorPlacement | undefined {
	return row.constructorPlacements?.find(p => p.position === position)
}

/**
 * Für Konstrukteurs-Zeile: synthetisches Placement + DriverInfo für MatrixCell.
 * MatrixCell nutzt `driver.name_acronym` für die Anzeige – wir setzen den
 * Team-Namen als Akronym, damit keine driver_id angezeigt wird.
 */
function constructorCellProps (
	cp: ConstructorPlacement,
): { placement: Placement; driver: DriverInfo } {
	const team = teams.value.get(cp.team_id)
	const acronym = team
		? team.team_name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()
		: `T${cp.team_id}`
	const fullName = team?.team_name ?? `Team #${cp.team_id}`
	return {
		placement: { driver_id: cp.team_id, position: cp.position },
		driver: {
			driver_number: cp.team_id,
			full_name: fullName,
			first_name: '',
			last_name: fullName,
			name_acronym: acronym,
		},
	}
}

function openRow (row: WettscheinRow) {
	selectedRow.value = row
	dialogOpen.value = true
}

/** Platzierungen → Picks (nach Position aufsteigend, Name aus Driver- oder Team-Lookup). */
const selectedPicks = computed<PodiumDriver[]>(() => {
	const row = selectedRow.value
	if (!row) return []

	// Konstrukteurs-WM: aus constructorPlacements befüllen
	if (row.key === 'constructorChampionship') {
		return [...(row.constructorPlacements ?? [])]
			.sort((a, b) => a.position - b.position)
			.map(p => ({
				driver_id: p.team_id,
				name: teams.value.get(p.team_id)?.team_name ?? `Team #${p.team_id}`,
			}))
	}

	return [...row.placements]
		.sort((a, b) => a.position - b.position)
		.map(p => ({
			driver_id: p.driver_id,
			name: drivers.value[p.driver_id]?.full_name ?? `Fahrer #${p.driver_id}`,
		}))
})

/** Farben entsprechend der getippten Position (nicht Reihenfolge). */
const selectedColors = computed<string[]>(() => {
	const row = selectedRow.value
	if (!row) return []
	const placements = row.key === 'constructorChampionship'
		? (row.constructorPlacements ?? [])
		: row.placements
	return [...placements]
		.sort((a, b) => a.position - b.position)
		.map(p => positionColors[p.position - 1] ?? '#ffffff')
})

onMounted(load)
</script>

<style scoped>
.dialog-close {
	position: absolute;
	top: 8px;
	right: 8px;
	z-index: 2;
}
</style>
