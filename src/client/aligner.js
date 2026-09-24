// Sliding-window fuzzy aligner.
//
// Given a known script (array of normalized words) and a stream of recognized
// words from STT, find the most likely current position by searching a forward
// window for the best multiset overlap with a ring buffer of recent recognized
// words. The result tolerates ASR errors, ad-libs, and re-reads.
//
// Matches are weighted by inverse document frequency so filler words ("the",
// "and", "a") can't carry a match on their own — a window must share
// distinctive words with what was spoken. If nothing in the local window is
// convincing, the whole script is searched with a stricter bar so a lost
// aligner can find the reader again instead of settling on a nearby false match.

const RECENT_WINDOW = 15;
const FORWARD_WINDOW = 200;
const MAX_BACKWARD_JUMP = 30;
const MIN_RECENT_TO_STEP = 5;
// Fraction of the best possible weighted score a window must reach.
const MIN_SCORE_RATIO_ADVANCE = 0.5;
const MIN_SCORE_RATIO_REWIND = 0.6;
const MIN_SCORE_RATIO_GLOBAL = 0.65;
// A "content" word appears at most this many times in the script.
const CONTENT_WORD_MAX_DF = 3;
const MIN_CONTENT_MATCHES_LOCAL = 2;
const MIN_CONTENT_MATCHES_GLOBAL = 3;

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

	const docFreq = buildCounts( scriptWords );
	const logN = Math.log( 1 + scriptWords.length );
	function weight( w ) {
		const df = docFreq.get( w );
		return df ? Math.log( 1 + scriptWords.length / df ) / logN : 0;
	}
	function isContentWord( w ) {
		const df = docFreq.get( w );
		return df > 0 && df <= CONTENT_WORD_MAX_DF;
	}

	function addRecognized( word ) {
		const cleaned = normalize( word );
		if ( !cleaned ) return;
		recent.push( cleaned );
		if ( recent.length > RECENT_WINDOW ) recent.shift();
	}

	// Best-scoring window ending in [start, end). Ties keep the earliest match.
	function search( start, end, recentCounts ) {
		const windowSize = recent.length;
		const limit = end - windowSize;
		let best = { pos: position, score: 0, content: 0 };
		for ( let i = start; i <= limit; i++ ) {
			let score = 0;
			let content = 0;
			const remaining = new Map( recentCounts );
			for ( let j = 0; j < windowSize; j++ ) {
				const w = scriptWords[i + j];
				const r = remaining.get( w ) || 0;
				if ( r > 0 ) {
					score += weight( w );
					if ( isContentWord( w ) ) content++;
					remaining.set( w, r - 1 );
				}
			}
			if ( score > best.score ) {
				best = { pos: i + windowSize - 1, score, content };
			}
		}
		return best;
	}

	function step() {
		if ( recent.length < MIN_RECENT_TO_STEP ) return position;
		if ( !scriptWords.length ) return position;

		const recentCounts = buildCounts( recent );
		const maxScore = recent.reduce( ( sum, w ) => sum + weight( w ), 0 );
		if ( maxScore <= 0 ) return position;

		const local = search(
			Math.max( 0, position - MAX_BACKWARD_JUMP ),
			Math.min( scriptWords.length, position + FORWARD_WINDOW ),
			recentCounts
		);
		const localRatio = local.pos < position ? MIN_SCORE_RATIO_REWIND : MIN_SCORE_RATIO_ADVANCE;
		if ( local.score >= maxScore * localRatio && local.content >= MIN_CONTENT_MATCHES_LOCAL ) {
			position = local.pos;
			return position;
		}

		const global = search( 0, scriptWords.length, recentCounts );
		if ( global.score >= maxScore * MIN_SCORE_RATIO_GLOBAL && global.content >= MIN_CONTENT_MATCHES_GLOBAL ) {
			position = global.pos;
		}
		return position;
	}

	function currentPosition() {
		return position;
	}

	function setPosition( idx ) {
		position = Math.max( 0, Math.min( scriptWords.length - 1, idx ) );
	}

	function clearRecent() {
		recent.length = 0;
	}

	function reset() {
		position = 0;
		recent.length = 0;
	}

	return { addRecognized, step, currentPosition, setPosition, clearRecent, reset };
}

export const ALIGNER_CONSTANTS = {
	RECENT_WINDOW,
	FORWARD_WINDOW,
	MAX_BACKWARD_JUMP,
	MIN_RECENT_TO_STEP,
	MIN_SCORE_RATIO_ADVANCE,
	MIN_SCORE_RATIO_REWIND,
	MIN_SCORE_RATIO_GLOBAL,
	CONTENT_WORD_MAX_DF,
	MIN_CONTENT_MATCHES_LOCAL,
	MIN_CONTENT_MATCHES_GLOBAL
};
