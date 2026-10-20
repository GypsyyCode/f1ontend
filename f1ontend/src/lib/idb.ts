/**
 * Minimaler Promise-Wrapper um IndexedDB mit einem einzigen Object-Store
 * im Key-Value-Modus. Reicht für die Store-Persistenz; absichtlich keine
 * zusätzliche Dependency.
 */

const DB_NAME = 'f1ontend'
const STORE_NAME = 'kv'
const VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDb (): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise
	dbPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, VERSION)
		req.addEventListener('upgradeneeded', () => {
			req.result.createObjectStore(STORE_NAME)
		})
		req.addEventListener('success', () => resolve(req.result))
		req.addEventListener('error', () => reject(req.error))
	})
	return dbPromise
}

export async function idbGet<T = unknown> (key: string): Promise<T | undefined> {
	const db = await openDb()
	return new Promise<T | undefined>((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly')
		const req = tx.objectStore(STORE_NAME).get(key)
		req.addEventListener('success', () => resolve(req.result as T | undefined))
		req.addEventListener('error', () => reject(req.error))
	})
}

export async function idbSet (key: string, value: unknown): Promise<void> {
	const db = await openDb()
	return new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite')
		tx.objectStore(STORE_NAME).put(value, key)
		tx.addEventListener('complete', () => resolve())
		tx.addEventListener('error', () => reject(tx.error))
		tx.addEventListener('abort', () => reject(tx.error))
	})
}

export async function idbDel (key: string): Promise<void> {
	const db = await openDb()
	return new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite')
		tx.objectStore(STORE_NAME).delete(key)
		tx.addEventListener('complete', () => resolve())
		tx.addEventListener('error', () => reject(tx.error))
		tx.addEventListener('abort', () => reject(tx.error))
	})
}
