import {
	parseBeatLabels,
	parseStandaloneBpm,
	parseStrummingPattern,
	StrummingPattern,
	withBeatLabels,
	withBpm,
} from "./strummingPatterns";
import { parseCapo } from "./capo";

export type ParsedStrummingBlockLine =
	| { type: "pattern"; pattern: StrummingPattern }
	| { type: "beat-labels" }
	| { type: "bpm"; bpm: number }
	| { type: "capo"; fret: number }
	| { type: "other" };

export function parseStrummingBlock(
	lines: readonly string[],
): ParsedStrummingBlockLine[] {
	const parsed: ParsedStrummingBlockLine[] = lines.map(() => ({
		type: "other",
	}));
	const blockBpm =
		lines
			.map(parseStandaloneBpm)
			.find((bpm): bpm is number => bpm !== null) ?? null;

	for (let index = 0; index < lines.length - 1; index++) {
		const labels = parseBeatLabels(lines[index]);
		if (!labels) {
			continue;
		}
		const pattern =
			parseStrummingPattern(lines[index + 1]) ??
			parseStrummingPattern(`Strum: ${lines[index + 1]}`);
		if (!pattern || pattern.steps.length !== labels.length) {
			continue;
		}
		parsed[index] = { type: "beat-labels" };
		parsed[index + 1] = {
			type: "pattern",
			pattern: withBeatLabels(withBpm(pattern, blockBpm), labels),
		};
		index++;
	}

	for (let index = 0; index < lines.length; index++) {
		if (parsed[index].type !== "other") {
			continue;
		}
		const pattern = parseStrummingPattern(lines[index]);
		if (pattern) {
			parsed[index] = {
				type: "pattern",
				pattern: withBpm(pattern, blockBpm),
			};
		}
	}

	if (parsed.some((line) => line.type === "pattern")) {
		for (let index = 0; index < lines.length; index++) {
			const bpm = parseStandaloneBpm(lines[index]);
			if (bpm !== null) {
				parsed[index] = { type: "bpm", bpm };
			}
		}
	}
	for (let index = 0; index < lines.length; index++) {
		const fret = parseCapo(lines[index]);
		if (fret !== null) {
			parsed[index] = { type: "capo", fret };
		}
	}
	return parsed;
}
