import { EMPTY_OBJ } from '../constants';
import options from '../options';

/**
 * Enhanced hydration state tracking to minimize mismatches
 * @typedef {Object} HydrationState
 * @property {boolean} isHydrating Whether we're currently hydrating
 * @property {Map<string, boolean>} hydratedNodes Track which nodes have been hydrated
 * @property {Set<string>} deferredNodes Nodes that should be hydrated later
 */

/** @type {HydrationState} */
const hydrationState = {
	isHydrating: false,
	hydratedNodes: new Map(),
	deferredNodes: new Set()
};

/**
 * Enhanced attribute comparison for hydration
 * @param {Element} dom The DOM node to compare
 * @param {Object} props The new props
 * @param {Object} oldProps The old props
 * @returns {boolean} Whether the attributes match
 */
export function compareNodeAttributes(dom, props, oldProps) {
	const domAttrs = dom.attributes;
	const propsKeys = Object.keys(props).filter(key => key !== 'children');
	const oldPropsKeys = Object.keys(oldProps).filter(key => key !== 'children');

	if (propsKeys.length !== oldPropsKeys.length) {
		return false;
	}

	for (let i = 0; i < domAttrs.length; i++) {
		const attr = domAttrs[i];
		if (attr.name !== 'data-hydrate-key' && props[attr.name] !== attr.value) {
			return false;
		}
	}

	return true;
}

/**
 * Preserve initial dimensions during hydration to prevent layout shifts
 * @param {Element} dom The DOM node to preserve dimensions for
 */
export function preserveDimensions(dom) {
	if (!dom || dom.nodeType !== 1) return;

	const rect = dom.getBoundingClientRect();
	const style = dom.style;

	if (rect.height > 0) {
		style.minHeight = `${rect.height}px`;
	}
	if (rect.width > 0) {
		style.minWidth = `${rect.width}px`;
	}
}

/**
 * Enhanced hydration mismatch detection with detailed warnings
 * @param {import('../internal').VNode} vnode The virtual node being hydrated
 * @param {Element[]} excessDomChildren Excess DOM children
 */
export function handleHydrationMismatch(vnode, excessDomChildren) {
	if (process.env.NODE_ENV !== 'production') {
		const dom = vnode._dom;
		const expectedType = vnode.type;
		const actualType = dom ? dom.nodeName.toLowerCase() : null;

		console.warn(
			'Hydration mismatch:',
			`\nExpected: ${expectedType}`,
			`\nActual: ${actualType}`,
			`\nProps:`,
			vnode.props,
			`\nDOM:`,
			dom
		);

		if (excessDomChildren && excessDomChildren.length) {
			console.warn('Excess DOM nodes:', excessDomChildren);
		}
	}
}

/**
 * Determine if a node should be deferred for hydration
 * @param {import('../internal').VNode} vnode The virtual node to check
 * @returns {boolean} Whether the node should be deferred
 */
export function shouldDeferHydration(vnode) {
	return (
		vnode.props['data-hydrate-defer'] === 'true' ||
		vnode.props['data-hydrate-priority'] === 'low'
	);
}

/**
 * Track hydrated nodes to prevent double-hydration
 * @param {string} key Unique identifier for the node
 * @param {boolean} isHydrated Whether the node has been hydrated
 */
export function trackHydration(key, isHydrated) {
	hydrationState.hydratedNodes.set(key, isHydrated);
}

/**
 * Check if a node has already been hydrated
 * @param {string} key Unique identifier for the node
 * @returns {boolean} Whether the node has been hydrated
 */
export function isNodeHydrated(key) {
	return hydrationState.hydratedNodes.get(key) === true;
}

/**
 * Reset hydration state for a new hydration pass
 */
export function resetHydrationState() {
	hydrationState.isHydrating = false;
	hydrationState.hydratedNodes.clear();
	hydrationState.deferredNodes.clear();
}

// Export the hydration state for use in the main diffing process
export { hydrationState };
