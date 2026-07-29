declare module "chord-fingering" {
	export interface FingeringPosition {
		stringNote: string;
		stringIndex: number;
		fret: number;
		note: string;
	}

	export interface Barre {
		fret: number;
		stringIndices: number[];
	}

	export interface Fingering {
		positions: FingeringPosition[];
		barre: Barre | null;
		positionString: string;
		difficulty: number;
	}

	export interface GuitarChord {
		input: string;
		symbol: string;
		notes: string[];
		optionalNotes: string[];
		requiredNotes: string[];
		bass: string;
		fingerings: Fingering[];
	}

	export function findGuitarChord(
		symbol: string,
		tuning?: string | string[],
		caseSensitive?: boolean,
	): GuitarChord | null;

	export function findFingerings(
		notes: string[],
		optionalNotes?: string[],
		bass?: string | null,
		tuning?: string | string[],
	): Fingering[];
}
