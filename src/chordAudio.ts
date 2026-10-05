import { ChordPosition } from "./chordGenerator";
import { Instrument, INSTRUMENTS } from "./instruments";
import { Chord, Interval } from "tonal";

export const CHORD_STRUM_DELAY_MS = 30;
const NOTE_CHROMA: Record<string, number> = {
	C: 0,
	D: 2,
	E: 4,
	F: 5,
	G: 7,
	A: 9,
	B: 11,
};
let audioContext: AudioContext | null = null;

export function soundingChordName(chordName: string, capo: number): string {
	if (capo === 0) {
		return chordName;
	}
	return (
		Chord.transpose(chordName, Interval.fromSemitones(capo)) || chordName
	);
}

export function midiNotesForPosition(
	instrument: Instrument,
	position: ChordPosition,
	capo: number,
): number[] {
	const tuning = INSTRUMENTS[instrument].tuning.split("-").map(noteToMidi);
	return position.frets.flatMap((fret, index) => {
		if (fret < 0 || tuning[index] === undefined) {
			return [];
		}
		const absoluteFret =
			fret > 0 && position.baseFret > 1
				? position.baseFret + fret - 1
				: fret;
		return [tuning[index] + absoluteFret + capo];
	});
}

export async function playChordPosition(
	instrument: Instrument,
	position: ChordPosition,
	capo: number,
): Promise<void> {
	audioContext ??= new AudioContext();
	await audioContext.resume();
	const notes = midiNotesForPosition(instrument, position, capo);
	const start = audioContext.currentTime;
	for (const [index, midi] of notes.entries()) {
		playPluckedString(
			audioContext,
			midi,
			start + (index * CHORD_STRUM_DELAY_MS) / 1000,
			notes.length,
		);
	}
}

function noteToMidi(note: string): number {
	const match = note.match(/^([A-G])([#b]?)(-?\d+)$/);
	if (!match) {
		throw new Error(`Invalid tuning note: ${note}`);
	}
	const accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
	return (Number(match[3]) + 1) * 12 + NOTE_CHROMA[match[1]] + accidental;
}

function playPluckedString(
	context: AudioContext,
	midi: number,
	when: number,
	numNotes: number,
): void {
	const frequency = 440 * 2 ** ((midi - 69) / 12);
	const sampleRate = context.sampleRate;
	const period = Math.max(2, Math.round(sampleRate / frequency));
	const buffer = context.createBuffer(1, sampleRate * 2, sampleRate);
	const samples = buffer.getChannelData(0);

	for (let index = 0; index < period; index++) {
		samples[index] = Math.random() * 2 - 1;
	}
	for (let index = period; index < samples.length; index++) {
		samples[index] =
			0.498 * (samples[index - period] + samples[index - period + 1]);
	}

	const source = context.createBufferSource();
	const gain = context.createGain();
	const filter = context.createBiquadFilter();
	source.buffer = buffer;
	filter.type = "lowpass";
	filter.frequency.value = 4500;
	gain.gain.value = 0.35 / Math.sqrt(Math.max(1, numNotes));
	source.connect(filter).connect(gain).connect(context.destination);
	source.start(when);
}
