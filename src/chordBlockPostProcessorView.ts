import { MarkdownRenderChild } from "obsidian";
import {
	chromaticNoteColor,
	Instrument,
	uniqueChordTokens,
} from "./chordsUtils";
import tippy from "tippy.js/headless";
import { makeChordDiagram, makeChordOverview } from "./chordDiagrams";
import { ChordSheetsSettings } from "./chordSheetsSettings";

import {
	ChordToken,
	isChordToken,
	isHeaderToken,
	isMarkerToken,
	isRhythmToken,
} from "./sheet-parsing/tokens";
import { tokenizeLine } from "./sheet-parsing/tokenizeLine";
import {
	parseBeatLabels,
	parseRepeatMarker,
	parseStandaloneBpm,
	parseStrummingPattern,
	renderStrummingPattern,
	stopStrummingPlaybackWithin,
	withBeatLabels,
	withBpm,
} from "./strummingPatterns";

export class ChordBlockPostProcessorView extends MarkdownRenderChild {
	source: string;
	private readonly positionSelections = new Map<string, number>();

	constructor(
		containerEl: HTMLElement,
		private instrument: Instrument,
		private settings: ChordSheetsSettings,
	) {
		super(containerEl);
	}

	async onload() {
		const codeEl = this.containerEl.getElementsByTagName("code").item(0);
		if (codeEl) {
			this.source = codeEl.innerText;
		}

		this.render();
	}

	onunload() {
		stopStrummingPlaybackWithin(this.containerEl);
	}

	private render() {
		const {
			chordLineMarker,
			textLineMarker,
			showChordDiagramsOnHover,
			showChordOverview,
			diagramWidth,
			highlightChords,
			useChromaticChordColors,
			highlightSectionHeaders,
			sectionHeaderFont,
			highlightRhythmMarkers,
			showLineMarkersInReadingMode,
		} = this.settings;

		stopStrummingPlaybackWithin(this.containerEl);
		if (this.containerEl.children.length > 0) {
			this.containerEl.empty();
		}

		const codeEl = this.containerEl.createEl("code", {
			cls: "chord-sheet-chord-block-preview",
		});

		const chordTokens: ChordToken[] = [];
		const lines = this.source.split("\n");
		const hasStrummingPattern = lines.some(
			(line) => parseStrummingPattern(line) !== null,
		);
		const blockBpm = hasStrummingPattern
			? (lines
					.map(parseStandaloneBpm)
					.find((bpm): bpm is number => bpm !== null) ?? null)
			: null;
		let currentIndex = 0;
		for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
			const line = lines[lineNumber];
			if (hasStrummingPattern && parseStandaloneBpm(line) !== null) {
				currentIndex += line.length + 1;
				continue;
			}
			const lineDiv = codeEl.createDiv({
				cls: "chord-sheet-chord-line",
			});
			const parsedPattern = parseStrummingPattern(line);
			const pattern = parsedPattern
				? withBpm(parsedPattern, blockBpm)
				: null;
			const parsedNextPattern = parseStrummingPattern(
				lines[lineNumber + 1] ?? "",
			);
			const nextPattern = parsedNextPattern
				? withBpm(parsedNextPattern, blockBpm)
				: null;
			const beatLabels = parseBeatLabels(line);

			if (beatLabels && nextPattern) {
				lineDiv.appendChild(
					renderStrummingPattern(
						withBeatLabels(nextPattern, beatLabels),
					),
				);
				currentIndex += line.length + lines[lineNumber + 1].length + 2;
				lineNumber++;
				continue;
			}
			if (pattern) {
				lineDiv.appendChild(renderStrummingPattern(pattern));
				currentIndex += line.length + 1;
				continue;
			}

			const tokenizedLine = tokenizeLine(
				line,
				currentIndex,
				chordLineMarker,
				textLineMarker,
				this.settings.autoDetectSectionHeaders,
			);
			const lineTokens = line.trimEnd().split(/\s+/);
			const terminalToken = lineTokens[lineTokens.length - 1];
			const repeat = tokenizedLine.isChordLine
				? parseRepeatMarker(terminalToken)
				: null;
			const displayTokenValue = (value: string) =>
				repeat !== null && value === terminalToken
					? `×${repeat}`
					: value;

			for (let i = 0; i < tokenizedLine.tokens.length; i++) {
				const token = tokenizedLine.tokens[i];

				if (isChordToken(token)) {
					chordTokens.push(token);

					let nextToken = tokenizedLine.tokens[i + 1];
					const isTokenPair =
						this.settings.displayInlineChordsOverLyrics &&
						token.inlineChord &&
						(!nextToken ||
							nextToken?.type === "word" ||
							nextToken?.type === "whitespace" ||
							isChordToken(nextToken));

					const pairSpan = isTokenPair
						? lineDiv.createSpan({
								cls: "chord-sheet-chord-text-pair",
							})
						: null;

					const chordSpan = (pairSpan ?? lineDiv).createSpan({
						cls: "chord-sheet-chord",
					});

					if (token.inlineChord) {
						if (isTokenPair) {
							lineDiv.addClass("chord-sheet-inline-over-lyrics");
						}
						chordSpan.createSpan({
							cls: `chord-sheet-inline-chord-bracket`,
							text: token.inlineChord.openingBracket.value,
						});
					}

					const chordName = chordSpan.createSpan({
						cls: `chord-sheet-chord-name${highlightChords ? " chord-sheet-chord-highlight" : ""}`,
						text: token.chordSymbol.value,
					});
					const noteColor = useChromaticChordColors
						? chromaticNoteColor(token.chord.tonic)
						: null;
					if (noteColor) {
						chordName.style.setProperty(
							"--chord-note-color",
							noteColor,
						);
					}

					if (token.userDefinedChord) {
						const userDefinedChord = token.userDefinedChord;

						chordSpan.createSpan({
							cls: "chord-sheet-user-defined-chord-bracket",
							text: userDefinedChord.openingBracket.value,
						});
						userDefinedChord.position &&
							chordSpan.createSpan({
								cls: "chord-sheet-user-defined-chord-position",
								text: userDefinedChord.position.value,
							});
						userDefinedChord.positionSeparator &&
							chordSpan.createSpan({
								cls: "chord-sheet-user-defined-chord-position-separator",
								text: userDefinedChord.positionSeparator.value,
							});
						chordSpan.createSpan({
							cls: "chord-sheet-user-defined-chord-frets",
							text: userDefinedChord.frets.value,
						});
						chordSpan.createSpan({
							cls: "chord-sheet-user-defined-chord-bracket",
							text: userDefinedChord.closingBracket.value,
						});
					}

					if (token.inlineChord) {
						if (token.inlineChord.auxText) {
							chordSpan.createSpan({
								cls: `chord-sheet-inline-chord-aux-text`,
								text: token.inlineChord.auxText.value,
							});
						}
						chordSpan.createSpan({
							cls: `chord-sheet-inline-chord-bracket`,
							text: token.inlineChord.closingBracket.value,
						});

						const trailingSpan = pairSpan?.createSpan({
							cls: `chord-sheet-inline-chord-trailing-text`,
						});

						if (trailingSpan) {
							// fast-forward until the next chord token
							while (nextToken && !isChordToken(nextToken)) {
								if (isMarkerToken(nextToken)) {
									if (showLineMarkersInReadingMode) {
										trailingSpan.createSpan({
											cls: `chord-sheet-line-marker`,
											text: nextToken.value,
										});
									}
								} else {
									trailingSpan.createSpan({
										cls: `chord-sheet-${nextToken.type}`,
										text: displayTokenValue(
											nextToken.value,
										),
									});
								}
								i++;
								nextToken = tokenizedLine.tokens[i + 1];
							}
						}
					}

					if (
						showChordDiagramsOnHover === "always" ||
						showChordDiagramsOnHover === "preview"
					) {
						this.attachChordDiagram(token, chordSpan);
					}
				} else if (highlightRhythmMarkers && isRhythmToken(token)) {
					lineDiv.createSpan({
						cls: `chord-sheet-rhythm-marker`,
						text: token.value,
					});
				} else if (isMarkerToken(token)) {
					if (showLineMarkersInReadingMode) {
						lineDiv.createSpan({
							cls: `chord-sheet-line-marker`,
							text: token.value,
						});
					}
				} else if (highlightSectionHeaders && isHeaderToken(token)) {
					lineDiv.addClass("chord-sheet-section-header");
					if (sectionHeaderFont !== "mono") {
						lineDiv.addClass(
							`chord-sheet-section-header-font-${sectionHeaderFont}`,
						);
					}
					const headerSpan = lineDiv.createSpan({
						cls: "chord-sheet-section-header-content",
					});
					if (token.bracketed) {
						headerSpan.createSpan({
							cls: `chord-sheet-section-header-bracket`,
							text: token.openingBracket.value,
						});
					}
					headerSpan.createSpan({
						cls: `chord-sheet-section-header-name cm-strong`,
						text: token.headerName.value,
					});
					if (token.bracketed) {
						headerSpan.createSpan({
							cls: `chord-sheet-section-header-bracket`,
							text: token.closingBracket.value,
						});
					}
				} else {
					lineDiv.append(displayTokenValue(token.value));
				}
			}

			currentIndex += line.length + 1;
		}

		if (showChordOverview === "always" || showChordOverview === "preview") {
			const uniqueTokens = uniqueChordTokens(chordTokens);
			const overviewContainerEl = createDiv({
				cls: "chord-sheet-chord-overview-container",
			});
			const overviewEl = overviewContainerEl.createDiv({
				cls: "chord-sheet-chord-overview",
			});
			makeChordOverview(
				this.instrument,
				overviewEl,
				uniqueTokens,
				diagramWidth,
				useChromaticChordColors,
				this.positionSelections,
			);
			this.containerEl.prepend(overviewContainerEl);
		}
	}

	private attachChordDiagram(token: ChordToken, tokenEl: HTMLElement) {
		const popper = document.createElement("div");
		const { instrument, settings } = this;
		const { diagramWidth, useChromaticChordColors } = settings;

		popper.classList.add("chord-sheet-chord-popup");

		// noinspection JSUnusedGlobalSymbols
		tippy(tokenEl, {
			interactive: true,
			render() {
				return { popper };
			},
			onShow(instance) {
				instance.popper.appendChild(
					makeChordDiagram(
						instrument,
						token,
						diagramWidth,
						0,
						useChromaticChordColors,
						this.positionSelections,
					),
				);
			},
			onHidden(instance) {
				instance.popper.empty();
			},
		});
	}
}
