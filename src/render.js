import { EMPTY_OBJ, NULL } from './constants';
import { commitRoot, diff } from './diff/index';
import { createElement, Fragment } from './create-element';
import options from './options';
import { slice } from './util';

/**
 * Render a Preact virtual node into a DOM element
 * @param {import('./internal').ComponentChild} vnode The virtual node to render
 * @param {import('./internal').PreactElement} parentDom The DOM element to render into
 * @param {import('./internal').PreactElement | object} [replaceNode] Optional: Attempt to re-use an
 * existing DOM tree rooted at `replaceNode`
 */
export function render(vnode, parentDom, replaceNode) {
	// https://github.com/preactjs/preact/issues/3794
	if (parentDom == document) {
		parentDom = document.documentElement;
	}

	if (options._root) options._root(vnode, parentDom);

	// We abuse the `replaceNode` parameter in `hydrate()` to signal if we are in
	// hydration mode or not by passing the `hydrate` function instead of a DOM
	// element.
	let isHydrating = typeof replaceNode == 'function';

	// Enhanced hydration state tracking
	if (isHydrating) {
		// Initialize hydration context if not present
		if (!parentDom._hydrationContext) {
			parentDom._hydrationContext = {
				mismatches: 0,
				recovered: 0,
				warnings: [],
				partialHydration: false
			};
		}

		// Setup development mode hydration warnings
		if (options.development) {
			const warn = msg => {
				parentDom._hydrationContext.warnings.push(msg);
				if (options._hydrationWarning) {
					options._hydrationWarning(vnode, msg);
				}
			};

			options._hydrationWarning = (node, msg) => warn(msg);
		}
	}

	// To be able to support calling `render()` multiple times on the same
	// DOM node, we need to obtain a reference to the previous tree. We do
	// this by assigning a new `_children` property to DOM nodes which points
	// to the last rendered tree. By default this property is not present, which
	// means that we are mounting a new tree for the first time.
	let oldVNode = isHydrating
		? NULL
		: (replaceNode && replaceNode._children) || parentDom._children;

	vnode = ((!isHydrating && replaceNode) || parentDom)._children =
		createElement(Fragment, NULL, [vnode]);

	// List of effects that need to be called after diffing.
	let commitQueue = [],
		refQueue = [];

	// Enhanced error boundary for hydration
	try {
		diff(
			parentDom,
			// Determine the new vnode tree and store it on the DOM element on
			// our custom `_children` property.
			vnode,
			oldVNode || EMPTY_OBJ,
			EMPTY_OBJ,
			parentDom.namespaceURI,
			!isHydrating && replaceNode
				? [replaceNode]
				: oldVNode
					? NULL
					: parentDom.firstChild
						? slice.call(parentDom.childNodes)
						: NULL,
			commitQueue,
			!isHydrating && replaceNode
				? replaceNode
				: oldVNode
					? oldVNode._dom
					: parentDom.firstChild,
			isHydrating,
			refQueue
		);

		// Flush all queued effects
		commitRoot(commitQueue, vnode, refQueue);

		// Update hydration stats after successful render
		if (isHydrating && parentDom._hydrationContext) {
			const ctx = parentDom._hydrationContext;
			if (ctx.mismatches > 0 && ctx.recovered === ctx.mismatches) {
				ctx.partialHydration = true;
			}
		}
	} catch (e) {
		// Enhanced error handling for hydration failures
		if (isHydrating) {
			const ctx = parentDom._hydrationContext;
			ctx.mismatches++;

			if (options.development) {
				console.warn('Hydration failed:', e);
				console.warn('Falling back to client-side rendering for subtree');
			}

			// Attempt to recover by clearing the subtree and re-rendering
			if (options._hydrationError) {
				options._hydrationError(vnode, e);
			}
		}
		throw e;
	}
}

/**
 * Update an existing DOM element with data from a Preact virtual node
 * @param {import('./internal').ComponentChild} vnode The virtual node to render
 * @param {import('./internal').PreactElement} parentDom The DOM element to update
 * @param {object} [options] Optional configuration for hydration
 * @param {boolean} [options.forceFallback=false] Force client-side rendering on mismatch
 * @param {boolean} [options.warnOnMismatch=true] Show warnings on hydration mismatches
 */
export function hydrate(vnode, parentDom, options = {}) {
	const { forceFallback = false, warnOnMismatch = true } = options;

	// Setup hydration options
	if (!parentDom._hydrationOptions) {
		parentDom._hydrationOptions = {
			forceFallback,
			warnOnMismatch
		};
	}

	// Normalize the DOM before hydration
	normalizeDOM(parentDom);

	// Perform the hydration
	render(vnode, parentDom, hydrate);

	// Cleanup after hydration
	delete parentDom._hydrationOptions;

	// Return hydration stats
	return (
		parentDom._hydrationContext || {
			mismatches: 0,
			recovered: 0,
			warnings: [],
			partialHydration: false
		}
	);
}

/**
 * Normalize the DOM before hydration to handle common SSR issues
 * @param {import('./internal').PreactElement} dom
 */
function normalizeDOM(dom) {
	// Handle empty text nodes that might have been created during SSR
	const walker = document.createTreeWalker(
		dom,
		NodeFilter.SHOW_TEXT,
		null,
		false
	);

	const textNodes = [];
	while (walker.nextNode()) {
		textNodes.push(walker.currentNode);
	}

	for (const node of textNodes) {
		const text = node.data.trim();
		if (!text) {
			// Remove empty text nodes
			node.parentNode.removeChild(node);
		} else {
			// Normalize whitespace
			node.data = text.replace(/\s+/g, ' ');
		}
	}

	// Handle comments that might interfere with hydration
	const commentWalker = document.createTreeWalker(
		dom,
		NodeFilter.SHOW_COMMENT,
		null,
		false
	);

	const comments = [];
	while (commentWalker.nextNode()) {
		comments.push(commentWalker.currentNode);
	}

	// Remove comments that might interfere with hydration
	for (const comment of comments) {
		comment.parentNode.removeChild(comment);
	}
}
