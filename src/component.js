import { assign } from './util';
import { diff, commitRoot } from './diff/index';
import options from './options';
import { Fragment } from './create-element';
import { MODE_HYDRATE, NULL } from './constants';

/**
 * Base Component class. Provides `setState()` and `forceUpdate()`, which
 * trigger rendering
 * @param {object} props The initial component props
 * @param {object} context The initial context from parent components'
 * getChildContext
 */
export function BaseComponent(props, context) {
	this.props = props;
	this.context = context;
	this._computedCache = new Map();
}

/**
 * Memoize a computed value based on dependencies
 * @param {Function} compute Function that computes the value
 * @param {Array} deps Array of dependencies that affect the computed value
 * @returns {any} The memoized computed value
 */
BaseComponent.prototype.computed = function (compute, deps) {
	const key = deps.join(',');
	const cached = this._computedCache.get(key);
	if (cached && cached.deps.every((dep, i) => dep === deps[i])) {
		return cached.value;
	}
	const value = compute.call(this);
	this._computedCache.set(key, { deps: deps.slice(), value });
	return value;
};

/**
 * Update component state and schedule a re-render.
 * @this {import('./internal').Component}
 * @param {object | ((s: object, p: object) => object)} update A hash of state
 * properties to update with new values or a function that given the current
 * state and props returns a new partial state
 * @param {() => void} [callback] A function to be called once component state is
 * updated
 */
BaseComponent.prototype.setState = function (update, callback) {
	// only clone state when copying to nextState the first time.
	let s;
	if (this._nextState != NULL && this._nextState !== this.state) {
		s = this._nextState;
	} else {
		s = this._nextState = assign({}, this.state);
	}

	if (typeof update == 'function') {
		// Some libraries like `immer` mark the current state as readonly,
		// preventing us from mutating it, so we need to clone it. See #2716
		update = update(assign({}, s), this.props);
	}

	if (update) {
		// Compare values before updating to avoid unnecessary state changes
		let hasChanges = false;
		for (let key in update) {
			if (s[key] !== update[key]) {
				hasChanges = true;
				break;
			}
		}
		if (hasChanges) {
			assign(s, update);
		} else {
			// No actual changes, skip the update
			if (callback) callback();
			return;
		}
	}

	// Skip update if updater function returned null
	if (update == NULL) return;

	if (this._vnode) {
		if (callback) {
			this._stateCallbacks.push(callback);
		}

		// Batch updates by using microtask timing
		if (!this._pendingUpdate) {
			this._pendingUpdate = true;
			Promise.resolve().then(() => {
				if (this._pendingUpdate) {
					this._pendingUpdate = false;
					enqueueRender(this);
				}
			});
		}
	}
};

/**
 * Immediately perform a synchronous re-render of the component
 * @this {import('./internal').Component}
 * @param {() => void} [callback] A function to be called after component is
 * re-rendered
 */
BaseComponent.prototype.forceUpdate = function (callback) {
	if (this._vnode) {
		// Set render mode so that we can differentiate where the render request
		// is coming from. We need this because forceUpdate should never call
		// shouldComponentUpdate
		this._force = true;
		if (callback) this._renderCallbacks.push(callback);
		enqueueRender(this);
	}
};

/**
 * Accepts `props` and `state`, and returns a new Virtual DOM tree to build.
 * Virtual DOM is generally constructed via [JSX](https://jasonformat.com/wtf-is-jsx).
 * @param {object} props Props (eg: JSX attributes) received from parent
 * element/component
 * @param {object} state The component's current state
 * @param {object} context Context object, as returned by the nearest
 * ancestor's `getChildContext()`
 * @returns {ComponentChildren | void}
 */
BaseComponent.prototype.render = Fragment;

/**
 * @param {import('./internal').VNode} vnode
 * @param {number | null} [childIndex]
 */
export function getDomSibling(vnode, childIndex) {
	if (childIndex == NULL) {
		// Use childIndex==null as a signal to resume the search from the vnode's sibling
		return vnode._parent
			? getDomSibling(vnode._parent, vnode._index + 1)
			: NULL;
	}

	let sibling;
	for (; childIndex < vnode._children.length; childIndex++) {
		sibling = vnode._children[childIndex];

		if (sibling != NULL && sibling._dom != NULL) {
			// Since updateParentDomPointers keeps _dom pointer correct,
			// we can rely on _dom to tell us if this subtree contains a
			// rendered DOM node, and what the first rendered DOM node is
			return sibling._dom;
		}
	}

	// If we get here, we have not found a DOM node in this vnode's children.
	// We must resume from this vnode's sibling (in it's parent _children array)
	// Only climb up and search the parent if we aren't searching through a DOM
	// VNode (meaning we reached the DOM parent of the original vnode that began
	// the search)
	return typeof vnode.type == 'function' ? getDomSibling(vnode) : NULL;
}

/**
 * Trigger in-place re-rendering of a component.
 * @param {import('./internal').Component} component The component to rerender
 */
function renderComponent(component) {
	let oldVNode = component._vnode,
		oldDom = oldVNode._dom,
		commitQueue = [],
		refQueue = [];

	if (component._parentDom) {
		const newVNode = assign({}, oldVNode);
		newVNode._original = oldVNode._original + 1;
		if (options.vnode) options.vnode(newVNode);

		diff(
			component._parentDom,
			newVNode,
			oldVNode,
			component._globalContext,
			component._parentDom.namespaceURI,
			oldVNode._flags & MODE_HYDRATE ? [oldDom] : NULL,
			commitQueue,
			oldDom == NULL ? getDomSibling(oldVNode) : oldDom,
			!!(oldVNode._flags & MODE_HYDRATE),
			refQueue
		);

		newVNode._original = oldVNode._original;
		newVNode._parent._children[newVNode._index] = newVNode;
		commitRoot(commitQueue, newVNode, refQueue);

		if (newVNode._dom != oldDom) {
			updateParentDomPointers(newVNode);
		}
	}
}

/**
 * @param {import('./internal').VNode} vnode
 */
function updateParentDomPointers(vnode) {
	if ((vnode = vnode._parent) != NULL && vnode._component != NULL) {
		vnode._dom = vnode._component.base = NULL;
		for (let i = 0; i < vnode._children.length; i++) {
			let child = vnode._children[i];
			if (child != NULL && child._dom != NULL) {
				vnode._dom = vnode._component.base = child._dom;
				break;
			}
		}

		return updateParentDomPointers(vnode);
	}
}

/**
 * The render queue
 * @type {Array<import('./internal').Component>}
 */
let rerenderQueue = [];

/*
 * The value of `Component.debounce` must asynchronously invoke the passed in callback. It is
 * important that contributors to Preact can consistently reason about what calls to `setState`, etc.
 * do, and when their effects will be applied. See the links below for some further reading on designing
 * asynchronous APIs.
 * * [Designing APIs for Asynchrony](https://blog.izs.me/2013/08/designing-apis-for-asynchrony)
 * * [Callbacks synchronous and asynchronous](https://blog.ometer.com/2011/07/24/callbacks-synchronous-and-asynchronous/)
 */

let prevDebounce;

const defer =
	typeof Promise == 'function'
		? Promise.prototype.then.bind(Promise.resolve())
		: setTimeout;

/**
 * Enqueue a rerender of a component
 * @param {import('./internal').Component} c The component to rerender
 */
export function enqueueRender(c) {
	if (
		(!c._dirty &&
			(c._dirty = true) &&
			rerenderQueue.push(c) &&
			!process._rerenderCount++) ||
		prevDebounce !== options.debounceRendering
	) {
		prevDebounce = options.debounceRendering;
		(prevDebounce || defer)(process);
	}
}

/**
 * @param {import('./internal').Component} a
 * @param {import('./internal').Component} b
 */
const depthSort = (a, b) => a._vnode._depth - b._vnode._depth;

/** Flush the render queue by rerendering all queued components */
function process() {
	let c,
		l = 1;

	// Create a Set to track unique components and avoid duplicate renders
	const uniqueComponents = new Set();

	// First pass: collect unique components and sort by depth
	for (let i = 0; i < rerenderQueue.length; i++) {
		const component = rerenderQueue[i];
		if (!uniqueComponents.has(component)) {
			uniqueComponents.add(component);
		}
	}

	// Convert Set back to array and sort by depth
	const sortedQueue = Array.from(uniqueComponents).sort(depthSort);

	// Process the sorted, deduplicated queue
	for (const component of sortedQueue) {
		if (component._dirty) {
			// Clear the dirty flag before rendering to handle nested updates
			component._dirty = false;
			renderComponent(component);
		}
	}

	// Clear the queue and reset counter
	rerenderQueue.length = 0;
	process._rerenderCount = 0;
}

process._rerenderCount = 0;
