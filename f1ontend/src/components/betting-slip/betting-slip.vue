<template>
	<v-card class="coupon font-mono text-neutral-900" variant="flat">
		<!-- Header -->
		<header class="px-6 pt-6 pb-4 text-center">
			<div class="text-[10px] tracking-[0.4em] text-neutral-500">F1 TIPSPIEL</div>
			<div class="text-body-medium tracking-[0.3em] text-neutral-700 mt-1">★ WETTSCHEIN ★</div>
			<div class="text-2xl font-bold tracking-tight mt-3">{{ title }}</div>
			<div class="mt-3 text-[10px] tracking-[0.3em] text-neutral-500">WETTSCHEIN-NR.</div>
			<div class="font-sans text-body-medium tracking-wider text-neutral-800 break-all px-4">
				{{ couponId }}
			</div>
		</header>

		<div class="perforation" aria-hidden="true">
			<span class="scissors">✂</span>
		</div>

		<!-- Picks -->
		<ul class="px-6 py-5 space-y-3">
			<li
				v-for="(pick, i) in picks"
				:key="`${pick.driver_id}-${i}`"
				class="flex items-center gap-4"
			>
				<div
					class="pick-box"
					:style="{ backgroundColor: colors?.[i] ?? '#ffffff' }"
				>
					<v-icon icon="mdi-close-thick" size="28" class="cross" />
				</div>
				<div class="flex-1 min-w-0">
					<div class="text-[10px] tracking-[0.3em] text-neutral-500">POS. {{ i + 1 }}</div>
					<div class="text-lg font-bold truncate leading-tight">{{ pick.name }}</div>
				</div>
				<div class="text-body-small text-neutral-500 font-sans tabular-nums">#{{ pick.driver_id }}</div>
			</li>
		</ul>

		<div class="perforation" aria-hidden="true">
			<span class="scissors">✂</span>
		</div>

		<!-- Footer: Barcode + Stempel + Timestamp -->
		<footer class="px-6 pt-4 pb-6 flex items-end justify-between gap-4">
			<div class="flex-1 min-w-0">
				<div class="barcode" aria-hidden="true" />
				<div class="text-[10px] tracking-[0.3em] text-neutral-500 mt-2 font-mono truncate">
					{{ barcodeText }}
				</div>
				<div v-if="placedAt" class="text-[11px] font-sans text-neutral-600 mt-3">
					ausgestellt am <strong>{{ placedAt }}</strong>
				</div>
			</div>
			<div class="stamp" aria-label="Viel Erfolg">
				VIEL<br>ERFOLG
			</div>
		</footer>
	</v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PodiumDriver } from '@/plugins/coupons/types'

const props = defineProps<{
	/** Anzeigename der Wette (z. B. "Top 3 Wette"). */
	title: string
	/** Vom Backend vergebene Coupon-ID – dient als Wettschein-Nummer. */
	couponId: string
	/** Die getippten Fahrer in Reihenfolge der Platzierungen 1..n. */
	picks: PodiumDriver[]
	/** Optionale HEX-Hintergrundfarben für die Kästchen pro Platzierung. */
	colors?: string[]
	/** Optionaler Zeitstempel der Platzierung (frei formatiert). */
	placedAt?: string | null
}>()

/** Letzte 16 Zeichen der Coupon-ID als "Barcode-Nummer" für die Fußzeile. */
const barcodeText = computed(() => {
	const id = props.couponId.replaceAll('-', '')
	return id.slice(-16).toUpperCase().padStart(16, '0')
})
</script>

<style scoped lang="scss">

.coupon {
	background: #fef9ec;
	border: 2px dashed #c0b89a;
	border-radius: 14px;
	box-shadow:
		0 1px 2px rgb(0 0 0 / 0.04),
		0 10px 30px -10px rgb(0 0 0 / 0.15);
	position: relative;
	overflow: hidden;

	// Einheitliche Coupon-Breite überall (BetCard, Wettschein-Dialog, …);
	// Höhe passt sich dem Inhalt an.
	width: 100%;
	max-width: 560px;
	margin-inline: auto;
}

/* Dekorative "Papier"-Textur: diagonales Rauschen in Beige. */
.coupon::before {
	content: '';
	position: absolute;
	inset: 0;
	pointer-events: none;
	background-image: repeating-linear-gradient(
		45deg,
		rgb(192 184 154 / 0.05) 0 2px,
		transparent 2px 6px
	);
}

/* Perforations-Linie mit kleiner Schere am Rand. */
.perforation {
	position: relative;
	margin: 0 20px;
	border-top: 2px dashed #c0b89a;
	height: 0;
}
.scissors {
	position: absolute;
	right: -8px;
	top: -14px;
	font-size: 18px;
	color: #a8a088;
	background: #fef9ec;
	padding: 0 4px;
	line-height: 1;
}

/* Kästchen für die Platzierung mit Kreuz. */
.pick-box {
	width: 46px;
	height: 46px;
	border: 2px solid rgb(23 23 23 / 0.85);
	border-radius: 6px;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	box-shadow: inset 0 -2px 0 rgb(0 0 0 / 0.1);
}
.cross {
	color: rgb(23 23 23);
	transform: rotate(-7deg);
}

/* Barcode aus CSS-Streifen. */
.barcode {
	height: 36px;
	background-image: repeating-linear-gradient(
		to right,
		#111 0 2px,
		transparent 2px 4px,
		#111 4px 5px,
		transparent 5px 9px,
		#111 9px 12px,
		transparent 12px 14px,
		#111 14px 15px,
		transparent 15px 20px
	);
	background-size: 20px 100%;
}

/* "VIEL ERFOLG"-Stempel. */
.stamp {
	border: 2px solid #b91c1c;
	color: #b91c1c;
	padding: 6px 10px;
	border-radius: 6px;
	font-size: 11px;
	letter-spacing: 0.2em;
	line-height: 1.1;
	text-align: center;
	font-weight: 700;
	transform: rotate(-8deg);
	flex-shrink: 0;
	opacity: 0.85;
	text-shadow: 0 1px 0 rgb(255 255 255 / 0.3);
}
</style>
