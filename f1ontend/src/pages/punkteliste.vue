<template>
	<v-container fluid class="mt-8 h-full flex items-center w-full flex-col grow">
		<div class="flex flex-col grow w-full max-w-5xl mx-auto">
			<v-container>
				<v-card class="flex flex-col custom-height py-5 px-6 rounded-3xl" rounded="3xl" variant="flat">
					<div class="flex items-center justify-between mb-4">
						<div>
							<div class="text-[10px] tracking-[0.3em] text-neutral-500">F1 TIPSPIEL · PUNKTELISTE</div>
							<div class="text-2xl font-mono mt-1">Rangliste</div>
							<div v-if="session.session" class="text-sm text-neutral-600 mt-1">
								Aktuelle Session:
								<span class="font-semibold">{{ session.session.country_name }} · {{ session.session.session_name }}</span>
							</div>
						</div>

						<div class="flex items-center gap-2">
							<v-btn
								v-if="isAdmin"
								:loading="computing"
								:disabled="computing || !session.sessionKey || !auth.token"
								color="secondary"
								variant="tonal"
								prepend-icon="mdi-calculator"
								@click="runCompute"
							>
								Aggregate berechnen
							</v-btn>

							<v-btn
								v-if="isAdmin"
								:disabled="!session.sessionKey || !auth.token"
								color="secondary"
								variant="tonal"
								prepend-icon="mdi-star-circle"
								@click="dotdDialog = true"
							>
								Fahrer des Tages setzen
							</v-btn>

							<v-btn
								v-if="isAdmin"
								:loading="scoring"
								:disabled="scoring || !session.sessionKey || !auth.token"
								color="primary"
								variant="tonal"
								prepend-icon="mdi-calculator-variant"
								@click="runScoring"
							>
								Scoring auslösen
							</v-btn>

							<v-btn
								:loading="loading"
								:disabled="loading"
								variant="plain"
								prepend-icon="mdi-refresh"
								@click="load"
							>
								Aktualisieren
							</v-btn>
						</div>
					</div>

					<v-alert v-if="scoringMsg" type="success" variant="tonal" class="mb-4">
						{{ scoringMsg }}
					</v-alert>

					<!-- Filter -->
					<div class="flex flex-wrap gap-3 mb-4">
						<v-btn-toggle
							v-model="scope"
							density="compact"
							color="primary"
							mandatory
							variant="outlined"
						>
							<v-btn value="all">Gesamt</v-btn>
							<v-btn value="session" :disabled="!session.sessionKey">Aktuelle Session</v-btn>
							<v-btn value="mein-fahrer">Nur „Mein Fahrer"</v-btn>
						</v-btn-toggle>
					</div>

					<v-alert v-if="error" type="error" variant="tonal" class="mb-4">
						{{ error }}
					</v-alert>

					<!-- Podest -->
					<div v-if="podium.length > 0" class="grid grid-cols-3 gap-3 mb-5">
						<div
							v-for="(row, i) in podium"
							:key="row.player_id"
							class="rounded-2xl p-4 font-mono text-center"
							:style="{ background: positionColors[i] ?? '#eee' }"
						>
							<div class="text-[10px] tracking-[0.3em] text-neutral-800/70">P{{ i + 1 }}</div>
							<div class="text-lg font-semibold mt-1 truncate">
								{{ displayNameFor(row) }}
							</div>
							<div class="text-2xl mt-1">{{ row.total_score }} Pkt.</div>
							<div class="text-[10px] text-neutral-800/60 mt-1">
								{{ row.scored_bets }} gewertete Tipps
							</div>
						</div>
					</div>

					<!-- Tabelle -->
					<v-table density="compact" class="font-mono bg-transparent">
						<thead>
							<tr>
								<th class="text-left">#</th>
								<th class="text-left">Spieler</th>
								<th class="text-right">Punkte</th>
								<th class="text-right">Tipps</th>
							</tr>
						</thead>
						<tbody>
							<tr
								v-for="(row, i) in rest"
								:key="row.player_id"
								:class="{ 'bg-taupe-200': isMe(row) }"
							>
								<td>{{ i + 4 }}</td>
								<td>
									{{ displayNameFor(row) }}
									<span v-if="isMe(row)" class="text-[10px] tracking-[0.2em] text-neutral-500 ml-1">(DU)</span>
								</td>
								<td class="text-right">{{ row.total_score }}</td>
								<td class="text-right">{{ row.scored_bets }}</td>
							</tr>
							<tr v-if="rows.length === 0 && !loading">
								<td colspan="4" class="text-center text-neutral-500 py-6">
									Noch keine gewerteten Tipps.
								</td>
							</tr>
						</tbody>
					</v-table>

					<v-dialog v-model="dotdDialog" max-width="420">
						<v-card>
							<v-card-title>Fahrer des Tages</v-card-title>
							<v-card-text>
								<v-text-field
									v-model.number="dotdDriverNumber"
									label="Fahrernummer"
									type="number"
									min="1"
									density="comfortable"
									variant="outlined"
								/>
							</v-card-text>
							<v-card-actions>
								<v-spacer />
								<v-btn variant="text" @click="dotdDialog = false">Abbrechen</v-btn>
								<v-btn
									color="primary"
									:loading="settingDotd"
									:disabled="settingDotd || !dotdDriverNumber"
									@click="submitDotd"
								>
									Setzen
								</v-btn>
							</v-card-actions>
						</v-card>
					</v-dialog>
				</v-card>
			</v-container>
		</div>
	</v-container>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { computeAggregates, getLeaderboard, setDriverOfTheDay, triggerScoring, type LeaderboardRow } from '@/plugins/scores'
import { positionColors } from '@/plugins/coupons/positionColors'
import { useAuthStore } from '@/stores/auth'
import { useSessionStore } from '@/stores/session'

const auth = useAuthStore()
const session = useSessionStore()

type Scope = 'all' | 'session' | 'mein-fahrer'
const scope = ref<Scope>('all')

const rows = ref<LeaderboardRow[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const scoring = ref(false)
const scoringMsg = ref<string | null>(null)

const isAdmin = computed(() => auth.player?.role === 'admin')

const computing = ref(false)
const dotdDialog = ref(false)
const dotdDriverNumber = ref<number | null>(null)
const settingDotd = ref(false)

async function load () {
	loading.value = true
	error.value = null
	try {
		rows.value = await getLeaderboard({
			sessionKey: scope.value === 'session' ? session.sessionKey || undefined : undefined,
			schemaName: scope.value === 'mein-fahrer' ? 'myDriverPlacement' : undefined,
		})
	} catch (e) {
		error.value = e instanceof Error ? e.message : String(e)
	} finally {
		loading.value = false
	}
}

onMounted(async () => {
	if (!session.session) await session.loadLatest()
	await load()
})

watch(scope, load)

const podium = computed(() => rows.value.slice(0, 3))
const rest = computed(() => rows.value.slice(3))

function displayNameFor (row: LeaderboardRow) {
	return row.display_name?.trim() ? row.display_name : row.username
}

function isMe (row: LeaderboardRow) {
	return auth.player?.id === row.player_id
}

async function runScoring () {
	if (!session.sessionKey || !auth.token) return
	scoring.value = true
	error.value = null
	scoringMsg.value = null
	try {
		const r = await triggerScoring(session.sessionKey, auth.token)
		scoringMsg.value = `Scoring für Session ${r.session_key} ausgeführt: ${r.scored_coupons} Coupons gewertet.`
		await load()
	} catch (e) {
		error.value = e instanceof Error ? e.message : String(e)
	} finally {
		scoring.value = false
	}
}

async function runCompute () {
	if (!session.sessionKey || !auth.token) return
	computing.value = true
	error.value = null
	scoringMsg.value = null
	try {
		const agg = await computeAggregates(session.sessionKey, auth.token)
		const parts = [
			agg.pole_driver_number ? `Pole #${agg.pole_driver_number}` : 'Pole —',
			agg.fastest_lap_driver_number ? `FL #${agg.fastest_lap_driver_number}` : 'FL —',
			agg.first_dnf_driver_number ? `DNF #${agg.first_dnf_driver_number}` : 'DNF —',
		]
		scoringMsg.value = `Aggregate berechnet: ${parts.join(' · ')}`
	} catch (e) {
		error.value = e instanceof Error ? e.message : String(e)
	} finally {
		computing.value = false
	}
}

async function submitDotd () {
	if (!session.sessionKey || !auth.token || !dotdDriverNumber.value) return
	settingDotd.value = true
	error.value = null
	try {
		await setDriverOfTheDay(session.sessionKey, dotdDriverNumber.value, auth.token)
		scoringMsg.value = `Fahrer des Tages gesetzt: #${dotdDriverNumber.value}`
		dotdDialog.value = false
		dotdDriverNumber.value = null
	} catch (e) {
		error.value = e instanceof Error ? e.message : String(e)
	} finally {
		settingDotd.value = false
	}
}
</script>
