export const MAX_CAPO_FRET = 24;

export function parseCapo(line: string): number | null {
	const match = line.match(
		/^\s*capo\s*:?\s*(\d{1,2})(?:st|nd|rd|th)?(?:\s+fret)?\s*$/i,
	);
	if (!match) {
		return null;
	}
	const fret = Number(match[1]);
	return fret >= 0 && fret <= MAX_CAPO_FRET ? fret : null;
}
