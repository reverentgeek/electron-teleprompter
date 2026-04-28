// Word-position index for the rendered script.
// Walks text nodes inside a root element, splits into normalized words,
// and stores a DOM Range for each word so we can scroll to it later.

const NORMALIZE_REGEX = /[^\w']/g;

function normalize( word ) {
	return word.toLowerCase().replace( NORMALIZE_REGEX, "" );
}

export function buildWordIndex( rootEl ) {
	const words = [];
	const ranges = [];
	if ( !rootEl ) return { words, ranges };

	const walker = document.createTreeWalker( rootEl, NodeFilter.SHOW_TEXT );
	const wordRegex = /\S+/g;
	let node;
	while ( ( node = walker.nextNode() ) ) {
		const text = node.nodeValue;
		let match;
		while ( ( match = wordRegex.exec( text ) ) !== null ) {
			const cleaned = normalize( match[0] );
			if ( !cleaned ) continue;
			const range = document.createRange();
			range.setStart( node, match.index );
			range.setEnd( node, match.index + match[0].length );
			words.push( cleaned );
			ranges.push( range );
		}
	}
	return { words, ranges };
}

// Smooth-scroll state. We lerp toward the latest target each frame, capped
// by a max per-frame velocity so big jumps don't whip past content.
const SCROLL_LERP_RATE = 0.07; // fraction of remaining distance per frame
const SCROLL_MAX_VELOCITY = 10; // pixels per frame (≈ 600 px/s at 60fps)
const SCROLL_SETTLE_THRESHOLD = 0.5; // stop animating when within this many pixels

let scrollTargetY = null;
let scrollAnimating = false;

function tickScroll() {
	if ( scrollTargetY === null ) {
		scrollAnimating = false;
		return;
	}
	const current = window.scrollY;
	const delta = scrollTargetY - current;
	if ( Math.abs( delta ) < SCROLL_SETTLE_THRESHOLD ) {
		window.scrollTo( 0, scrollTargetY );
		scrollAnimating = false;
		scrollTargetY = null;
		return;
	}
	const lerpStep = delta * SCROLL_LERP_RATE;
	const cappedStep = Math.sign( delta ) * Math.min( Math.abs( lerpStep ), SCROLL_MAX_VELOCITY );
	window.scrollTo( 0, current + cappedStep );
	requestAnimationFrame( tickScroll );
}

export function cancelScroll() {
	scrollTargetY = null;
	scrollAnimating = false;
}

export function scrollToWord( index, ranges, opts = {} ) {
	if ( !ranges || index < 0 || index >= ranges.length ) return;
	const range = ranges[index];
	const rect = range.getBoundingClientRect();
	if ( rect.width === 0 && rect.height === 0 ) return;
	const verticalAnchor = opts.verticalAnchor ?? 0.33;
	const targetY = Math.max( 0, window.scrollY + rect.top - window.innerHeight * verticalAnchor );
	if ( opts.smooth === false ) {
		scrollTargetY = null;
		scrollAnimating = false;
		window.scrollTo( 0, targetY );
		return;
	}
	scrollTargetY = targetY;
	if ( !scrollAnimating ) {
		scrollAnimating = true;
		requestAnimationFrame( tickScroll );
	}
}
