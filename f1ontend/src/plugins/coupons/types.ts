/**
 * Zentrale Typen für die Wetten/Coupons.
 *
 * Liegt bewusst getrennt von `useCoupon.ts`, damit sowohl der Pinia-Store
 * (`stores/coupons.ts`) als auch der Composable auf dieselben Typen
 * zugreifen können, ohne einen Zirkelimport zu erzeugen.
 */

export type PodiumDriver = {
	driver_id: number
	name: string
}
