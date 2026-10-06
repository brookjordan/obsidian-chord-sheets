import {
	chromaticNoteColor,
	chordSequenceString,
	Instrument,
	UserDefinedChord,
} from "./chordsUtils";
import { INSTRUMENTS } from "./instruments";
import { ChordBox } from "@chordbook/charts";
import { ChordDef, generateChord } from "./chordGenerator";
import { ChordToken } from "./sheet-parsing/tokens";
import { CapoSelection } from "./capoControls";
import { playChordPosition, soundingChordName } from "./chordAudio";

type ChordBoxParams = Parameters<ChordBox["draw"]>[0];
export type ChordPositionSelections = Map<string, number>;

export function dbChordToVexChord(
	input: ChordDef,
	positionIndex = 0,
): ChordBoxParams {
	const position = input.positions[positionIndex];
	if (!position) {
		throw new RangeError(`Chord position ${positionIndex} is unavailable`);
	}
	const fingers = [...position.fingers].reverse();
	const frets = [...position.frets].reverse();

	const barres: ChordBoxParams["barres"] = [];
	(position.barres ?? []).forEach((barreFret) => {
		const toString = frets.indexOf(barreFret) + 1;
		const fromString = frets.lastIndexOf(barreFret) + 1;

		if (fromString > 0 && toString > 0) {
			barres.push({ fromString, toString, fret: barreFret });
		}
	});

	const chord = frets
		.map(
			(fret, index) =>
				[index + 1, fret === -1 ? "x" : fret] as [number, number],
		)
		.filter((c) => !barres.some((barre) => c[1] === barre.fret));
	return {
		chord,
		position: position.baseFret,
		barres,
		// abuse tuning labels for fingering
		tuning: [...fingers]
			.reverse()
			.map((finger) => (finger > 0 ? `${finger}` : "")),
	};
}

export function userDefinedToVexChord(
	{ frets, position }: UserDefinedChord,
	numStrings: number,
	defaultNumFrets: number = 4,
): ChordBoxParams & { numFrets: number } {
	const splitFrets = /[\s,]/.test(frets)
		? frets.match(/\d+|x|_/g)
		: frets.split("");

	if (!splitFrets) {
		throw new Error("Could not parse fret string: " + frets);
	}
	const stringFrets = splitFrets.filter((fretSymbol) => fretSymbol !== "_");
	if (stringFrets.length !== numStrings) {
		throw new RangeError(
			`Expected ${numStrings} string frets, received ${stringFrets.length}`,
		);
	}
	if (
		!stringFrets.every(
			(fretSymbol) => fretSymbol === "x" || /^\d+$/.test(fretSymbol),
		)
	) {
		throw new Error(
			"Fret strings may only contain x or non-negative integers",
		);
	}

	const barres: ChordBoxParams["barres"] = [];

	const barrePositions = splitFrets
		.map((fret, index) => (fret === "_" ? index : -1))
		.filter((index) => index !== -1);

	if (barrePositions.length === 2 || barrePositions.length === 4) {
		barres.push({
			fromString: numStrings - barrePositions[0],
			toString: numStrings - barrePositions[1] + 2,
			fret: parseBarreFret(splitFrets, barrePositions[0]),
		});
	}
	if (barrePositions.length === 4) {
		barres.push({
			fromString: numStrings - barrePositions[2] + 2,
			toString: numStrings - barrePositions[3] + 4,
			fret: parseBarreFret(splitFrets, barrePositions[2]),
		});
	}

	// map frets to chord array, skip barre markers
	let chordFrets = stringFrets.map((fret, index) => [
		numStrings - index,
		fret === "x" ? "x" : parseInt(fret),
	]);

	// determine optimal fret position
	let finalPosition = position;
	if (position === 0) {
		const originalFrets = chordFrets
			.map((fretDef) => fretDef[1])
			.filter(
				(fret) => typeof fret === "number" && !isNaN(fret),
			) as number[];

		const nonOpenFrets = originalFrets.filter((fret) => fret > 0);
		if (nonOpenFrets.length > 0) {
			const minFret = Math.min(...nonOpenFrets);
			const maxFret = Math.max(...nonOpenFrets);
			const fretSpan = maxFret - minFret + 1;

			// if chord spans more than available frets, or starts above fret 3 (treat low frets with muted strings like open chords)
			if (fretSpan > defaultNumFrets || minFret > 3) {
				// position at minFret to show the most compact view
				finalPosition = minFret;
				chordFrets = chordFrets.map((fretDef) =>
					typeof fretDef[1] === "number" && fretDef[1] > 0
						? [fretDef[0], fretDef[1] - finalPosition + 1]
						: fretDef,
				);
				for (const barre of barres) {
					barre.fret = barre.fret - finalPosition + 1;
				}
			}
			// else: position remains 0
		}
	}

	const finalFrets = chordFrets
		.map((fretDef) => fretDef[1])
		.filter((fret) => typeof fret === "number" && !isNaN(fret)) as number[];

	const numFrets =
		finalFrets.length > 0
			? Math.max(defaultNumFrets, Math.max(...finalFrets))
			: defaultNumFrets;

	return {
		// @ts-ignore
		chord: chordFrets,
		position: finalPosition,
		barres,
		numFrets,
		// empty string labels so spacing is equal to non-custom chords with string labels
		tuning: new Array(numStrings).fill(""),
	};
}

function parseBarreFret(splitFrets: string[], markerIndex: number): number {
	const fret = Number(splitFrets[markerIndex + 1]);
	if (!Number.isInteger(fret) || fret < 1) {
		throw new Error("A barre marker must be followed by a fretted string");
	}
	return fret;
}

export function renderChordDiagram({
	containerEl,
	userDefinedChord,
	chordDef,
	numPositions,
	position,
	numStrings,
	numFrets,
	chordName,
	chordColor,
	width,
	capoSelection,
}: {
	containerEl: HTMLElement;
	userDefinedChord: UserDefinedChord | undefined;
	chordDef: ChordDef;
	numPositions: number;
	position: number;
	numStrings: number;
	numFrets: number;
	chordName: string;
	chordColor: string | null;
	width: number;
	capoSelection?: CapoSelection;
}) {
	const box = containerEl.querySelector(".chord-sheet-chord-box");
	if (!box) {
		return;
	}

	box.replaceChildren();

	box.appendChild(
		makeChordNameEl(chordName, chordColor, capoSelection?.fret ?? 0),
	);

	const chordDiagram = document.createElement("div");
	box.appendChild(chordDiagram);

	const vexChord = userDefinedChord
		? userDefinedToVexChord(userDefinedChord, numStrings, numFrets)
		: dbChordToVexChord(chordDef, position);

	makeChordBox(chordDiagram, numStrings, numFrets, width).draw(vexChord);

	updateChordPosition(containerEl, numPositions, position);
}

function makeChordNameEl(
	chordName: string,
	chordColor: string | null,
	capo = 0,
) {
	const chordNameEl = document.createElement("div");
	chordNameEl.classList.add(
		"chord-sheet-chord-name",
		"chord-sheet-chord-highlight",
	);
	const writtenChord = document.createElement("span");
	writtenChord.textContent = chordName;
	chordNameEl.appendChild(writtenChord);
	updateSoundingChordName(chordNameEl, chordName, capo);
	if (chordColor) {
		chordNameEl.style.setProperty("--chord-note-color", chordColor);
	}
	return chordNameEl;
}

function updateSoundingChordName(
	chordNameEl: HTMLElement,
	chordName: string,
	capo: number,
): void {
	chordNameEl.querySelector(".chord-sheet-sounding-chord")?.remove();
	if (capo === 0) {
		return;
	}
	const sounding = document.createElement("span");
	sounding.className = "chord-sheet-sounding-chord";
	sounding.textContent = soundingChordName(chordName, capo);
	chordNameEl.appendChild(sounding);
}

function makeChordBox(
	containerEl: HTMLElement,
	numStrings: number,
	numFrets: number,
	width: number,
	defaultColor = "var(--text-normal)",
) {
	return new ChordBox(containerEl, {
		numStrings: numStrings,
		numFrets: numFrets,
		showTuning: true,
		defaultColor: defaultColor,
		fontFamily: "var(--font-text)",
		width: width,
		height: width * 1.2,
	});
}

function renderMissingDiagramNotice(
	box: HTMLElement,
	chordName: string,
	numStrings: number,
	numFrets: number,
	width: number,
	chordColor: string | null,
	capo = 0,
) {
	const emptyFretboardEl = document.createElement("div");
	emptyFretboardEl.classList.add("chord-sheet-no-diagram");
	const fretboard = makeChordBox(
		emptyFretboardEl,
		numStrings,
		numFrets,
		width,
		"var(--text-faint)",
	);
	fretboard.draw({ chord: [], tuning: new Array(numStrings).fill("") });

	const gridCenterX =
		fretboard.x + (fretboard.spacing * (fretboard.numStrings - 1)) / 2;
	const gridCenterY =
		fretboard.y + (fretboard.fretSpacing * fretboard.numFrets) / 2;
	fretboard.canvas
		.plain("?")
		.attr({ x: gridCenterX, y: gridCenterY })
		.addClass("chord-sheet-no-diagram-mark");

	emptyFretboardEl.setAttribute(
		"aria-label",
		`No diagram found for ${chordName}`,
	);
	emptyFretboardEl.setAttribute("data-tooltip-position", "top");

	box.append(makeChordNameEl(chordName, chordColor, capo), emptyFretboardEl);
}

function updateChordPosition(
	containerEl: HTMLElement,
	numPositions: number,
	position: number,
) {
	const positionEl = containerEl.querySelector(".chord-sheet-position");
	const prevBtn = containerEl.querySelector(".chord-sheet-btn-prev-position");
	const nextBtn = containerEl.querySelector(".chord-sheet-btn-next-position");

	if (positionEl && prevBtn && nextBtn) {
		positionEl.textContent = `${position + 1}`;
		if (position < numPositions - 1) {
			nextBtn.addClass("chord-sheet-pos-btn-enabled");
		} else {
			nextBtn.removeClass("chord-sheet-pos-btn-enabled");
		}

		if (position > 0) {
			prevBtn.addClass("chord-sheet-pos-btn-enabled");
		} else {
			prevBtn.removeClass("chord-sheet-pos-btn-enabled");
		}
	}
}

function makeChevron(direction: "left" | "right"): SVGSVGElement {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("fill", "none");
	svg.setAttribute("stroke", "currentColor");
	svg.setAttribute("stroke-width", "3.5");
	svg.setAttribute("stroke-linecap", "round");
	svg.setAttribute("stroke-linejoin", "round");
	svg.setAttribute("aria-hidden", "true");

	const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
	path.setAttribute(
		"d",
		direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6",
	);
	svg.appendChild(path);
	return svg;
}

export function makeChordDiagram(
	instrument: Instrument,
	chordToken: ChordToken,
	width = 100,
	position = 0,
	useChromaticChordColors = true,
	positionSelections?: ChordPositionSelections,
	capoSelection?: CapoSelection,
) {
	const containerEl = document.createElement("div");
	containerEl.addClass("chord-sheet-chord-diagram");
	const chordBox: HTMLDivElement = document.createElement("div");
	chordBox.addClass("chord-sheet-chord-box");
	containerEl.appendChild(chordBox);
	capoSelection?.events.addEventListener("change", () => {
		const chordNameEl = chordBox.querySelector<HTMLElement>(
			".chord-sheet-chord-name",
		);
		if (chordNameEl) {
			updateSoundingChordName(
				chordNameEl,
				chordToken.chordSymbol.value,
				capoSelection.fret,
			);
		}
	});

	const instrumentConfig = INSTRUMENTS[instrument];
	const numStrings = instrumentConfig.strings;
	const numFrets = instrumentConfig.fretsOnChord;
	const chordColor = useChromaticChordColors
		? chromaticNoteColor(chordToken.chord.tonic)
		: null;

	if (chordToken.chord.userDefinedChord !== undefined) {
		const vexChord = userDefinedToVexChord(
			chordToken.chord.userDefinedChord,
			numStrings,
			numFrets,
		);

		renderChordDiagram({
			containerEl: containerEl,
			userDefinedChord: chordToken.chord.userDefinedChord,
			chordDef: { key: "", suffix: "", positions: [] },
			numPositions: 1,
			position: vexChord.position ?? 1,
			numStrings: numStrings,
			numFrets: vexChord.numFrets,
			chordName: chordToken.chordSymbol.value,
			chordColor,
			width: width,
			capoSelection,
		});
	} else {
		const generatedChord = generateChord(chordToken, instrument);
		if (!generatedChord) {
			renderMissingDiagramNotice(
				chordBox,
				chordToken.chordSymbol.value,
				numStrings,
				numFrets,
				width,
				chordColor,
				capoSelection?.fret ?? 0,
			);
			return containerEl;
		}

		const numPositions = generatedChord.positions.length;
		const savedPosition = positionSelections?.get(
			chordToken.chordSymbol.value,
		);
		let currentPosition = Math.min(
			Math.max(savedPosition ?? position, 0),
			numPositions - 1,
		);
		chordBox.addClass("chord-sheet-chord-audition");
		chordBox.tabIndex = 0;
		chordBox.setAttribute("role", "button");
		chordBox.setAttribute(
			"aria-label",
			`Play ${chordToken.chordSymbol.value}`,
		);
		const playCurrentPosition = () => {
			void playChordPosition(
				instrument,
				generatedChord.positions[currentPosition],
				capoSelection?.fret ?? 0,
			);
		};
		chordBox.addEventListener("click", playCurrentPosition);
		chordBox.addEventListener("keydown", (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				playCurrentPosition();
			}
		});
		if (numPositions > 0) {
			const positionChooser = Object.assign(
				document.createElement("div"),
				{
					className: "chord-sheet-position-chooser",
				},
			);

			const positionLabelSpan = Object.assign(
				document.createElement("span"),
				{
					className: "chord-sheet-position-label",
				},
			);

			const prevPositionSpan = Object.assign(
				document.createElement("span"),
				{
					className: "chord-sheet-btn-prev-position",
					ariaLabel: "Previous fingering",
				},
			);
			prevPositionSpan.appendChild(makeChevron("left"));

			const positionSpan = Object.assign(document.createElement("span"), {
				className: "chord-sheet-position",
			});
			const numPositionSpan = Object.assign(
				document.createElement("span"),
				{
					textContent: `/${numPositions}`,
				},
			);
			positionLabelSpan.append(positionSpan, numPositionSpan);

			const nextPositionSpan = Object.assign(
				document.createElement("span"),
				{
					className: "chord-sheet-btn-next-position",
					ariaLabel: "Next fingering",
				},
			);
			nextPositionSpan.appendChild(makeChevron("right"));

			positionChooser.append(
				prevPositionSpan,
				positionLabelSpan,
				nextPositionSpan,
			);
			containerEl.appendChild(positionChooser);

			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const nextPositionButton = positionChooser.querySelector(
				".chord-sheet-btn-next-position",
			)!;
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const prevPositionButton = positionChooser.querySelector(
				".chord-sheet-btn-prev-position",
			)!;

			nextPositionButton.addEventListener("click", () => {
				if (currentPosition < numPositions - 1) {
					currentPosition++;
					positionSelections?.set(
						chordToken.chordSymbol.value,
						currentPosition,
					);
					renderChordDiagram({
						containerEl: containerEl,
						userDefinedChord: undefined,
						chordDef: generatedChord,
						numPositions: numPositions,
						position: currentPosition,
						numStrings: numStrings,
						numFrets: numFrets,
						chordName: chordToken.chordSymbol.value,
						chordColor,
						width: width,
						capoSelection,
					});
				}
			});
			prevPositionButton.addEventListener("click", () => {
				if (currentPosition > 0) {
					currentPosition--;
					positionSelections?.set(
						chordToken.chordSymbol.value,
						currentPosition,
					);
					renderChordDiagram({
						containerEl: containerEl,
						userDefinedChord: undefined,
						chordDef: generatedChord,
						numPositions: numPositions,
						position: currentPosition,
						numStrings: numStrings,
						numFrets: numFrets,
						chordName: chordToken.chordSymbol.value,
						chordColor,
						width: width,
						capoSelection,
					});
				}
			});
		}

		renderChordDiagram({
			containerEl: containerEl,
			userDefinedChord: undefined,
			chordDef: generatedChord,
			numPositions: numPositions,
			position: currentPosition,
			numStrings: numStrings,
			numFrets: numFrets,
			chordName: chordToken.chordSymbol.value,
			chordColor,
			width: width,
			capoSelection,
		});
	}

	return containerEl;
}

export function makeChordOverview(
	instrument: Instrument,
	container: HTMLElement,
	chordTokens: ChordToken[],
	width?: number,
	useChromaticChordColors = true,
	positionSelections?: ChordPositionSelections,
	capoSelection?: CapoSelection,
) {
	for (const chordToken of chordTokens) {
		container.appendChild(
			makeChordDiagram(
				instrument,
				chordToken,
				width,
				0,
				useChromaticChordColors,
				positionSelections,
				capoSelection,
			),
		);
	}
	container.dataset.chordSequence = chordSequenceString(chordTokens);
	container.dataset.instrument = instrument;
	container.dataset.diagramWidth = `${width}`;
	container.dataset.chromaticChordColors = `${useChromaticChordColors}`;
	container.dataset.capoFret = `${capoSelection?.sourceFret ?? ""}`;
}
