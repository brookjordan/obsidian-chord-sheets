import {Note} from "tonal";

import {Instrument} from "./instruments";
import {ChordToken} from "./sheet-parsing/tokens";

export type {Instrument} from "./instruments";
export {INSTRUMENT_NAMES, INSTRUMENTS} from "./instruments";

export interface UserDefinedChord {
	frets: string;
	position: number;
}

export interface SheetChord {
	tonic: string,
	type: string,
	typeAliases: string[],
	bass: string | null,
	userDefinedChord?: UserDefinedChord
}


export function getTonicVariations(tonic: string) {
	const tonicVariations = [
		tonic, Note.simplify(tonic), Note.enharmonic(tonic)
	];

	const sharp = "#";
	const sharpVariation = tonicVariations.find(variation => variation?.contains(sharp));
	if (sharpVariation) {
		tonicVariations.push(sharpVariation.replace(sharp, "sharp"));
	}
	return tonicVariations;
}

export function uniqueChordTokens(chordTokens: ChordToken[]) {
	const seenValues = new Set<string>();

	return chordTokens.filter(token => {
		if (!seenValues.has(token.chordSymbol.value)) {
			seenValues.add(token.chordSymbol.value);
			return true;
		}
		return false;
	});
}

export function chordSequenceString(chordTokens: ChordToken[]) {
	return JSON.stringify(chordTokens.map(token => token.value));
}
