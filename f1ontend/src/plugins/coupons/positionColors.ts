/**
 * Gemeinsame Farbpalette für Platzierungen 1..10.
 *
 * Positionen 1–3 bleiben Gold/Silber/Bronze (konsistent zur Top-3-Wette),
 * 4–10 nutzen eine Blau-Skala, damit die Matrix auch für Top-10-Wetten
 * durchgehend farbig bleibt.
 */
export const positionColors: readonly string[] = [
	'#FFD700', // 1
	'#C0C0C0', // 2
	'#CD7F32', // 3
	'#60a5fa', // 4
	'#38bdf8', // 5
	'#0ea5e9', // 6
	'#0284c7', // 7
	'#0369a1', // 8
	'#075985', // 9
	'#0c4a6e', // 10
]

/** Hilfsfunktion: liefert die Farbe für Position `n` (1-basiert). */
export function colorForPosition (position: number): string | undefined {
	return positionColors[position - 1]
}
