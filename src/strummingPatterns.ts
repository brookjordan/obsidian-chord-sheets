export type StrumStep = "D" | "U" | "-" | "x";

export interface StrummingPattern {
	steps: StrumStep[];
	labels?: string[];
	bpm?: number;
	repeat?: number;
}

export interface DisplayStrum {
	step: Exclude<StrumStep, "-"> | "-";
	duration: number;
}

export const STRUMMING_BPM = 120;

const STRUM_PREFIX = /^strum:\s*/i;
const BEAT_PREFIX = /^beat:\s*/i;
const BPM_TOKEN = /\b(\d{2,3})\s*bpm\b/i;
let audioContext: AudioContext | null = null;
let stopActivePlayback: (() => void) | null = null;
let activePlaybackButton: HTMLButtonElement | null = null;

export function parseStrummingPattern(line: string): StrummingPattern | null {
	const bpm = parseBpm(line);
	const tokens = line
		.replace(BPM_TOKEN, "")
		.replace(STRUM_PREFIX, "")
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	const repeat = parseRepeatMarker(tokens[tokens.length - 1]);
	if (repeat !== null) {
		tokens.pop();
	}
	if (tokens.length < 2) {
		return null;
	}

	const steps: StrumStep[] = [];
	for (const token of tokens) {
		const step = normalizeStrumStep(token);
		if (!step) {
			return null;
		}
		steps.push(step);
	}
	if (
		!STRUM_PREFIX.test(line) &&
		repeat === null &&
		!steps.some((step) => step === "U" || step === "-" || step === "x")
	) {
		return null;
	}

	return {
		steps,
		...(bpm === null ? {} : { bpm }),
		...(repeat === null ? {} : { repeat }),
	};
}

export function parseBpm(line: string): number | null {
	const match = line.match(BPM_TOKEN);
	if (!match) {
		return null;
	}
	const bpm = Number(match[1]);
	return bpm >= 20 && bpm <= 400 ? bpm : null;
}

export function parseStandaloneBpm(line: string): number | null {
	return /^\s*\d{2,3}\s*bpm\s*$/i.test(line) ? parseBpm(line) : null;
}

export function parseRepeatMarker(token: string | undefined): number | null {
	const match = token?.match(/^(?:[x×](\d+)|(\d+)[x×])$/i);
	if (!match) {
		return null;
	}
	const repeat = Number(match[1] ?? match[2]);
	return Number.isSafeInteger(repeat) && repeat >= 2 ? repeat : null;
}

export function parseBeatLabels(line: string): string[] | null {
	const tokens = line
		.replace(BEAT_PREFIX, "")
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	if (tokens.length < 2 || !tokens.some((token) => /^\d+$/.test(token))) {
		return null;
	}
	if (!tokens.every((token) => /^\d+$|^[&ea]$/i.test(token))) {
		return null;
	}
	return tokens;
}

export function withBeatLabels(
	pattern: StrummingPattern,
	labels: string[] | null,
): StrummingPattern {
	return labels?.length === pattern.steps.length
		? { ...pattern, labels }
		: pattern;
}

export function withBpm(
	pattern: StrummingPattern,
	bpm: number | null,
): StrummingPattern {
	return pattern.bpm || bpm === null ? pattern : { ...pattern, bpm };
}

export function displayStrums(steps: StrumStep[]): DisplayStrum[] {
	const display: DisplayStrum[] = [];
	for (const step of steps) {
		if (step === "-" && display.length > 0) {
			display[display.length - 1].duration++;
		} else {
			display.push({ step, duration: 1 });
		}
	}
	return display;
}

export function strumDurationUnits(duration: number): number {
	return Math.max(1, duration);
}

export function strumDurationIsDotted(duration: number): boolean {
	return duration === 3;
}

export function renderStrummingPattern(pattern: StrummingPattern): HTMLElement {
	const container = document.createElement("div");
	container.className = "chord-sheet-strumming-pattern";
	const strums = displayStrums(pattern.steps);
	const totalUnits = strums.reduce(
		(total, strum) => total + strumDurationUnits(strum.duration),
		0,
	);
	container.style.setProperty("--strum-steps", `${totalUnits}`);

	if (pattern.labels) {
		const labels = document.createElement("div");
		labels.className = "chord-sheet-strumming-beats";
		for (const label of pattern.labels) {
			labels.appendChild(makeStrumCell(label));
		}
		container.appendChild(labels);
	}

	const steps = document.createElement("div");
	steps.className = "chord-sheet-strumming-steps";
	for (const [index, { step, duration }] of strums.entries()) {
		const units = strumDurationUnits(duration);
		const cell = makeStrumCell(
			strumStepSymbol(step),
			duration,
			index === strums.length - 1,
		);
		cell.classList.add(`chord-sheet-strum-${strumDurationClass(duration)}`);
		cell.style.setProperty("--strum-duration", `${units}`);
		steps.appendChild(cell);
	}
	if (pattern.repeat) {
		const repeat = document.createElement("div");
		repeat.className = "chord-sheet-strumming-repeat";
		repeat.textContent = `×${pattern.repeat}`;
		repeat.style.gridColumnStart = `${totalUnits + 1}`;
		steps.appendChild(repeat);
	}
	container.appendChild(steps);
	container.appendChild(
		makeStrummingPlaybackControls(pattern, () =>
			Array.from(
				container.querySelectorAll<HTMLElement>(
					".chord-sheet-strum-head",
				),
			),
		),
	);
	return container;
}

export function strumDurationClass(
	duration: number,
): "short" | "medium" | "long" {
	if (duration >= 4) {
		return "long";
	}
	return duration >= 2 ? "medium" : "short";
}

export function strumSlotDurationMs(bpm = STRUMMING_BPM): number {
	return 30_000 / bpm;
}

function normalizeBpm(bpm: number): number {
	return Number.isFinite(bpm)
		? Math.min(400, Math.max(20, Math.round(bpm)))
		: STRUMMING_BPM;
}

export function makeStrummingPlaybackControls(
	pattern: StrummingPattern,
	getStrokeElements: () => HTMLElement[],
): HTMLElement {
	const controls = document.createElement("span");
	controls.className = "chord-sheet-strumming-controls";
	const button = document.createElement("button");
	button.type = "button";
	button.className = "chord-sheet-strumming-play";
	button.textContent = "▶";
	const bpmInput = document.createElement("input");
	bpmInput.type = "number";
	bpmInput.className = "chord-sheet-strumming-bpm";
	bpmInput.min = "20";
	bpmInput.max = "400";
	bpmInput.step = "5";
	bpmInput.value = `${pattern.bpm ?? STRUMMING_BPM}`;
	bpmInput.setAttribute("aria-label", "Strumming tempo in BPM");
	const bpmLabel = document.createElement("span");
	bpmLabel.textContent = "BPM";
	controls.append(button, bpmInput, bpmLabel);
	let selectedBpm = normalizeBpm(Number(bpmInput.value));
	button.setAttribute(
		"aria-label",
		`Play strumming pattern at ${selectedBpm} BPM`,
	);

	let stopThisPlayback: (() => void) | null = null;
	let reschedulePlayback: (() => void) | null = null;
	const updateSelectedBpm = (nextBpm: number) => {
		if (nextBpm !== selectedBpm) {
			selectedBpm = nextBpm;
			reschedulePlayback?.();
		}
	};
	bpmInput.addEventListener("input", () => {
		const nextBpm = Number(bpmInput.value);
		if (
			Number.isFinite(nextBpm) &&
			nextBpm >= 20 &&
			nextBpm <= 400 &&
			nextBpm !== selectedBpm
		) {
			updateSelectedBpm(nextBpm);
		}
	});
	bpmInput.addEventListener("change", () => {
		const nextBpm = normalizeBpm(Number(bpmInput.value));
		bpmInput.value = `${nextBpm}`;
		updateSelectedBpm(nextBpm);
	});
	button.addEventListener("click", async () => {
		if (stopThisPlayback) {
			stopThisPlayback();
			return;
		}

		stopActivePlayback?.();
		const context = getAudioContext();
		await context.resume();

		const strums = displayStrums(pattern.steps).filter(
			(strum) => strum.step !== "-",
		);
		const strokeElements = getStrokeElements();
		const timers = new Set<number>();
		const sources = new Set<OscillatorNode>();
		selectedBpm = normalizeBpm(Number(bpmInput.value));
		bpmInput.value = `${selectedBpm}`;
		const totalSlots = strums.reduce(
			(total, strum) => total + strum.duration,
			0,
		);
		let stopped = false;
		let currentStrokeIndex = -1;
		let removalObserver: MutationObserver | null = null;
		let modeObserver: MutationObserver | null = null;

		button.textContent = "■";
		button.setAttribute("aria-label", "Stop strumming pattern");
		button.classList.add("is-playing");

		const clearScheduledPlayback = () => {
			for (const timer of timers) {
				window.clearTimeout(timer);
			}
			timers.clear();
			for (const source of sources) {
				try {
					source.stop();
				} catch {
					// The source has already ended.
				}
			}
			sources.clear();
			for (const element of strokeElements) {
				element.classList.remove("is-playing");
			}
		};

		const stop = () => {
			stopped = true;
			reschedulePlayback = null;
			removalObserver?.disconnect();
			removalObserver = null;
			modeObserver?.disconnect();
			modeObserver = null;
			clearScheduledPlayback();
			button.textContent = "▶";
			button.setAttribute(
				"aria-label",
				`Play strumming pattern at ${selectedBpm} BPM`,
			);
			button.classList.remove("is-playing");
			stopThisPlayback = null;
			if (stopActivePlayback === stop) {
				stopActivePlayback = null;
				activePlaybackButton = null;
			}
		};
		stopThisPlayback = stop;
		stopActivePlayback = stop;
		activePlaybackButton = button;
		removalObserver = new MutationObserver(() => {
			if (!button.isConnected) {
				stop();
			}
		});
		removalObserver.observe(document.body, {
			childList: true,
			subtree: true,
		});
		const leaf = button.closest<HTMLElement>(".workspace-leaf-content");
		const initialMode = leaf?.dataset.mode;
		if (leaf && initialMode) {
			modeObserver = new MutationObserver(() => {
				if (leaf.dataset.mode !== initialMode) {
					stop();
				}
			});
			modeObserver.observe(leaf, {
				attributes: true,
				attributeFilter: ["data-mode"],
			});
		}

		const scheduleTimer = (callback: () => void, delay: number) => {
			const timer = window.setTimeout(() => {
				timers.delete(timer);
				callback();
			}, delay);
			timers.add(timer);
		};

		const scheduleRound = (roundStart: number, startIndex: number) => {
			if (stopped) {
				return;
			}
			const roundDelay = Math.max(
				0,
				(roundStart - context.currentTime) * 1000,
			);
			const slotMs = strumSlotDurationMs(selectedBpm);
			let elapsedSlots = 0;

			for (let offset = 0; offset < strums.length; offset++) {
				const index = (startIndex + offset) % strums.length;
				const strum = strums[index];
				const offsetMs = elapsedSlots * slotMs;
				const source = playPercussion(
					context,
					roundStart + offsetMs / 1000,
					strum.step,
				);
				sources.add(source);
				source.addEventListener("ended", () => sources.delete(source), {
					once: true,
				});
				scheduleTimer(() => {
					currentStrokeIndex = index;
					strokeElements[index]?.classList.add("is-playing");
				}, roundDelay + offsetMs);
				scheduleTimer(
					() => {
						strokeElements[index]?.classList.remove("is-playing");
					},
					roundDelay + offsetMs + strum.duration * slotMs,
				);
				elapsedSlots += strum.duration;
			}

			const nextRound = roundStart + (totalSlots * slotMs) / 1000;
			scheduleTimer(
				() => scheduleRound(nextRound, startIndex),
				Math.max(0, roundDelay + totalSlots * slotMs - 100),
			);
		};

		if (strums.length === 0) {
			stop();
			return;
		}
		reschedulePlayback = () => {
			const nextStrokeIndex =
				currentStrokeIndex < 0
					? 0
					: (currentStrokeIndex + 1) % strums.length;
			clearScheduledPlayback();
			currentStrokeIndex = -1;
			scheduleRound(context.currentTime + 0.03, nextStrokeIndex);
		};
		scheduleRound(context.currentTime + 0.03, 0);
	});
	return controls;
}

export function stopStrummingPlaybackWithin(root: Node): void {
	if (activePlaybackButton && root.contains(activePlaybackButton)) {
		stopActivePlayback?.();
	}
}

function normalizeStrumStep(token: string): StrumStep | null {
	switch (token.toLowerCase()) {
		case "d":
		case "v":
		case "↓":
			return "D";
		case "u":
		case "^":
		case "↑":
			return "U";
		case "-":
			return "-";
		case "x":
		case "×":
			return "x";
		default:
			return null;
	}
}

function strumStepSymbol(step: StrumStep): string {
	if (step === "D") {
		return "↓";
	}
	if (step === "U") {
		return "↑";
	}
	if (step === "x") {
		return "×";
	}
	return step;
}

function makeStrumCell(
	value: string,
	duration?: number,
	terminal = false,
): HTMLElement {
	const cell = document.createElement("span");
	if (duration) {
		const head = document.createElement("span");
		head.className = "chord-sheet-strum-head";
		head.textContent = value;
		cell.appendChild(head);
		cell.appendChild(makeStrumTail(duration, 2, terminal));
	} else {
		cell.textContent = value;
	}
	return cell;
}

export function makeStrumTail(
	duration: number,
	charactersPerUnit = 1,
	terminal = false,
): SVGSVGElement {
	const units = strumDurationUnits(duration);
	const tailCharacters = units * charactersPerUnit;
	const width = tailCharacters * 20 + 10;
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", `0 0 ${width} 14`);
	svg.setAttribute("preserveAspectRatio", "none");
	svg.setAttribute("aria-hidden", "true");
	svg.classList.add("chord-sheet-strum-tail");
	svg.style.setProperty("--strum-tail-width", `${tailCharacters + 0.5}ch`);

	const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
	path.setAttribute(
		"d",
		terminal || duration >= 4
			? "M10 1V13"
			: duration >= 2
				? `M10 1V13H${width - 1}`
				: `M10 1V13H${width - 1}M10 8H${width - 1}`,
	);
	path.setAttribute("fill", "none");
	path.setAttribute("stroke", "currentColor");
	path.setAttribute("stroke-width", "2");
	path.setAttribute("vector-effect", "non-scaling-stroke");
	svg.appendChild(path);
	if (strumDurationIsDotted(duration) && !terminal) {
		const dot = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"path",
		);
		dot.setAttribute("d", "M20 3h0");
		dot.setAttribute("fill", "none");
		dot.setAttribute("stroke", "currentColor");
		dot.setAttribute("stroke-width", "3");
		dot.setAttribute("stroke-linecap", "round");
		dot.setAttribute("vector-effect", "non-scaling-stroke");
		svg.appendChild(dot);
	}
	return svg;
}

function getAudioContext(): AudioContext {
	audioContext ??= new AudioContext();
	return audioContext;
}

function playPercussion(
	context: AudioContext,
	when: number,
	step: DisplayStrum["step"],
): OscillatorNode {
	const oscillator = context.createOscillator();
	const gain = context.createGain();
	const frequency = step === "D" ? 150 : step === "U" ? 220 : 90;

	oscillator.type = step === "x" ? "square" : "triangle";
	oscillator.frequency.setValueAtTime(frequency, when);
	oscillator.frequency.exponentialRampToValueAtTime(
		Math.max(40, frequency / 2),
		when + 0.07,
	);
	gain.gain.setValueAtTime(0.12, when);
	gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.08);
	oscillator.connect(gain).connect(context.destination);
	oscillator.start(when);
	oscillator.stop(when + 0.08);
	return oscillator;
}
