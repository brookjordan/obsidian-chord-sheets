import { WidgetType } from "@codemirror/view";
import {
	makeStrummingPlaybackControls,
	stopStrummingPlaybackWithin,
	StrummingPattern,
} from "../strummingPatterns";

export class StrummingPlayWidget extends WidgetType {
	constructor(private pattern: StrummingPattern) {
		super();
	}

	eq(other: StrummingPlayWidget): boolean {
		return JSON.stringify(this.pattern) === JSON.stringify(other.pattern);
	}

	ignoreEvent(): boolean {
		return true;
	}

	destroy(dom: HTMLElement): void {
		stopStrummingPlaybackWithin(dom);
	}

	toDOM(): HTMLElement {
		let controls: HTMLElement;
		controls = makeStrummingPlaybackControls(this.pattern, () =>
			Array.from(
				controls
					.closest(".cm-line")
					?.querySelectorAll<HTMLElement>(
						".chord-sheet-strum-step",
					) ?? [],
			),
		);
		return controls;
	}
}
