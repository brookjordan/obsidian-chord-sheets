import { WidgetType } from "@codemirror/view";
import { makeStrumTail } from "../strummingPatterns";

export class StrumTailWidget extends WidgetType {
	constructor(
		private duration: number,
		private terminal = false,
	) {
		super();
	}

	eq(other: StrumTailWidget): boolean {
		return (
			this.duration === other.duration && this.terminal === other.terminal
		);
	}

	ignoreEvent(): boolean {
		return true;
	}

	toDOM(): HTMLElement {
		const anchor = document.createElement("span");
		anchor.className = "chord-sheet-strum-tail-anchor";
		anchor.appendChild(makeStrumTail(this.duration, 2, this.terminal));
		return anchor;
	}
}
