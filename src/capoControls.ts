import { MAX_CAPO_FRET } from "./capo";

export interface CapoSelection {
	fret: number;
	sourceFret: number | null;
	events: EventTarget;
}

export function makeCapoSelection(
	sourceFret: number | null,
	existing?: CapoSelection,
): CapoSelection {
	if (existing?.sourceFret === sourceFret) {
		return existing;
	}
	return { fret: sourceFret ?? 0, sourceFret, events: new EventTarget() };
}

export function makeCapoControls(selection: CapoSelection): HTMLElement {
	const controls = document.createElement("span");
	controls.className = "chord-sheet-capo-controls";
	controls.setAttribute("aria-label", "Capo position");
	controls.appendChild(makeCapoIcon());

	const decrement = makeButton("−", "Lower capo");
	const input = document.createElement("input");
	input.type = "number";
	input.className = "chord-sheet-capo-fret";
	input.min = "0";
	input.max = `${MAX_CAPO_FRET}`;
	input.step = "1";
	input.value = `${selection.fret}`;
	input.setAttribute("aria-label", "Capo fret");
	const increment = makeButton("+", "Raise capo");

	const update = (fret: number) => {
		const nextFret = Math.min(MAX_CAPO_FRET, Math.max(0, Math.round(fret)));
		if (nextFret !== selection.fret) {
			selection.fret = nextFret;
			selection.events.dispatchEvent(new Event("change"));
		}
		input.value = `${selection.fret}`;
	};
	decrement.addEventListener("click", () => update(selection.fret - 1));
	increment.addEventListener("click", () => update(selection.fret + 1));
	input.addEventListener("input", () => {
		const fret = Number(input.value);
		if (
			input.value !== "" &&
			Number.isFinite(fret) &&
			fret >= 0 &&
			fret <= MAX_CAPO_FRET
		) {
			const nextFret = Math.round(fret);
			if (nextFret !== selection.fret) {
				selection.fret = nextFret;
				selection.events.dispatchEvent(new Event("change"));
			}
		}
	});
	input.addEventListener("change", () => update(Number(input.value)));

	controls.append(decrement, input, increment);
	return controls;
}

function makeButton(text: string, label: string): HTMLButtonElement {
	const button = document.createElement("button");
	button.type = "button";
	button.textContent = text;
	button.setAttribute("aria-label", label);
	return button;
}

function makeCapoIcon(): SVGSVGElement {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.classList.add("chord-sheet-capo-icon");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("fill", "none");
	svg.setAttribute("stroke", "currentColor");
	svg.setAttribute("stroke-width", "2");
	svg.setAttribute("stroke-linecap", "round");
	svg.setAttribute("aria-hidden", "true");
	const strings = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"path",
	);
	strings.setAttribute("d", "M4 6h16M4 10h16M4 14h16M4 18h16");
	const bar = document.createElementNS("http://www.w3.org/2000/svg", "path");
	bar.setAttribute("d", "M10 4v16M10 7h5");
	svg.append(strings, bar);
	return svg;
}
