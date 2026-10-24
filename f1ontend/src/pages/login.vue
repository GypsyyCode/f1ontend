<template>
	<v-container fluid class="mt-8 h-full flex items-center w-full flex-col grow">
		<div class="w-full max-w-md mx-auto">
			<v-card class="py-6 px-6 shape-lg" variant="flat">
				<div class="text-[10px] tracking-[0.3em] text-neutral-500">F1 TIPSPIEL</div>
				<div class="text-2xl font-bold mb-4">{{ mode === 'login' ? 'Anmelden' : 'Registrieren' }}</div>

				<v-form @submit.prevent="onSubmit">
					<v-text-field
						v-model="username"
						label="Benutzername"
						density="comfortable"
						variant="outlined"
						autocomplete="username"
					/>
					<v-text-field
						v-if="mode === 'register'"
						v-model="email"
						label="E-Mail"
						type="email"
						density="comfortable"
						variant="outlined"
						autocomplete="email"
					/>
					<v-text-field
						v-model="password"
						label="Passwort"
						type="password"
						density="comfortable"
						variant="outlined"
						:hint="mode === 'register' ? 'Mindestens 8 Zeichen' : undefined"
						persistent-hint
						autocomplete="current-password"
					/>

					<v-alert v-if="error" type="error" class="mt-3">{{ error }}</v-alert>

					<v-btn
						type="submit"
						:loading="submitting"
						:disabled="submitting"
						color="primary"
						block
						class="mt-4"
					>
						{{ mode === 'login' ? 'Anmelden' : 'Konto erstellen' }}
					</v-btn>
				</v-form>

				<v-btn variant="text" size="small" class="mt-3" @click="toggleMode">
					{{ mode === 'login' ? 'Noch kein Konto? Registrieren' : 'Schon ein Konto? Anmelden' }}
				</v-btn>
			</v-card>
		</div>
	</v-container>
</template>

<script setup lang="ts">
	import { ref } from 'vue'
	import { useRouter } from 'vue-router'
	import { login, register } from '@/plugins/auth'
	import { useAuthStore } from '@/stores/auth'

	const router = useRouter()
	const auth = useAuthStore()

	const mode = ref<'login' | 'register'>('login')
	const username = ref('')
	const email = ref('')
	const password = ref('')
	const submitting = ref(false)
	const error = ref<string | null>(null)

	function toggleMode () {
		mode.value = mode.value === 'login' ? 'register' : 'login'
		error.value = null
	}

	async function onSubmit () {
		submitting.value = true
		error.value = null
		try {
			const result = mode.value === 'login'
				? await login(username.value, password.value)
				: await register(username.value, email.value, password.value)
			auth.setSession(result.token, result.player)
			router.push('/')
		} catch (e) {
			error.value = e instanceof Error ? e.message : String(e)
		} finally {
			submitting.value = false
		}
	}
</script>
