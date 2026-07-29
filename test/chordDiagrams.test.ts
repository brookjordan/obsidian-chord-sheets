import {dbChordToVexChord, userDefinedToVexChord} from "../src/chordDiagrams";
import {generateChord, clearChordCache} from "../src/chordGenerator";
import {ChordToken} from "../src/sheet-parsing/tokens";

function tokenFor(symbol: string): ChordToken {
	const slash = symbol.indexOf("/");
	const tonicMatch = symbol.match(/^([A-G][#b]?)/);
	const tonic = tonicMatch?.[1] ?? "";
	const bass = slash >= 0 ? symbol.slice(slash + 1) : null;
	const type = slash >= 0
		? symbol.slice(tonic.length, slash)
		: symbol.slice(tonic.length);
	return {
		value: symbol,
		range: [0, symbol.length],
		type: "chord",
		chordSymbol: {value: symbol, range: [0, symbol.length]},
		chord: {
			tonic,
			type: type || "major",
			typeAliases: [],
			bass,
		},
	} as ChordToken;
}

function testGeneratedChord(symbol: string, positionIndex: number, expectedPartial: Partial<ReturnType<typeof dbChordToVexChord>>) {
	clearChordCache();
	const chord = generateChord(tokenFor(symbol), "guitar");
	expect(chord).not.toBeNull();
	expect(chord!.positions.length).toBeGreaterThan(positionIndex);

	const result = dbChordToVexChord(chord!, positionIndex);
	expect(result).toMatchObject(expectedPartial);
}

function testUserChord(frets: string, position: number, numStrings: number, expectedResult: Omit<ReturnType<typeof userDefinedToVexChord>, 'tuning'>) {
	const result = userDefinedToVexChord({frets, position}, numStrings);
	
	expect(result.tuning).toEqual(new Array(numStrings).fill(''));
	
	expect(result).toMatchObject({
		...expectedResult,
		tuning: new Array(numStrings).fill('')
	});
}

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
				[6, "x"]
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
					[1, 3]
				],
				position: 1,
				barres: [],
				numFrets: 4
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
					[1, 3]
				],
				position: 1,
				barres: [
					{
						fromString: 6,
						toString: 1,
						fret: 3
					}
				],
				numFrets: 5
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
					[1, 0]
				],
				position: 1,
				barres: [],
				numFrets: 4
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
					[1, 5]
				],
				position: 1,
				barres: [
					{
						fromString: 6,
						toString: 3,
						fret: 3
					},
					{
						fromString: 2,
						toString: 1,
						fret: 5
					}
				],
				numFrets: 5
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
					[1, 1]
				],
				position: 12,
				barres: [],
				numFrets: 4
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
					[1, "x"]
				],
				position: 10,
				barres: [],
				numFrets: 4
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
					[1, 0]
				],
				position: 12,
				barres: [],
				numFrets: 4
			});
		});

		test("explicit position with relative frets", () => {
			testUserChord("x2x132", 4, 6, {
				chord: [
					[6, "x"],
					[5, 2],
					[4, "x"],
					[3, 1],
					[2, 3],
					[1, 2]
				],
				position: 4,
				barres: [],
				numFrets: 4
			});
		});
	});
});
