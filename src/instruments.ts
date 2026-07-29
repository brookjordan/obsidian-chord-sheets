export type Instrument =
	| "guitar"
	| "ukulele"
	| "ukulele-d-tuning"
	| "ukulele-baritone"
	| "mandolin";

export interface InstrumentConfig {
	name: Instrument;
	strings: number;
	/** How many frets to show in the diagram */
	fretsOnChord: number;
	/** Hyphen-delimited tuning from lowest to highest string (chord-fingering format) */
	tuning: string;
}

export const INSTRUMENTS: Record<Instrument, InstrumentConfig> = {
	guitar: {
		name: "guitar",
		strings: 6,
		fretsOnChord: 4,
		tuning: "E2-A2-D3-G3-B3-E4",
	},
	ukulele: {
		name: "ukulele",
		strings: 4,
		fretsOnChord: 5,
		tuning: "G4-C4-E4-A4",
	},
	"ukulele-d-tuning": {
		name: "ukulele-d-tuning",
		strings: 4,
		fretsOnChord: 4,
		tuning: "A4-D4-F#4-B4",
	},
	"ukulele-baritone": {
		name: "ukulele-baritone",
		strings: 4,
		fretsOnChord: 5,
		tuning: "D3-G3-B3-E4",
	},
	mandolin: {
		name: "mandolin",
		strings: 4,
		fretsOnChord: 6,
		tuning: "G3-D4-A4-E5",
	},
};

export const INSTRUMENT_NAMES = Object.keys(INSTRUMENTS) as Instrument[];
