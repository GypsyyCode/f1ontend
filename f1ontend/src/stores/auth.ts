import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Player } from '@/plugins/auth'

/**
 * Auth-Zustand: JWT + Spielerprofil. Persistiert via piniaIdb, damit man nach
 * Reload angemeldet bleibt. Der Token wird an geschützte Backend-Routen als
 * Bearer mitgegeben (`coupon.ts`/`listCoupons` akzeptieren ihn bereits).
 */
export const useAuthStore = defineStore('auth', () => {
	const token = ref<string | null>(null)
	const player = ref<Player | null>(null)

	const isAuthenticated = computed(() => !!token.value)

	function setSession (t: string, p: Player) {
		token.value = t
		player.value = p
	}

	function logout () {
		token.value = null
		player.value = null
	}

	return { token, player, isAuthenticated, setSession, logout }
})
