import { Chord, Note } from "tonal";
import { findFingerings, findGuitarChord, Fingering } from "chord-fingering";

import { Instrument, INSTRUMENTS } from "./instruments";
import { ChordToken } from "./sheet-parsing/tokens";

/** Matches the shape formerly provided by @tombatossals/chords-db */
export interface ChordPosition {
	frets: number[];
	fingers: number[];
	baseFret: number;
	barres: number[];
	midi?: number[];
	capo?: boolean;
}

export interface ChordDef {
	key: string;
	suffix: string;
	positions: ChordPosition[];
}

export const MAX_POSITIONS = 50;
const cache = new Map<string, ChordDef | null>();

/**
 * Always-generate chord diagrams for the token's symbol + instrument tuning.
 * Uses chord-fingering (no static chord database).
 */
export function generateChord(
	chordToken: ChordToken,
	instrument: Instrument,
): ChordDef | null {
	const symbol = chordToken.chordSymbol.value;
	const cacheKey = `${instrument}|${symbol}`;
	if (cache.has(cacheKey)) {
		return cache.get(cacheKey) ?? null;
	}

	const config = INSTRUMENTS[instrument];
	const fingerings = fingeringsForSymbol(symbol, config.tuning);
	const positions = fingerings
		.map((fingering) => fingeringToPosition(fingering, config.strings))
		.filter((position): position is ChordPosition => position !== null)
		.slice(0, MAX_POSITIONS);
	if (!positions.length) {
		cache.set(cacheKey, null);
		return null;
	}

	const chordDef: ChordDef = {
		key: chordToken.chord.tonic,
		suffix: chordSuffix(chordToken),
		positions,
	};
	cache.set(cacheKey, chordDef);
	return chordDef;
}

function chordSuffix(chordToken: ChordToken): string {
	const type = chordToken.chord.type || "major";
	return chordToken.chord.bass ? `${type}/${chordToken.chord.bass}` : type;
}

function fingeringsForSymbol(symbol: string, tuning: string): Fingering[] {
	try {
		// Prefer the library's chord parser (handles slash chords well).
		const fromLib = findGuitarChord(symbol, tuning);
		if (fromLib?.fingerings?.length) {
			return fromLib.fingerings;
		}

		// Fallback: tonal note extraction + fingering search (covers aliases tonal knows).
		const tonalChord = Chord.get(symbol);
		if (tonalChord.empty || !tonalChord.tonic) {
			return [];
		}

		const bass = tonalChord.bass || tonalChord.tonic;
		// Deduplicate enharmonic spellings (e.g. E7/Ab → Ab + G#)
		const notes = uniquePitchClasses(tonalChord.notes);
		return findFingerings(notes, [], bass, tuning);
	} catch {
		return [];
	}
}

function uniquePitchClasses(notes: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const note of notes) {
		const pc = Note.chroma(note);
		if (pc === undefined || seen.has(String(pc))) {
			continue;
		}
		seen.add(String(pc));
		out.push(Note.pitchClass(note));
	}
	return out;
}

function fingeringToPosition(
	fingering: Fingering,
	numStrings: number,
): ChordPosition | null {
	const absoluteFrets = new Array(numStrings).fill(-1);
	for (const pos of fingering.positions) {
		if (
			!Number.isInteger(pos.stringIndex) ||
			pos.stringIndex < 0 ||
			pos.stringIndex >= numStrings ||
			!Number.isInteger(pos.fret) ||
			pos.fret < 0
		) {
			return null;
		}
		absoluteFrets[pos.stringIndex] = pos.fret;
	}

	const { frets, baseFret } = toRelativeFrets(absoluteFrets);
	const barreFrets: number[] = [];
	if (fingering.barre) {
		const absBarre = fingering.barre.fret;
		const rel = baseFret === 1 ? absBarre : absBarre - baseFret + 1;
		if (
			Number.isInteger(absBarre) &&
			absBarre > 0 &&
			frets.filter((f) => f === rel).length >= 2
		) {
			barreFrets.push(rel);
		}
	}

	return {
		frets,
		fingers: assignFingers(frets, barreFrets),
		baseFret,
		barres: barreFrets,
	};
}

/**
 * Convert absolute frets to chords-db-style relative frets + baseFret for ChordBox.
 */
function toRelativeFrets(absoluteFrets: number[]): {
	frets: number[];
	baseFret: number;
} {
	const pressed = absoluteFrets.filter((f) => f > 0);
	if (pressed.length === 0) {
		return { frets: absoluteFrets, baseFret: 1 };
	}

	const min = Math.min(...pressed);
	const max = Math.max(...pressed);

	// Keep open-position style when everything fits near the nut
	if (max <= 4 || min <= 2) {
		return { frets: absoluteFrets, baseFret: 1 };
	}

	const baseFret = min;
	const frets = absoluteFrets.map((f) => (f > 0 ? f - baseFret + 1 : f));
	return { frets, baseFret };
}

/**
 * Assign left-hand finger numbers (1–4). Barre strings share finger 1.
 */
function assignFingers(frets: number[], barres: number[]): number[] {
	const fingers = frets.map(() => 0);
	const barreFret = barres[0];

	if (barreFret !== undefined) {
		for (let i = 0; i < frets.length; i++) {
			if (frets[i] === barreFret) {
				fingers[i] = 1;
			}
		}
	}

	const remaining = frets
		.map((fret, stringIndex) => ({ fret, stringIndex }))
		.filter(
			({ fret, stringIndex }) => fret > 0 && fingers[stringIndex] === 0,
		)
		.sort((a, b) => a.fret - b.fret || a.stringIndex - b.stringIndex);

	let nextFinger = barreFret !== undefined ? 2 : 1;
	for (const { stringIndex } of remaining) {
		if (nextFinger > 4) {
			fingers[stringIndex] = 4;
		} else {
			fingers[stringIndex] = nextFinger++;
		}
	}

	return fingers;
}

export function clearChordCache() {
	cache.clear();
}
