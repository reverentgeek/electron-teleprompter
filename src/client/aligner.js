// Sliding-window fuzzy aligner.
//
// Given a known script (array of normalized words) and a stream of recognized
// words from STT, find the most likely current position by searching a forward
// window for the best multiset overlap with a ring buffer of recent recognized
// words. The result tolerates ASR errors, ad-libs, and re-reads.
//
// This is intentionally simple. See "how to extend" in the recipe README for
// phonetic matching and longest-common-subsequence variants.

const RECENT_WINDOW = 15;
const FORWARD_WINDOW = 200;
const MIN_OVERLAP_TO_ADVANCE = 5;
const MAX_BACKWARD_JUMP = 30;
const MIN_OVERLAP_TO_REWIND = 8;

const NORMALIZE_REGEX = /[^\w']/g;

function normalize( word ) {
	return word.toLowerCase().replace( NORMALIZE_REGEX, "" );
}

function buildCounts( words ) {
	const counts = new Map();
	for ( const w of words ) {
		counts.set( w, ( counts.get( w ) || 0 ) + 1 );
	}
	return counts;
}

export function createAligner( scriptWords ) {
	const recent = [];
	let position = 0;

	function addRecognized( word ) {
		const cleaned = normalize( word );
		if ( !cleaned ) return;
		recent.push( cleaned );
		if ( recent.length > RECENT_WINDOW ) recent.shift();
	}

	function step() {
		if ( recent.length < MIN_OVERLAP_TO_ADVANCE ) return position;
		if ( !scriptWords.length ) return position;

		const recentCounts = buildCounts( recent );
		const windowSize = recent.length;
		const start = Math.max( 0, position - MAX_BACKWARD_JUMP );
		const end = Math.min( scriptWords.length, position + FORWARD_WINDOW );
		const limit = end - windowSize;

		let bestPos = position;
		let bestScore = 0;

		for ( let i = start; i <= limit; i++ ) {
			let score = 0;
			const remaining = new Map( recentCounts );
			for ( let j = 0; j < windowSize; j++ ) {
				const w = scriptWords[i + j];
				const r = remaining.get( w ) || 0;
				if ( r > 0 ) {
					score++;
					remaining.set( w, r - 1 );
				}
			}
			if ( score > bestScore ) {
				bestScore = score;
				bestPos = i + windowSize - 1;
			}
		}

		const isBackward = bestPos < position;
		const threshold = isBackward ? MIN_OVERLAP_TO_REWIND : MIN_OVERLAP_TO_ADVANCE;
		if ( bestScore >= threshold ) {
			position = bestPos;
		}
		return position;
	}

	function currentPosition() {
		return position;
	}

	function setPosition( idx ) {
		position = Math.max( 0, Math.min( scriptWords.length - 1, idx ) );
	}

	function reset() {
		position = 0;
		recent.length = 0;
	}

	return { addRecognized, step, currentPosition, setPosition, reset };
}

export const ALIGNER_CONSTANTS = {
	RECENT_WINDOW,
	FORWARD_WINDOW,
	MIN_OVERLAP_TO_ADVANCE,
	MAX_BACKWARD_JUMP,
	MIN_OVERLAP_TO_REWIND
};
