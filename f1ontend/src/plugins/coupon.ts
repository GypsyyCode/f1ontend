/**
 * Kommunikation mit der Coupon-API des F1-Tippspiels (Backend: ../../f1-tip-game).
 *
 * Endpunkt zum Anlegen einer Wette:
 *   POST /api/v1/coupons/{category}/{schemaName}
 *   Body:    { "schema": <SchemaDaten> }
 *   Antwort: 201 Created + angelegter Coupon (CouponBase)
 */

// Base-URL des Backends; per .env (VITE_API_URL) überschreibbar, sonst lokaler Default.
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

/** Kategorien entsprechen coupons.Category im Backend. */
export type CouponCategory = 'season' | 'race' | 'team'

/** Eine Platzierung innerhalb einer Wette (Fahrer auf Position). */
export type Placement = {
	driver_id: number
	position: number
}

/**
 * Eine anzulegende Wette/Coupon.
 *
 * `category` + `schemaName` bestimmen den API-Endpunkt und damit die Wettart,
 * `data` sind die zur Wettart passenden Schema-Daten (z. B. { placements: [...] }).
 */
export type Coupon<TData = unknown> = {
	name: string
	category: CouponCategory
	schemaName: string
	data: TData
}

/** Vom Backend zurückgegebener Coupon (CouponBase[T]). */
export type CreatedCoupon<TData = unknown> = {
	id: string
	name: string
	description: string
	category: number
	schemaName: string
	schema: { data: TData }
}

/**
 * Legt eine neue Wette/Coupon über die API des F1-Tippspiels an.
 *
 * @param coupon Die anzulegende Wette (Kategorie, Schema-Name und Schema-Daten).
 * @param token  Optionales JWT (Bearer) – die Coupon-Routen sind aktuell öffentlich.
 * @returns      Der angelegte Coupon inklusive generierter ID.
 * @throws       Error, falls die API nicht mit 2xx antwortet.
 */
export async function create<TData extends object> (
	coupon: Coupon<TData>,
	token?: string,
): Promise<CreatedCoupon<TData>> {
	const res = await fetch(
		`${API_BASE}/api/v1/coupons/${coupon.category}/${coupon.schemaName}`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
			// Das Backend erwartet die Schema-Daten unter dem Schlüssel "schema".
			body: JSON.stringify({ schema: coupon.data }),
		},
	)

	if (!res.ok) {
		const message = await res.text().catch(() => res.statusText)
		throw new Error(
			`Coupon konnte nicht angelegt werden (HTTP ${res.status}): ${message}`,
		)
	}

	return await res.json() as CreatedCoupon<TData>
}
