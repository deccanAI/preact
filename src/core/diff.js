import { IS_HYDRATING } from './constants';

const EMPTY_OBJ = {};
const EMPTY_ARR = [];
const IS_NON_DIMENSIONAL =
	/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;

export function diff(
	dom,
	parentDom,
	newVNode,
	oldVNode,
	context,
	isSvg,
	excessDomChildren,
	commitQueue,
	isHydrating = false
) {
	let tmp,
		newType = newVNode.type;

	// Fast-path: Check if nodes are identical during hydration
	if (isHydrating && oldVNode && newVNode.type === oldVNode.type) {
		const domMatches =
			dom &&
			dom.nodeType === 1 &&
			(!newType || typeof newType === 'string') &&
			dom.nodeName.toLowerCase() === (newType || 'div').toLowerCase();

		if (domMatches) {
			// Optimize for matching nodes - skip full diffing
			if (quickDiff(dom, newVNode, oldVNode)) {
				return dom;
			}
		}
	}

	try {
		outer: if (typeof newType === 'function') {
			// Handle components
			let c, isNew, oldProps, oldState, snapshot;
			let newProps = newVNode.props;

			// Get component instance
			if (oldVNode._component) {
				c = newVNode._component = oldVNode._component;
				isNew = false;
			} else {
				if ('prototype' in newType && newType.prototype.render) {
					newVNode._component = c = new newType(newProps, context);
				} else {
					newVNode._component = c = new Component(newProps, context);
					c.constructor = newType;
					c.render = doRender;
				}
				isNew = true;
			}

			if (!isNew && c.props !== newProps) {
				oldProps = c.props;
				c.props = newProps;
				c._dirty = true;
			}

			oldState = c._prevState = c._state;
			c._dirty = false;

			if (c._depth) {
				if (!isNew) {
					if (c.componentWillReceiveProps) {
						c.componentWillReceiveProps(newProps, context);
					}
					if (
						c.shouldComponentUpdate &&
						!c.shouldComponentUpdate(newProps, c._nextState, context)
					) {
						break outer;
					}
				}
			}

			snapshot = c._prevState;
			c._state = c._nextState || c.state;

			if (isNew) {
				if (c.componentWillMount) c.componentWillMount();
			} else if (c.componentWillUpdate) {
				c.componentWillUpdate(newProps, c._nextState, context);
			}

			c._dirty = false;
			c.props = newProps;
			c.state = c._nextState || c.state;

			let renderResult = c.render(c.props, c.state, context);
			diffChildren(
				dom,
				renderResult,
				context,
				isSvg,
				excessDomChildren,
				commitQueue,
				isHydrating
			);

			c._parentDom = dom;

			if (!isNew && c.componentDidUpdate) {
				c.componentDidUpdate(oldProps, oldState, snapshot);
			}

			if (c._renderCallbacks) {
				c._renderCallbacks.forEach(cb => cb.call(c));
				c._renderCallbacks = null;
			}
		} else {
			// Handle DOM elements
			dom = diffElementNodes(
				dom,
				newVNode,
				oldVNode,
				context,
				isSvg,
				excessDomChildren,
				commitQueue,
				isHydrating
			);
		}
	} catch (e) {
		console.error('Error during diff:', e);
		dom = null;
	}

	return dom;
}

function quickDiff(dom, newVNode, oldVNode) {
	// Early bailout for identical props
	if (newVNode.props === oldVNode.props) return true;

	const newProps = newVNode.props || EMPTY_OBJ;
	const oldProps = oldVNode.props || EMPTY_OBJ;
	let didMismatch = false;

	// Quick check for most common attributes
	for (const name in newProps) {
		if (name === 'children') continue;

		const newValue = newProps[name];
		const oldValue = oldProps[name];

		if (newValue !== oldValue) {
			// Special handling for style
			if (name === 'style' && newValue && oldValue) {
				let matched = true;
				for (const k in newValue) {
					if (newValue[k] !== oldValue[k]) {
						matched = false;
						break;
					}
				}
				if (matched) continue;
			}

			didMismatch = true;
			break;
		}
	}

	return !didMismatch;
}

function diffElementNodes(
	dom,
	newVNode,
	oldVNode,
	context,
	isSvg,
	excessDomChildren,
	commitQueue,
	isHydrating
) {
	let oldProps = oldVNode ? oldVNode.props : EMPTY_OBJ;
	let newProps = newVNode.props;
	let nodeType = newVNode.type;
	let i = 0;

	if (dom == null) {
		if (nodeType === null) {
			return document.createTextNode(newProps);
		}

		dom = document.createElement(nodeType, newProps.is && { is: newProps.is });
	}

	// Optimize attribute updates during hydration
	if (isHydrating) {
		const existingAttrs = new Set([...dom.attributes].map(attr => attr.name));

		for (i in newProps) {
			if (
				i !== 'children' &&
				i !== 'key' &&
				(!oldProps || newProps[i] !== oldProps[i])
			) {
				setProperty(dom, i, newProps[i], oldProps[i], isSvg);
				existingAttrs.delete(i);
			}
		}

		// Remove attributes not present in new props
		for (const name of existingAttrs) {
			if (!(name in newProps)) {
				dom.removeAttribute(name);
			}
		}
	} else {
		// Normal diffing for non-hydration updates
		for (i in newProps) {
			if (
				i !== 'children' &&
				i !== 'key' &&
				(!oldProps || newProps[i] !== oldProps[i])
			) {
				setProperty(dom, i, newProps[i], oldProps[i], isSvg);
			}
		}
	}

	return dom;
}

function setProperty(dom, name, value, oldValue, isSvg) {
	if (name === 'style') {
		if (typeof value === 'string') {
			dom.style.cssText = value;
		} else {
			if (typeof oldValue === 'string') {
				dom.style.cssText = '';
				oldValue = null;
			}

			if (oldValue) {
				for (let i in oldValue) {
					if (!(value && i in value)) {
						setStyle(dom.style, i, '');
					}
				}
			}

			if (value) {
				for (let i in value) {
					if (!oldValue || value[i] !== oldValue[i]) {
						setStyle(dom.style, i, value[i]);
					}
				}
			}
		}
	} else if (name[0] === 'o' && name[1] === 'n') {
		let useCapture = name !== (name = name.replace(/Capture$/, ''));
		let nameLower = name.toLowerCase();
		name = (nameLower in dom ? nameLower : name).slice(2);

		if (value) {
			if (!oldValue) dom.addEventListener(name, eventProxy, useCapture);
		} else {
			dom.removeEventListener(name, eventProxy, useCapture);
		}
		(dom._listeners || (dom._listeners = {}))[name] = value;
	} else if (name !== 'list' && name !== 'tagName' && !isSvg && name in dom) {
		dom[name] = value == null ? '' : value;
	} else if (
		typeof value !== 'function' &&
		name !== 'dangerouslySetInnerHTML'
	) {
		if (name !== (name = name.replace(/^xlink:?/, ''))) {
			if (value == null || value === false) {
				dom.removeAttributeNS(
					'http://www.w3.org/1999/xlink',
					name.toLowerCase()
				);
			} else {
				dom.setAttributeNS(
					'http://www.w3.org/1999/xlink',
					name.toLowerCase(),
					value
				);
			}
		} else if (value == null || value === false) {
			dom.removeAttribute(name);
		} else {
			dom.setAttribute(name, value);
		}
	}
}

function setStyle(style, key, value) {
	if (key[0] === '-') {
		style.setProperty(key, value);
	} else if (value == null) {
		style[key] = '';
	} else if (typeof value !== 'number' || IS_NON_DIMENSIONAL.test(key)) {
		style[key] = value;
	} else {
		style[key] = value + 'px';
	}
}

function eventProxy(e) {
	return this._listeners[e.type](e);
}
