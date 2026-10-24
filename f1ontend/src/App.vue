<template>
	<v-app>
		<AppBar @toggle-drawer="drawerOpen = !drawerOpen" />

		<v-navigation-drawer
			v-model="drawerOpen"
			:permanent="!mobile"
			:temporary="mobile"
			width="260"
			color="surface-container"
		>
			<div class="px-5 pt-5 pb-3 flex items-center gap-3">
				<div class="logo-mark">
					<v-icon icon="mdi-flag-checkered" size="22" color="on-primary" />
				</div>
				<div class="min-w-0">
					<div class="text-label-small tracking-[0.3em] text-on-surface-variant">F1 TIPSPIEL</div>
					<div class="text-title-large font-bold mt-1 truncate">Wetten</div>
				</div>
			</div>

			<v-divider color="primary" :opacity="0.4" />

			<v-list nav color="primary-container" class="mt-2">
				<template v-for="group in navGroups" :key="group.title">
					<v-list-subheader class="nav-subheader">{{ group.title }}</v-list-subheader>
					<v-list-item
						v-for="item in group.items"
						:key="item.to"
						:to="item.to"
						:exact="item.exact"
						:prepend-icon="item.icon"
						:title="item.label"
					/>
				</template>

				<v-divider color="primary" :opacity="0.3" class="my-3" />

				<v-list-subheader class="nav-subheader">Übersicht</v-list-subheader>
				<v-list-item
					to="/wettschein"
					prepend-icon="mdi-grid"
					title="Wettschein"
				/>
				<v-list-item
					to="/starting-grid"
					prepend-icon="mdi-flag-checkered"
					title="Startaufstellung"
				/>
			</v-list>
		</v-navigation-drawer>

		<v-main>
			<router-view />
		</v-main>
	</v-app>
</template>

<script lang="ts" setup>
import { onBeforeMount, onBeforeUnmount, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'

import AppBar from '@/components/app-bar/AppBar.vue'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()
const { mobile } = useDisplay()
const drawerOpen = ref<boolean>(!mobile.value)

watch(mobile, isMobile => {
	drawerOpen.value = !isMobile
})

onBeforeMount(() => {
	theme.init()
	theme.bindVuetify()
})

onBeforeUnmount(() => {
	theme.destroy()
})

const navGroups = [
	{
		title: 'Mein Fahrer',
		items: [
			{ to: '/punkteliste', exact: false, label: 'Punkteliste', icon: 'mdi-trophy-award' },
			{ to: '/mein-fahrer', exact: false, label: 'Mein Fahrer', icon: 'mdi-account-star' },
			{ to: '/driver-championship', exact: false, label: 'Fahrer-WM', icon: 'mdi-trophy' },
			{ to: '/constructor-championship', exact: false, label: 'Konstrukteurs-WM', icon: 'mdi-car-sports' },
		],
	},
	{
		title: 'Renn-Wetten',
		items: [
			{ to: '/', exact: true, label: 'Top 3', icon: 'mdi-podium' },
			{ to: '/top10', exact: false, label: 'Top 10', icon: 'mdi-format-list-numbered' },
			{ to: '/pole', exact: false, label: 'Pole Position', icon: 'mdi-timer-outline' },
			{ to: '/fastest-lap', exact: false, label: 'Schnellste Runde', icon: 'mdi-speedometer' },
			{ to: '/first-dnf', exact: false, label: 'Erster Ausfall', icon: 'mdi-car-brake-alert' },
			{ to: '/driver-of-the-day', exact: false, label: 'Fahrer des Tages', icon: 'mdi-star-circle' },
		],
	},
	{
		title: 'Saison-Wetten',
		items: [
			{ to: '/team-duell', exact: false, label: 'Team-Duell', icon: 'mdi-sword-cross' },
		],
	},
]
</script>

<style scoped>
.logo-mark {
	width: 36px;
	height: 36px;
	border-radius: 10px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgb(var(--v-theme-primary));
	flex-shrink: 0;
}

.nav-subheader {
	font-size: 11px;
	line-height: 16px;
	font-weight: 500;
	letter-spacing: 0.2em;
	text-transform: uppercase;
	color: rgb(var(--v-theme-on-surface-variant));
	opacity: 0.9;
}
</style>
