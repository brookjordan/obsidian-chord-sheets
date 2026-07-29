import { EditorView, WidgetType } from "@codemirror/view";
import {
	chordSequenceString,
	Instrument,
	uniqueChordTokens,
} from "../chordsUtils";
import {
	ChordPositionSelections,
	makeChordOverview,
} from "../chordDiagrams";

import { ChordToken } from "../sheet-parsing/tokens";

export class ChordOverviewWidget extends WidgetType {
	private readonly chordSequenceString: string;
	public readonly uniqueChordTokens: ChordToken[];

	constructor(
		private instrument: Instrument,
		private diagramWidth: number,
		private useChromaticChordColors: boolean,
		private positionSelections: ChordPositionSelections,
		chordTokens: ChordToken[],
	) {
		super();
		this.uniqueChordTokens = uniqueChordTokens(chordTokens);
		this.chordSequenceString = chordSequenceString(this.uniqueChordTokens);
	}

	get estimatedHeight(): number {
		return 300;
	}

	ignoreEvent(event: Event): boolean {
		return event.type !== "mousemove";
	}

	eq(other: ChordOverviewWidget): boolean {
		return (
			this.instrument === other.instrument &&
			this.diagramWidth === other.diagramWidth &&
			this.useChromaticChordColors === other.useChromaticChordColors &&
			this.uniqueChordTokens.length === other.uniqueChordTokens.length &&
			this.uniqueChordTokens.every(
				(value, index) => value === other.uniqueChordTokens[index],
			)
		);
	}

	updateDOM(dom: HTMLElement, view: EditorView): boolean {
		const chordOverview = this.getChordOverviewEl(dom);
		const {
			chordSequence: previousChordSequence,
			instrument: previousInstrument,
			diagramWidth: previousDiagramWidth,
			chromaticChordColors: previousChromaticChordColors,
		} = chordOverview.dataset;

		const previousDiagramWidthInt = previousDiagramWidth
			? parseInt(previousDiagramWidth)
			: 0;
		if (
			this.chordSequenceString !== previousChordSequence ||
			this.instrument !== previousInstrument ||
			this.diagramWidth !== previousDiagramWidthInt ||
			`${this.useChromaticChordColors}` !== previousChromaticChordColors
		) {
			this.updateChordOverview(chordOverview);
			view.requestMeasure();
		}

		return true;
	}

	toDOM(view: EditorView): HTMLElement {
		const el = Object.assign(document.createElement("div"), {
			className: "chord-sheet-chord-overview-container",
		});
		const chordOverviewEl = Object.assign(document.createElement("div"), {
			className: "chord-sheet-chord-overview chord-sheet-preview-mode",
		});
		el.append(chordOverviewEl);

		this.updateChordOverview(chordOverviewEl);
		view.requestMeasure();
		return el;
	}

	private updateChordOverview(
		chordOverview: HTMLElement,
		instrument: Instrument = this.instrument,
	) {
		chordOverview.replaceChildren();
		makeChordOverview(
			instrument,
			chordOverview,
			this.uniqueChordTokens,
			this.diagramWidth,
			this.useChromaticChordColors,
			this.positionSelections,
		);
	}

	private getChordOverviewEl(el: HTMLElement): HTMLElement {
		return el.querySelector(".chord-sheet-chord-overview")!;
	}
}
