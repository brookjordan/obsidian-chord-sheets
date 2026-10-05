import { parseStrummingBlock } from "../src/strummingBlock";

describe("Strumming blocks", () => {
	test("beat labels disambiguate an all-down strumming pattern", () => {
		const block = parseStrummingBlock([
			"Capo 7th fret",
			"",
			"118bpm",
			"",
			"1 & 2 & 3 & 4 &",
			"D D D D D D D D",
			"",
			"Capo 7th fret",
		]);

		expect(block[2]).toEqual({ type: "bpm", bpm: 118 });
		expect(block[4]).toEqual({ type: "beat-labels" });
		expect(block[5]).toEqual({
			type: "pattern",
			pattern: {
				steps: ["D", "D", "D", "D", "D", "D", "D", "D"],
				labels: ["1", "&", "2", "&", "3", "&", "4", "&"],
				bpm: 118,
			},
		});
		expect(block[0]).toEqual({ type: "capo", fret: 7 });
		expect(block[7]).toEqual({ type: "capo", fret: 7 });
	});

	test("an all-down line without matching beat labels remains ambiguous", () => {
		expect(parseStrummingBlock(["D D D D"])).toEqual([{ type: "other" }]);
		expect(parseStrummingBlock(["1 & 2 &", "D D D"])).toEqual([
			{ type: "other" },
			{ type: "other" },
		]);
	});

	test("a BPM line remains ordinary text without a strumming pattern", () => {
		expect(parseStrummingBlock(["118bpm", "Capo 7th fret"])).toEqual([
			{ type: "other" },
			{ type: "capo", fret: 7 },
		]);
	});

	test("recognizes common standalone capo notation", () => {
		expect(parseStrummingBlock(["Capo 7th fret"])).toEqual([
			{ type: "capo", fret: 7 },
		]);
		expect(parseStrummingBlock(["capo: 3"])).toEqual([
			{ type: "capo", fret: 3 },
		]);
	});
});
