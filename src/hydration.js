import { EMPTY_OBJ, MODE_HYDRATE } from './constants';
import { assign } from './util';
import options from './options';

export const HYDRATION_CACHE = new WeakMap();
const ATTR_CACHE = new WeakMap();

export function createHydrationTracker() {
	return {
		mismatches: 0,
		recovered: 0,
		cache: new WeakMap()
	};
}

export function hydrateNode(dom, vnode, parentDom, context) {
	if (!dom) return null;

	const tracker = HYDRATION_CACHE.get(parentDom) || createHydrationTracker();
	if (!HYDRATION_CACHE.has(parentDom)) {
		HYDRATION_CACHE.set(parentDom, tracker);
	}

	// Fast path: exact node type match
	if (isExactMatch(dom, vnode)) {
		vnode._dom = dom;
		if (typeof vnode.type === 'function') {
			return hydrateComponent(dom, vnode, context, tracker);
		}
		return hydrateElement(dom, vnode, context, tracker);
	}

	// Attempt recovery for mismatches
	const recovered = attemptRecovery(dom, vnode, parentDom, context, tracker);
	if (recovered) {
		tracker.recovered++;
		return recovered;
	}

	tracker.mismatches++;
	if (options._hydrationMismatch) {
		options._hydrationMismatch(vnode, [dom]);
	}

	// Create new node as fallback
	return null;
}

function isExactMatch(dom, vnode) {
	if (!dom || !vnode) return false;

	if (vnode.type === null) {
		return dom.nodeType === 3 && dom.textContent === vnode._text;
	}

	return dom.nodeName.toLowerCase() === (vnode.type || '').toLowerCase();
}

function hydrateElement(dom, vnode, context, tracker) {
	const props = vnode.props;
	const cachedProps = ATTR_CACHE.get(dom) || captureExistingAttributes(dom);

	// Optimize attribute diffing
	for (const name in props) {
		const value = props[name];
		const oldValue = cachedProps[name];

		if (name === 'children' || name === 'dangerouslySetInnerHTML') continue;

		if (value !== oldValue) {
			setProperty(dom, name, value, oldValue);
		}
	}

	// Handle children
	if (vnode.props.dangerouslySetInnerHTML) {
		dom.innerHTML = vnode.props.dangerouslySetInnerHTML.__html || '';
	} else if (vnode._children && vnode._children.length > 0) {
		hydrateChildren(dom, vnode._children, context, tracker);
	}

	return dom;
}

function hydrateComponent(dom, vnode, context, tracker) {
	const Component = vnode.type;
	const props = vnode.props;

	let component = vnode._component;
	if (!component) {
		component = vnode._component = new Component(props, context);
		component._parentDom = dom;
		component._vnode = vnode;
		initComponentHydration(component, props, context);
	}

	component._force = false;
	component._dirty = false;
	component.props = props;
	component.context = context;

	const renderResult = component.render(props, component.state, context);

	// Handle fragments and arrays
	const childNodes = Array.isArray(renderResult)
		? renderResult
		: [renderResult];
	hydrateChildren(dom, childNodes, context, tracker);

	if (component.componentDidMount) {
		component._renderCallbacks.push(component.componentDidMount);
	}

	return dom;
}

function hydrateChildren(parentDom, children, context, tracker) {
	const domChildren = parentDom.childNodes;
	let domIndex = 0;

	children.forEach((child, index) => {
		if (!child) return;

		// Skip comments and empty nodes
		while (domChildren[domIndex] && domChildren[domIndex].nodeType === 8) {
			domIndex++;
		}

		const childDom = domChildren[domIndex];
		if (!childDom) return;

		const hydrated = hydrateNode(childDom, child, parentDom, context);
		if (hydrated) {
			domIndex++;
		}
	});
}

function initComponentHydration(component, props, context) {
	if (!component.state) component.state = {};
	component._renderCallbacks = [];

	const isDerivedState = component.constructor.getDerivedStateFromProps;
	if (isDerivedState) {
		const derivedState = isDerivedState(props, component.state);
		if (derivedState) {
			component.state = assign(assign({}, component.state), derivedState);
		}
	}

	if (component.componentWillMount) {
		component.componentWillMount();
	}
}

function attemptRecovery(dom, vnode, parentDom, context, tracker) {
	// Try to find a matching node in siblings
	let sibling = dom.nextSibling;
	while (sibling) {
		if (isExactMatch(sibling, vnode)) {
			const oldDom = dom;
			dom = sibling;
			if (oldDom.parentNode) {
				oldDom.parentNode.removeChild(oldDom);
			}
			return hydrateNode(dom, vnode, parentDom, context);
		}
		sibling = sibling.nextSibling;
	}

	// Cache the failed node for potential later recovery
	tracker.cache.set(vnode, dom);
	return null;
}

function captureExistingAttributes(dom) {
	const props = {};
	const attributes = dom.attributes;

	for (let i = 0; i < attributes.length; i++) {
		const attr = attributes[i];
		props[attr.name] = attr.value;
	}

	ATTR_CACHE.set(dom, props);
	return props;
}

function setProperty(dom, name, value, oldValue) {
	if (name === 'style' && typeof value === 'object') {
		for (const key in value) {
			dom.style[key] = value[key] || '';
		}
		return;
	}

	if (name[0] === 'o' && name[1] === 'n') {
		const useCapture = name !== (name = name.replace(/Capture$/, ''));
		name = name.toLowerCase().substring(2);
		if (value) {
			if (!oldValue) dom.addEventListener(name, eventProxy, useCapture);
		} else {
			dom.removeEventListener(name, eventProxy, useCapture);
		}
		(dom._listeners || (dom._listeners = {}))[name] = value;
		return;
	}

	if (name !== 'list' && name !== 'tagName' && name in dom) {
		dom[name] = value == null ? '' : value;
		return;
	}

	if (typeof value !== 'function' && name !== 'dangerouslySetInnerHTML') {
		if (value == null || value === false) {
			dom.removeAttribute(name);
		} else {
			dom.setAttribute(name, value);
		}
	}
}

function eventProxy(e) {
	return this._listeners[e.type](e);
}
