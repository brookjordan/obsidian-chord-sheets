import {
	displayStrums,
	parseBeatLabels,
	parseStandaloneBpm,
	parseStrummingPattern,
	strumDurationClass,
	strumDurationUnits,
	strumSlotDurationMs,
	withBeatLabels,
	withBpm,
} from "../src/strummingPatterns";

describe("Strumming patterns", () => {
	test("recognizes an unlabeled pattern", () => {
		expect(parseStrummingPattern("D - D U - U")).toEqual({
			steps: ["D", "-", "D", "U", "-", "U"],
		});
	});

	test("recognizes explicit prefixes and alternate symbols", () => {
		expect(parseStrummingPattern("Strum: v - ^ ×")).toEqual({
			steps: ["D", "-", "U", "x"],
		});
	});

	test("recognizes BPM before or after a pattern", () => {
		expect(parseStrummingPattern("300bpm D - U")).toEqual({
			steps: ["D", "-", "U"],
			bpm: 300,
		});
		expect(parseStrummingPattern("D - U 180bpm")).toEqual({
			steps: ["D", "-", "U"],
			bpm: 180,
		});
	});

	test("recognizes a terminal repeat marker", () => {
		expect(parseStrummingPattern("D - U x2")).toEqual({
			steps: ["D", "-", "U"],
			repeat: 2,
		});
		expect(parseStrummingPattern("D - U 3x")).toEqual({
			steps: ["D", "-", "U"],
			repeat: 3,
		});
		expect(parseStrummingPattern("D D x2")).toEqual({
			steps: ["D", "D"],
			repeat: 2,
		});
		expect(parseStrummingPattern("D x2 U")).toBeNull();
	});

	test("recognizes a standalone block BPM", () => {
		expect(parseStandaloneBpm(" 300bpm ")).toBe(300);
		expect(parseStandaloneBpm("D U 300bpm")).toBeNull();
	});

	test("uses a block BPM unless the pattern overrides it", () => {
		const pattern = parseStrummingPattern("D - U")!;
		expect(withBpm(pattern, 160).bpm).toBe(160);
		expect(withBpm({ ...pattern, bpm: 200 }, 160).bpm).toBe(200);
	});

	test("does not confuse a chord line with a strumming pattern", () => {
		expect(parseStrummingPattern("D G A")).toBeNull();
	});

	test("attaches a matching beat grid", () => {
		const pattern = parseStrummingPattern("D - D U - U")!;
		expect(withBeatLabels(pattern, parseBeatLabels("1 & 2 & 3 &"))).toEqual(
			{
				steps: ["D", "-", "D", "U", "-", "U"],
				labels: ["1", "&", "2", "&", "3", "&"],
			},
		);
	});

	test("extends a strum across following hold slots", () => {
		expect(displayStrums(["D", "-", "U", "x", "-"])).toEqual([
			{ step: "D", duration: 2 },
			{ step: "U", duration: 1 },
			{ step: "x", duration: 2 },
		]);
	});

	test("classifies short, medium, and long strums", () => {
		expect(strumDurationClass(1)).toBe("short");
		expect(strumDurationClass(2)).toBe("medium");
		expect(strumDurationClass(3)).toBe("long");
	});

	test("lays out strums on one, two, or four grid units", () => {
		expect(strumDurationUnits(1)).toBe(1);
		expect(strumDurationUnits(2)).toBe(2);
		expect(strumDurationUnits(3)).toBe(4);
		expect(strumDurationUnits(4)).toBe(4);
	});

	test("plays eighth-note slots at 120 BPM", () => {
		expect(strumSlotDurationMs()).toBe(250);
		expect(strumSlotDurationMs(300)).toBe(100);
	});
});
