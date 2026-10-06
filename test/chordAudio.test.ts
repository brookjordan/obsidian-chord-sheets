import { midiNotesForPosition, soundingChordName } from "../src/chordAudio";
import { ChordPosition } from "../src/chordGenerator";

describe("Chord audio", () => {
	test("uses the selected fingering and capo for sounding pitches", () => {
		const aMajor: ChordPosition = {
			frets: [-1, 0, 2, 2, 2, 0],
			fingers: [0, 0, 1, 2, 3, 0],
			baseFret: 1,
			barres: [],
		};

		expect(midiNotesForPosition("guitar", aMajor, 0)).toEqual([
			45, 52, 57, 61, 64,
		]);
		expect(midiNotesForPosition("guitar", aMajor, 7)).toEqual([
			52, 59, 64, 68, 71,
		]);
	});

	test("transposes diagram labels to their sounding chords", () => {
		expect(soundingChordName("A", 7)).toBe("E");
		expect(soundingChordName("Bm7/F#", 7)).toBe("F#m7/C#");
		expect(soundingChordName("D", 0)).toBe("D");
	});
});
