import { dbChordToVexChord, userDefinedToVexChord } from "../src/chordDiagrams";
import {
	generateChord,
	clearChordCache,
	MAX_POSITIONS,
} from "../src/chordGenerator";
import { chromaticNoteColor } from "../src/chordsUtils";
import { INSTRUMENTS, Instrument } from "../src/instruments";
import { tokenizeLine } from "../src/sheet-parsing/tokenizeLine";
import { ChordToken, isChordToken } from "../src/sheet-parsing/tokens";

function tokenFor(symbol: string): ChordToken {
	const slash = symbol.indexOf("/");
	const tonicMatch = symbol.match(/^([A-G][#b]?)/);
	const tonic = tonicMatch?.[1] ?? "";
	const bass = slash >= 0 ? symbol.slice(slash + 1) : null;
	const type =
		slash >= 0
			? symbol.slice(tonic.length, slash)
			: symbol.slice(tonic.length);
	return {
		value: symbol,
		range: [0, symbol.length],
		type: "chord",
		chordSymbol: { value: symbol, range: [0, symbol.length] },
		chord: {
			tonic,
			type: type || "major",
			typeAliases: [],
			bass,
		},
	} as ChordToken;
}

function chordTokensFromSheet(source: string): ChordToken[] {
	let offset = 0;

	return source.split("\n").flatMap((line) => {
		const tokenized = tokenizeLine(line, offset, "%c", "%t");
		offset += line.length + 1;
		return tokenized.tokens.filter(isChordToken);
	});
}

function expectValidGeneratedChord(
	chordToken: ChordToken,
	instrument: Instrument,
) {
	const chord = generateChord(chordToken, instrument);
	if (!chord) {
		return;
	}

	const stringCount = INSTRUMENTS[instrument].strings;
	expect(chord.positions).not.toHaveLength(0);
	expect(chord.positions.length).toBeLessThanOrEqual(MAX_POSITIONS);

	for (const position of chord.positions) {
		expect(position.frets).toHaveLength(stringCount);
		expect(position.fingers).toHaveLength(stringCount);
		expect(position.baseFret).toBeGreaterThanOrEqual(1);
		for (const fret of position.frets) {
			expect(fret === -1 || (Number.isInteger(fret) && fret >= 0)).toBe(
				true,
			);
		}
		for (const finger of position.fingers) {
			expect(Number.isInteger(finger) && finger >= 0 && finger <= 4).toBe(
				true,
			);
		}
		expect(() =>
			dbChordToVexChord({ ...chord, positions: [position] }),
		).not.toThrow();
	}
}

function testGeneratedChord(
	symbol: string,
	positionIndex: number,
	expectedPartial: Partial<ReturnType<typeof dbChordToVexChord>>,
) {
	clearChordCache();
	const chord = generateChord(tokenFor(symbol), "guitar");
	expect(chord).not.toBeNull();
	expect(chord!.positions.length).toBeGreaterThan(positionIndex);

	const result = dbChordToVexChord(chord!, positionIndex);
	expect(result).toMatchObject(expectedPartial);
}

function testUserChord(
	frets: string,
	position: number,
	numStrings: number,
	expectedResult: Omit<ReturnType<typeof userDefinedToVexChord>, "tuning">,
) {
	const result = userDefinedToVexChord({ frets, position }, numStrings);

	expect(result.tuning).toEqual(new Array(numStrings).fill(""));

	expect(result).toMatchObject({
		...expectedResult,
		tuning: new Array(numStrings).fill(""),
	});
}

describe("Chromatic chord colors", () => {
	test("assigns enharmonic tonics the same hue", () => {
		expect(chromaticNoteColor("C")).toBe("oklch(72% 0.14 0)");
		expect(chromaticNoteColor("C#")).toBe("oklch(72% 0.14 30)");
		expect(chromaticNoteColor("Db")).toBe("oklch(72% 0.14 30)");
		expect(chromaticNoteColor("B")).toBe("oklch(72% 0.14 330)");
	});
});

describe("Generated chord diagrams", () => {
	beforeEach(() => clearChordCache());

	test("open C major generates a diagram", () => {
		const chord = generateChord(tokenFor("C"), "guitar");
		expect(chord).not.toBeNull();
		expect(chord!.positions.length).toBeGreaterThan(0);
		// Classic open C: x32010
		expect(chord!.positions[0].frets).toEqual([-1, 3, 2, 0, 1, 0]);
	});

	test("E7/G# generates the open first-inversion shape", () => {
		const chord = generateChord(tokenFor("E7/G#"), "guitar");
		expect(chord).not.toBeNull();
		expect(chord!.positions[0].frets).toEqual([4, 2, 0, 1, 0, 0]);
	});

	test("E7/Ab also generates (enharmonic slash)", () => {
		const chord = generateChord(tokenFor("E7/Ab"), "guitar");
		expect(chord).not.toBeNull();
		expect(chord!.positions.length).toBeGreaterThan(0);
	});

	test("Am open shape", () => {
		const chord = generateChord(tokenFor("Am"), "guitar");
		expect(chord!.positions[0].frets).toEqual([-1, 0, 2, 2, 1, 0]);
	});

	test("dbChordToVexChord converts generated C", () => {
		testGeneratedChord("C", 0, {
			chord: [
				[1, 0],
				[2, 1],
				[3, 0],
				[4, 2],
				[5, 3],
				[6, "x"],
			],
			position: 1,
		});
	});

	test("ukulele C major generates", () => {
		const chord = generateChord(tokenFor("C"), "ukulele");
		expect(chord).not.toBeNull();
		expect(chord!.positions[0].frets).toHaveLength(4);
	});

	test("mandolin C major generates", () => {
		const chord = generateChord(tokenFor("C"), "mandolin");
		expect(chord).not.toBeNull();
		expect(chord!.positions[0].frets).toHaveLength(4);
	});
});

describe("Generated diagrams from chord sheets", () => {
	const pseudoSheet = `[Verse]
C Am F G %c
[E7/G#]This [E7/Ab]love is [Cmaj7]taking me home
Dm7 G7 C6 Cadd9 C7#9 C7alt %c
C/G C/G# Dm7/C %c
H C//G N.C. %c`;

	test("recognizes chords in chord lines and inline lyrics", () => {
		expect(
			chordTokensFromSheet(pseudoSheet).map(
				(token) => token.chordSymbol.value,
			),
		).toEqual([
			"C",
			"Am",
			"F",
			"G",
			"E7/G#",
			"E7/Ab",
			"Cmaj7",
			"Dm7",
			"G7",
			"C6",
			"Cadd9",
			"C7#9",
			"C7alt",
			"C/G",
			"C/G#",
			"Dm7/C",
		]);
	});

	test.each(Object.keys(INSTRUMENTS) as Instrument[])(
		"returns only renderer-safe positions for %s",
		(instrument) => {
			for (const chordToken of chordTokensFromSheet(pseudoSheet)) {
				expect(() =>
					expectValidGeneratedChord(chordToken, instrument),
				).not.toThrow();
			}
		},
	);

	test("does not throw for an unrecognized generated symbol", () => {
		expect(() =>
			generateChord(tokenFor("Cnotachord"), "guitar"),
		).not.toThrow();
		expect(generateChord(tokenFor("Cnotachord"), "guitar")).toBeNull();
	});

	test("rejects a generated position outside the available range", () => {
		const chord = generateChord(tokenFor("C"), "guitar");
		expect(chord).not.toBeNull();
		expect(() =>
			dbChordToVexChord(chord!, chord!.positions.length),
		).toThrow(RangeError);
	});
});

describe("Conversion of user-defined chords to vexchord format", () => {
	describe("userDefinedToVexChord", () => {
		test("basic fret pattern", () => {
			testUserChord("320013", 1, 6, {
				chord: [
					[6, 3],
					[5, 2],
					[4, 0],
					[3, 0],
					[2, 1],
					[1, 3],
				],
				position: 1,
				barres: [],
				numFrets: 4,
			});
		});

		test("single barre pattern", () => {
			testUserChord("_335533_", 1, 6, {
				chord: [
					[6, 3],
					[5, 3],
					[4, 5],
					[3, 5],
					[2, 3],
					[1, 3],
				],
				position: 1,
				barres: [
					{
						fromString: 6,
						toString: 1,
						fret: 3,
					},
				],
				numFrets: 5,
			});
		});

		test("muted strings with x", () => {
			testUserChord("x32010", 1, 6, {
				chord: [
					[6, "x"],
					[5, 3],
					[4, 2],
					[3, 0],
					[2, 1],
					[1, 0],
				],
				position: 1,
				barres: [],
				numFrets: 4,
			});
		});

		test("double barre pattern", () => {
			testUserChord("_3333__55_", 1, 6, {
				chord: [
					[6, 3],
					[5, 3],
					[4, 3],
					[3, 3],
					[2, 5],
					[1, 5],
				],
				position: 1,
				barres: [
					{
						fromString: 6,
						toString: 3,
						fret: 3,
					},
					{
						fromString: 2,
						toString: 1,
						fret: 5,
					},
				],
				numFrets: 5,
			});
		});

		test("multi-digit frets with spaces", () => {
			testUserChord("12 14 14 13 12 12", 0, 6, {
				chord: [
					[6, 1],
					[5, 3],
					[4, 3],
					[3, 2],
					[2, 1],
					[1, 1],
				],
				position: 12,
				barres: [],
				numFrets: 4,
			});
		});

		test("multi-digit frets with commas and muted strings", () => {
			testUserChord("x,10,12,12,11,x", 0, 6, {
				chord: [
					[6, "x"],
					[5, 1],
					[4, 3],
					[3, 3],
					[2, 2],
					[1, "x"],
				],
				position: 10,
				barres: [],
				numFrets: 4,
			});
		});

		test("open strings with multi-digit notation", () => {
			testUserChord("0 12 13 12 0 0", 0, 6, {
				chord: [
					[6, 0],
					[5, 1],
					[4, 2],
					[3, 1],
					[2, 0],
					[1, 0],
				],
				position: 12,
				barres: [],
				numFrets: 4,
			});
		});

		test("multi-digit barre notation", () => {
			testUserChord("_20 22 22 22 20 20_", 0, 6, {
				chord: [
					[6, 1],
					[5, 3],
					[4, 3],
					[3, 3],
					[2, 1],
					[1, 1],
				],
				position: 20,
				barres: [
					{
						fromString: 6,
						toString: 1,
						fret: 1,
					},
				],
				numFrets: 4,
			});
		});

		test("rejects a shape with the wrong number of strings", () => {
			expect(() =>
				userDefinedToVexChord({ frets: "x3201", position: 0 }, 6),
			).toThrow(RangeError);
		});

		test("rejects non-fret characters", () => {
			expect(() =>
				userDefinedToVexChord({ frets: "x3a010", position: 0 }, 6),
			).toThrow("Fret strings may only contain");
		});

		test("explicit position with relative frets", () => {
			testUserChord("x2x132", 4, 6, {
				chord: [
					[6, "x"],
					[5, 2],
					[4, "x"],
					[3, 1],
					[2, 3],
					[1, 2],
				],
				position: 4,
				barres: [],
				numFrets: 4,
			});
		});
	});
});
