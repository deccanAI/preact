/**
 * Preact Hydration
 * Optimized hydration implementation for Preact
 */

import { options } from './options';
import { EMPTY_OBJ } from './constants';

/**
 * Flag indicating if we're currently hydrating
 * @type {boolean}
 */
let hydrating = false;

/**
 * Current hydration options
 * @type {import('./jsx').JSXInternal.HydrationOptions}
 */
let hydrationOptions = {
	recoverFromMismatches: true,
	warnOnMismatches: true,
	preserveServerContent: false,
	enableSignals: true
};

/**
 * Set hydration options
 * @param {import('./jsx').JSXInternal.HydrationOptions} options
 */
export function setHydrationOptions(options) {
	hydrationOptions = { ...hydrationOptions, ...options };
}

/**
 * Start hydration process
 * @param {Element|DocumentFragment} dom The DOM node to hydrate
 * @returns {boolean} True if hydration was started
 */
export function startHydration(dom) {
	if (hydrating) return true;
	hydrating = true;
	
	// Mark all existing DOM nodes as server-rendered
	if (dom) {
		markSSRNodes(dom);
	}
	
	return true;
}

/**
 * End hydration process
 */
export function endHydration() {
	hydrating = false;
}

/**
 * Check if we're currently hydrating
 * @returns {boolean}
 */
export function isHydrating() {
	return hydrating;
}

/**
 * Mark all nodes in the DOM tree as server-rendered
 * @param {Element|DocumentFragment} node
 */
function markSSRNodes(node) {
	if (node.nodeType === 1) { // Element node
		node.setAttribute('data-ssr', 'true');
		
		// Mark as hydration root if it has the attribute
		if (node.hasAttribute('data-hydrate')) {
			node._hydrate = true;
		}
		
		// Process children
		for (let i = 0; i < node.childNodes.length; i++) {
			markSSRNodes(node.childNodes[i]);
		}
	}
}

/**
 * Handle hydration mismatch
 * @param {Element} dom The DOM node with mismatch
 * @param {string} expected Expected content/attribute
 * @param {string} actual Actual content/attribute
 * @param {Function|undefined} callback Optional callback for mismatch
 * @returns {boolean} Whether to preserve server content
 */
export function handleHydrationMismatch(dom, expected, actual, callback) {
	// Call the mismatch callback if provided
	if (typeof callback === 'function') {
		callback(dom, expected, actual);
	}
	
	// Handle based on hydration options and element attributes
	const mismatchBehavior = dom && dom.getAttribute && dom.getAttribute('hydrationMismatch') || 
		(dom && dom._vnode && dom._vnode.props && dom._vnode.props.hydrationMismatch);
	
	switch (mismatchBehavior) {
		case 'throw':
			if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
				throw new Error(`Hydration mismatch: expected "${expected}", got "${actual}"`);
			}
			break;
			
		case 'warn':
			if (typeof console !== 'undefined' && typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
				console.warn(`Hydration mismatch: expected "${expected}", got "${actual}"`, dom);
			}
			break;
			
		case 'preserve':
			return true; // Preserve server content
			
		case 'silent':
			// Silently fix the mismatch
			break;
			
		default:
			// Use global options
			if (hydrationOptions.warnOnMismatches && typeof console !== 'undefined' && 
				typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
				console.warn(`Hydration mismatch: expected "${expected}", got "${actual}"`, dom);
			}
			
			if (hydrationOptions.preserveServerContent) {
				return true; // Preserve server content
			}
	}
	
	return false; // Don't preserve server content
}

/**
 * Trigger hydration complete event
 * @param {Element} dom The DOM node that was hydrated
 */
export function triggerHydrationComplete(dom) {
	if (!dom || !dom._vnode) return;
	
	const onHydrated = dom._vnode.props && dom._vnode.props.onHydrated;
	if (typeof onHydrated === 'function') {
		onHydrated(dom);
	}
}

/**
 * Check if an element should be hydrated
 * @param {Element} dom The DOM element to check
 * @param {object} vnode The virtual node
 * @returns {boolean} True if the element should be hydrated
 */
export function shouldHydrate(dom, vnode) {
	if (!hydrating) return false;
	
	// Skip hydration if explicitly marked to skip
	if (vnode && vnode.props && vnode.props.hydrate === 'skip') {
		return false;
	}
	
	// Check if this is a hydration root
	if (dom && (dom._hydrate || (vnode && vnode.props && vnode.props.hydrate))) {
		return true;
	}
	
	// Default to hydrating during hydration phase
	return true;
}

// Hook into Preact options
const oldDiffed = options.diffed;
options.diffed = vnode => {
	// Trigger hydration complete when a component is diffed during hydration
	if (hydrating && vnode && vnode._dom) {
		triggerHydrationComplete(vnode._dom);
	}
	
	if (oldDiffed) oldDiffed(vnode);
};

const oldVNodeHook = options.vnode;
options.vnode = vnode => {
	// Handle hydration attributes
	if (vnode && vnode.props) {
		// Convert hydrate="true" to hydrate={true}
		if (vnode.props.hydrate === 'true') vnode.props.hydrate = true;
		if (vnode.props.hydrate === 'false') vnode.props.hydrate = false;
	}
	
	if (oldVNodeHook) oldVNodeHook(vnode);
};

// Add hydration mismatch detection
options._hydrationMismatch = handleHydrationMismatch;
