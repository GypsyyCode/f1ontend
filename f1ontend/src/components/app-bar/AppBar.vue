<template>
	<v-app-bar :elevation="0" color="surface" height="64" density="comfortable">
		<template #prepend>
			<v-app-bar-nav-icon
				v-if="mobile"
				@click="emit('toggle-drawer')"
			/>
		</template>

		<v-app-bar-title class="text-title-large">
			F1 Tipp
		</v-app-bar-title>

		<v-spacer />

		<v-btn
			:icon="modeIcon"
			variant="text"
			:aria-label="`Dark Mode: ${theme.mode}`"
			@click="cycleMode"
		/>

		<v-menu location="bottom end">
			<template #activator="{ props }">
				<v-btn icon="mdi-palette" variant="text" v-bind="props" aria-label="Theme wählen" />
			</template>
			<v-list density="comfortable" min-width="220">
				<v-list-subheader class="text-label-medium">Farbthema</v-list-subheader>
				<v-list-item
					v-for="p in PRESETS"
					:key="p.name"
					:active="theme.preset === p.name"
					@click="theme.setPreset(p.name)"
				>
					<template #prepend>
						<div
							class="swatch"
							:style="{ background: p.seed }"
							aria-hidden="true"
						/>
					</template>
					<v-list-item-title>{{ p.label }}</v-list-item-title>
				</v-list-item>
			</v-list>
		</v-menu>

		<template v-if="auth.isAuthenticated">
			<v-btn
				variant="text"
				prepend-icon="mdi-logout"
				@click="onLogout"
			>
				{{ auth.player?.display_name || auth.player?.username || 'Abmelden' }}
			</v-btn>
		</template>
		<v-btn v-else variant="text" prepend-icon="mdi-login" to="/login">
			Anmelden
		</v-btn>
	</v-app-bar>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useDisplay } from 'vuetify'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { PRESETS, type ThemeMode } from '@/themes'

const emit = defineEmits<{ 'toggle-drawer': [] }>()

const auth = useAuthStore()
const theme = useThemeStore()
const router = useRouter()
const { mobile } = useDisplay()

const modeIcon = computed(() => {
	if (theme.mode === 'light') return 'mdi-white-balance-sunny'
	if (theme.mode === 'dark')  return 'mdi-weather-night'
	return 'mdi-theme-light-dark'
})

function cycleMode () {
	const order: ThemeMode[] = ['light', 'system', 'dark']
	const idx = order.indexOf(theme.mode as ThemeMode)
	const next = order[(idx + 1) % order.length]
	theme.setMode(next)
}

function onLogout () {
	auth.logout()
	router.push('/login')
}
</script>

<style scoped>
.swatch {
	width: 20px;
	height: 20px;
	border-radius: 50%;
	border: 1px solid rgb(var(--v-theme-outline-variant));
}
</style>
