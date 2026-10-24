import type { PiniaPlugin, PiniaPluginContext } from 'pinia'
import { idbGet, idbSet } from '@/lib/idb'

/**
 * Pinia-Plugin, das jeden Store beim Anlegen aus IndexedDB hydratisiert
 * und anschließend Änderungen zurück persistiert.
 *
 * Verhalten:
 *  - Vor dem Hydratisieren werden Store-Mutationen NICHT persistiert,
 *    damit die beim Setup gesetzten Defaults nicht die bereits
 *    gespeicherten Werte überschreiben.
 *  - Die Writes werden kurz debouncet (120 ms), damit schnelle
 *    aufeinanderfolgende Mutationen (z. B. mehrere swapPicks beim Drag)
 *    nur einen Write erzeugen.
 *  - Stores können per Convention aus der Persistenz ausgenommen werden,
 *    indem sie in `IGNORED_STORES` eingetragen werden.
 */

const KEY_PREFIX = 'pinia:'
const DEBOUNCE_MS = 120
const IGNORED_STORES = new Set<string>(['season'])

/** Tiefes Klonen für die Persistenz; nutzt structuredClone wenn verfügbar. */
function snapshot (state: unknown): unknown {
	if (typeof structuredClone === 'function') {
		try {
			return structuredClone(state)
		} catch {
			// z. B. bei nicht serialisierbaren Werten → Fallback
		}
	}
	return JSON.parse(JSON.stringify(state))
}

export const piniaIdbPlugin: PiniaPlugin = (ctx: PiniaPluginContext) => {
	if (IGNORED_STORES.has(ctx.store.$id)) return

	const key = `${KEY_PREFIX}${ctx.store.$id}`
	let hydrated = false
	let timer: ReturnType<typeof setTimeout> | undefined

	const persist = (state: unknown) => {
		clearTimeout(timer)
		const snap = snapshot(state)
		timer = setTimeout(() => {
			idbSet(key, snap).catch(err => {
				console.warn(`[pinia-idb] write failed for ${ctx.store.$id}`, err)
			})
		}, DEBOUNCE_MS)
	}

	// Hydrate asynchron – während IDB geladen wird, laufen Setup-Defaults
	// bereits durch, werden aber nicht persistiert, da `hydrated` noch false ist.
	idbGet<Record<string, unknown>>(key)
		.then(saved => {
			if (saved && typeof saved === 'object') {
				// Saved payload spiegelt den State 1:1 wider; der Cast via unknown
				// ist nötig, weil $patch strenger typisiert ist als unser
				// generisches `kv`.
				ctx.store.$patch(saved as unknown as Parameters<typeof ctx.store.$patch>[0])
			}
		})
		.catch(err => {
			console.warn(`[pinia-idb] hydrate failed for ${ctx.store.$id}`, err)
		})
		.finally(() => {
			hydrated = true
		})

	ctx.store.$subscribe((_mutation, state) => {
		if (!hydrated) return
		persist(state)
	}, { detached: true })
}
