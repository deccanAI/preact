import { MODE_HYDRATE } from '../constants';
import options from '../options';

/**
 * Checks if the server-rendered node matches the client-side VNode
 * @param {import('../internal').PreactElement} dom The DOM node
 * @param {import('../internal').VNode} vnode The virtual node
 * @returns {boolean} Whether the nodes match
 */
export function isNodeMatch(dom, vnode) {
	if (!dom || !vnode) return false;

	// Text nodes
	if (vnode.type === null) {
		return dom.nodeType === 3;
	}

	// Element nodes
	if (typeof vnode.type === 'string') {
		return dom.nodeName.toLowerCase() === vnode.type.toLowerCase();
	}

	return false;
}

/**
 * Attempts to preserve the server-rendered node while updating its properties
 * @param {import('../internal').PreactElement} dom The DOM node
 * @param {import('../internal').VNode} vnode The virtual node
 * @param {object} oldProps The old properties
 * @param {object} newProps The new properties
 * @param {string} namespace The current namespace
 * @returns {boolean} Whether the node was preserved
 */
export function preserveServerNode(dom, vnode, oldProps, newProps, namespace) {
	if (!isNodeMatch(dom, vnode)) {
		if (options._hydrationMismatch) {
			options._hydrationMismatch(vnode, [dom]);
		}
		return false;
	}

	// For text nodes, just update the content if different
	if (vnode.type === null) {
		if (dom.data !== vnode.props) {
			dom.data = vnode.props;
		}
		return true;
	}

	// For elements, carefully update props to preserve server-rendered attributes
	// that shouldn't be overwritten
	if (typeof vnode.type === 'string') {
		// Keep track of dimensions to prevent layout shifts
		const rect = dom.getBoundingClientRect();
		const hadLayout = rect.width || rect.height;

		// Update properties
		for (let name in newProps) {
			const value = newProps[name];
			const oldValue = oldProps[name];

			// Skip children and unchanged props
			if (name === 'children' || value === oldValue) {
				continue;
			}

			// Special handling for class/className
			if (name === 'class' || name === 'className') {
				dom.className = value || '';
				continue;
			}

			// Handle style updates carefully
			if (name === 'style' && typeof value === 'object') {
				for (let key in value) {
					if (oldProps.style?.[key] !== value[key]) {
						dom.style[key] = value[key];
					}
				}
				continue;
			}

			// Update other properties
			if (name[0] === 'o' && name[1] === 'n') {
				// Skip event handlers during hydration
				if (vnode._flags & MODE_HYDRATE) continue;
			}

			try {
				dom[name] = value;
			} catch (e) {
				// Some properties can't be set directly
			}
		}

		// Check if layout was affected and try to minimize shifts
		if (hadLayout) {
			const newRect = dom.getBoundingClientRect();
			if (newRect.width !== rect.width || newRect.height !== rect.height) {
				// Log warning about layout shift
				if (options._hydrationLayoutShift) {
					options._hydrationLayoutShift(vnode, rect, newRect);
				}
			}
		}

		return true;
	}

	return false;
}
