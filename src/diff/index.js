import {
	EMPTY_OBJ,
	MATH_NAMESPACE,
	MODE_HYDRATE,
	MODE_SUSPENDED,
	NULL,
	RESET_MODE,
	SVG_NAMESPACE,
	UNDEFINED,
	XHTML_NAMESPACE
} from '../constants';
import { BaseComponent, getDomSibling } from '../component';
import { Fragment } from '../create-element';
import { diffChildren } from './children';
import { setProperty } from './props';
import { assign, isArray, removeNode, slice } from '../util';
import options from '../options';

/**
 * @typedef {import('../internal').ComponentChildren} ComponentChildren
 * @typedef {import('../internal').Component} Component
 * @typedef {import('../internal').PreactElement} PreactElement
 * @typedef {import('../internal').VNode} VNode
 */

/**
 * @template {any} T
 * @typedef {import('../internal').Ref<T>} Ref<T>
 */

/**
 * Diff two virtual nodes and apply proper changes to the DOM
 * @param {PreactElement} parentDom The parent of the DOM element
 * @param {VNode} newVNode The new virtual node
 * @param {VNode} oldVNode The old virtual node
 * @param {object} globalContext The current context object. Modified by
 * getChildContext
 * @param {string} namespace Current namespace of the DOM node (HTML, SVG, or MathML)
 * @param {Array<PreactElement>} excessDomChildren
 * @param {Array<Component>} commitQueue List of components which have callbacks
 * to invoke in commitRoot
 * @param {PreactElement} oldDom The current attached DOM element any new dom
 * elements should be placed around. Likely `null` on first render (except when
 * hydrating). Can be a sibling DOM element when diffing Fragments that have
 * siblings. In most cases, it starts out as `oldChildren[0]._dom`.
 * @param {boolean} isHydrating Whether or not we are in hydration
 * @param {any[]} refQueue an array of elements needed to invoke refs
 */
export function diff(
	parentDom,
	newVNode,
	oldVNode,
	globalContext,
	namespace,
	excessDomChildren,
	commitQueue,
	oldDom,
	isHydrating,
	refQueue
) {
	/** @type {any} */
	let tmp,
		newType = newVNode.type;

	// When passing through createElement it assigns the object
	// constructor as undefined. This to prevent JSON-injection.
	if (newVNode.constructor !== UNDEFINED) return NULL;

	// If the previous diff bailed out, resume creating/hydrating.
	if (oldVNode._flags & MODE_SUSPENDED) {
		isHydrating = !!(oldVNode._flags & MODE_HYDRATE);
		oldDom = newVNode._dom = oldVNode._dom;
		excessDomChildren = [oldDom];
		
		// When resuming a suspended hydration, we need to ensure
		// we properly handle any potential mismatches
		if (isHydrating && options._hydrationResume) {
			options._hydrationResume(newVNode, oldVNode);
		}
	}

	if ((tmp = options._diff)) tmp(newVNode);

	outer: if (typeof newType == 'function') {
		try {
			let c, isNew, oldProps, oldState, snapshot, clearProcessingException;
			let newProps = newVNode.props;
			const isClassComponent =
				'prototype' in newType && newType.prototype.render;
				
			// During hydration, we need to be careful with components
			// that might behave differently on the client vs server

			// Necessary for createContext api. Setting this property will pass
			// the context value as `this.context` just for this component.
			tmp = newType.contextType;
			let provider = tmp && globalContext[tmp._id];
			let componentContext = tmp
				? provider
					? provider.props.value
					: tmp._defaultValue
				: globalContext;

			// Get component and set it to `c`
			if (oldVNode._component) {
				c = newVNode._component = oldVNode._component;
				clearProcessingException = c._processingException = c._pendingError;
			} else {
				// Instantiate the new component
				if (isClassComponent) {
					// @ts-expect-error The check above verifies that newType is suppose to be constructed
					newVNode._component = c = new newType(newProps, componentContext); // eslint-disable-line new-cap
				} else {
					// @ts-expect-error Trust me, Component implements the interface we want
					newVNode._component = c = new BaseComponent(
						newProps,
						componentContext
					);
					c.constructor = newType;
					c.render = doRender;
				}
				if (provider) provider.sub(c);

				c.props = newProps;
				if (!c.state) c.state = {};
				c.context = componentContext;
				c._globalContext = globalContext;
				isNew = c._dirty = true;
				c._renderCallbacks = [];
				c._stateCallbacks = [];
			}

			// Invoke getDerivedStateFromProps
			if (isClassComponent && c._nextState == NULL) {
				c._nextState = c.state;
			}

			if (isClassComponent && newType.getDerivedStateFromProps != NULL) {
				if (c._nextState == c.state) {
					c._nextState = assign({}, c._nextState);
				}

				assign(
					c._nextState,
					newType.getDerivedStateFromProps(newProps, c._nextState)
				);
			}

			oldProps = c.props;
			oldState = c.state;
			c._vnode = newVNode;

			// Invoke pre-render lifecycle methods
			if (isNew) {
				if (
					isClassComponent &&
					newType.getDerivedStateFromProps == NULL &&
					c.componentWillMount != NULL
				) {
					c.componentWillMount();
				}

				if (isClassComponent && c.componentDidMount != NULL) {
					c._renderCallbacks.push(c.componentDidMount);
				}
			} else {
				if (
					isClassComponent &&
					newType.getDerivedStateFromProps == NULL &&
					newProps !== oldProps &&
					c.componentWillReceiveProps != NULL
				) {
					c.componentWillReceiveProps(newProps, componentContext);
				}

				if (
					!c._force &&
					((c.shouldComponentUpdate != NULL &&
						c.shouldComponentUpdate(
							newProps,
							c._nextState,
							componentContext
						) === false) ||
						newVNode._original == oldVNode._original)
				) {
					// More info about this here: https://gist.github.com/JoviDeCroock/bec5f2ce93544d2e6070ef8e0036e4e8
					if (newVNode._original != oldVNode._original) {
						// When we are dealing with a bail because of sCU we have to update
						// the props, state and dirty-state.
						// when we are dealing with strict-equality we don't as the child could still
						// be dirtied see #3883
						c.props = newProps;
						c.state = c._nextState;
						c._dirty = false;
					}

					newVNode._dom = oldVNode._dom;
					newVNode._children = oldVNode._children;
					newVNode._children.some(vnode => {
						if (vnode) vnode._parent = newVNode;
					});

					for (let i = 0; i < c._stateCallbacks.length; i++) {
						c._renderCallbacks.push(c._stateCallbacks[i]);
					}
					c._stateCallbacks = [];

					if (c._renderCallbacks.length) {
						commitQueue.push(c);
					}

					break outer;
				}

				if (c.componentWillUpdate != NULL) {
					c.componentWillUpdate(newProps, c._nextState, componentContext);
				}

				if (isClassComponent && c.componentDidUpdate != NULL) {
					c._renderCallbacks.push(() => {
						c.componentDidUpdate(oldProps, oldState, snapshot);
					});
				}
			}

			c.context = componentContext;
			c.props = newProps;
			c._parentDom = parentDom;
			c._force = false;

			let renderHook = options._render,
				count = 0;
			if (isClassComponent) {
				c.state = c._nextState;
				c._dirty = false;

				if (renderHook) renderHook(newVNode);

				tmp = c.render(c.props, c.state, c.context);

				for (let i = 0; i < c._stateCallbacks.length; i++) {
					c._renderCallbacks.push(c._stateCallbacks[i]);
				}
				c._stateCallbacks = [];
			} else {
				do {
					c._dirty = false;
					if (renderHook) renderHook(newVNode);

					tmp = c.render(c.props, c.state, c.context);

					// Handle setState called in render, see #2553
					c.state = c._nextState;
				} while (c._dirty && ++count < 25);
			}

			// Handle setState called in render, see #2553
			c.state = c._nextState;

			if (c.getChildContext != NULL) {
				globalContext = assign(assign({}, globalContext), c.getChildContext());
			}

			if (isClassComponent && !isNew && c.getSnapshotBeforeUpdate != NULL) {
				snapshot = c.getSnapshotBeforeUpdate(oldProps, oldState);
			}

			let isTopLevelFragment =
				tmp != NULL && tmp.type === Fragment && tmp.key == NULL;
			let renderResult = tmp;

			if (isTopLevelFragment) {
				renderResult = cloneNode(tmp.props.children);
				
				// During hydration, fragments need special handling to ensure
				// we properly match the server-rendered DOM structure
				if (isHydrating && options._fragmentHydration) {
					options._fragmentHydration(renderResult, newVNode);
				}
			}

			oldDom = diffChildren(
				parentDom,
				isArray(renderResult) ? renderResult : [renderResult],
				newVNode,
				oldVNode,
				globalContext,
				namespace,
				excessDomChildren,
				commitQueue,
				oldDom,
				isHydrating,
				refQueue
			);
			
			// After diffing children during hydration, check if we need
			// to handle any hydration-specific cleanup or validation
			if (isHydrating && options._afterChildrenHydration) {
				options._afterChildrenHydration(newVNode, oldVNode);
			}

			c.base = newVNode._dom;

			// We successfully rendered this VNode, unset any stored hydration/bailout state:
			newVNode._flags &= RESET_MODE;

			if (c._renderCallbacks.length) {
				commitQueue.push(c);
			}

			if (clearProcessingException) {
				c._pendingError = c._processingException = NULL;
			}
		} catch (e) {
			newVNode._original = NULL;
			// if hydrating or creating initial tree, bailout preserves DOM:
			if (isHydrating || excessDomChildren != NULL) {
				if (e.then) {
					// Handle suspense during hydration
					newVNode._flags |= isHydrating
						? MODE_HYDRATE | MODE_SUSPENDED
						: MODE_SUSPENDED;

					// Skip comment nodes when finding the next sibling
					while (oldDom && oldDom.nodeType == 8 && oldDom.nextSibling) {
						oldDom = oldDom.nextSibling;
					}

					// Mark this node as processed in excessDomChildren
					if (excessDomChildren && oldDom) {
						const index = excessDomChildren.indexOf(oldDom);
						if (index !== -1) {
							excessDomChildren[index] = NULL;
						}
					}
					
					newVNode._dom = oldDom;
					
					// Notify about suspended hydration
					if (isHydrating && options._hydrationSuspended) {
						options._hydrationSuspended(newVNode, e);
					}
				} else {
					// Handle non-suspense errors during hydration
					if (isHydrating && options._hydrationError) {
						options._hydrationError(e, newVNode, oldVNode);
					}
					
					// Clean up excess DOM nodes
					for (let i = excessDomChildren ? excessDomChildren.length : 0; i--; ) {
						if (excessDomChildren[i]) {
							removeNode(excessDomChildren[i]);
						}
					}
				}
			} else {
				// Non-hydration error handling - preserve the previous DOM state
				newVNode._dom = oldVNode._dom;
				newVNode._children = oldVNode._children;
			}
			options._catchError(e, newVNode, oldVNode);
		}
	} else if (
		excessDomChildren == NULL &&
		newVNode._original == oldVNode._original
	) {
		newVNode._children = oldVNode._children;
		newVNode._dom = oldVNode._dom;
	} else {
		oldDom = newVNode._dom = diffElementNodes(
			oldVNode._dom,
			newVNode,
			oldVNode,
			globalContext,
			namespace,
			excessDomChildren,
			commitQueue,
			isHydrating,
			refQueue
		);
	}

	if ((tmp = options.diffed)) tmp(newVNode);

	// If we're in hydration mode and everything went well,
	// mark this node as successfully hydrated
	if (isHydrating && !(newVNode._flags & MODE_SUSPENDED) && options._hydrationComplete) {
		options._hydrationComplete(newVNode);
	}

	return newVNode._flags & MODE_SUSPENDED ? undefined : oldDom;
}

/**
 * @param {Array<Component>} commitQueue List of components
 * which have callbacks to invoke in commitRoot
 * @param {VNode} root
 */
export function commitRoot(commitQueue, root, refQueue) {
	for (let i = 0; i < refQueue.length; i++) {
		applyRef(refQueue[i], refQueue[++i], refQueue[++i]);
	}

	if (options._commit) options._commit(root, commitQueue);

	commitQueue.some(c => {
		try {
			// @ts-expect-error Reuse the commitQueue variable here so the type changes
			commitQueue = c._renderCallbacks;
			c._renderCallbacks = [];
			commitQueue.some(cb => {
				// @ts-expect-error See above comment on commitQueue
				cb.call(c);
			});
		} catch (e) {
			options._catchError(e, c._vnode);
		}
	});
}

function cloneNode(node) {
	if (typeof node !== 'object' || node == NULL) {
		return node;
	}

	if (isArray(node)) {
		return node.map(cloneNode);
	}

	return assign({}, node);
}

/**
 * Diff two virtual nodes representing DOM element
 * @param {PreactElement} dom The DOM element representing the virtual nodes
 * being diffed
 * @param {VNode} newVNode The new virtual node
 * @param {VNode} oldVNode The old virtual node
 * @param {object} globalContext The current context object
 * @param {string} namespace Current namespace of the DOM node (HTML, SVG, or MathML)
 * @param {Array<PreactElement>} excessDomChildren
 * @param {Array<Component>} commitQueue List of components which have callbacks
 * to invoke in commitRoot
 * @param {boolean} isHydrating Whether or not we are in hydration
 * @param {any[]} refQueue an array of elements needed to invoke refs
 * @returns {PreactElement}
 */
function diffElementNodes(
	dom,
	newVNode,
	oldVNode,
	globalContext,
	namespace,
	excessDomChildren,
	commitQueue,
	isHydrating,
	refQueue
) {
	let oldProps = oldVNode.props;
	let newProps = newVNode.props;
	let nodeType = /** @type {string} */ (newVNode.type);
	/** @type {any} */
	let i;
	/** @type {{ __html?: string }} */
	let newHtml;
	/** @type {{ __html?: string }} */
	let oldHtml;
	/** @type {ComponentChildren} */
	let newChildren;
	let value;
	let inputValue;
	let checked;

	// Tracks entering and exiting namespaces when descending through the tree.
	if (nodeType == 'svg') namespace = SVG_NAMESPACE;
	else if (nodeType == 'math') namespace = MATH_NAMESPACE;
	else if (!namespace) namespace = XHTML_NAMESPACE;

	if (excessDomChildren != NULL) {
		for (i = 0; i < excessDomChildren.length; i++) {
			value = excessDomChildren[i];

			// if newVNode matches an element in excessDomChildren or the `dom`
			// argument matches an element in excessDomChildren, remove it from
			// excessDomChildren so it isn't later removed in diffChildren
			if (
				value &&
				'setAttribute' in value == !!nodeType &&
				(nodeType ? value.localName == nodeType : value.nodeType == 3)
			) {
				dom = value;
				excessDomChildren[i] = NULL;
				break;
			}
		}
	}

	if (dom == NULL) {
		if (nodeType == NULL) {
			return document.createTextNode(newProps);
		}

		dom = document.createElementNS(
			namespace,
			nodeType,
			newProps.is && newProps
		);

		// we are creating a new node, so we can assume this is a new subtree (in
		// case we are hydrating), this deopts the hydrate
		if (isHydrating) {
			if (options._hydrationMismatch) {
				// Provide more context about the mismatch for better debugging
				options._hydrationMismatch(newVNode, excessDomChildren, 'node-creation');
			}
			
			// Instead of completely deopting hydration, try to continue with partial hydration
			// Only set isHydrating to false if we're creating a new element that wasn't expected
			if (excessDomChildren == NULL || excessDomChildren.length === 0) {
				isHydrating = false;
			}
		}
		// we created a new parent, so none of the previously attached children can be reused:
		excessDomChildren = NULL;
	}

	if (nodeType === NULL) {
		// During hydration, we still have to split merged text from SSR'd HTML.
		if (oldProps !== newProps && (!isHydrating || dom.data !== newProps)) {
			// For text nodes, we need to be careful about setting data during hydration
			// Only update if there's an actual difference to avoid unnecessary DOM mutations
			if (!isHydrating || (dom.data !== newProps && newProps != null)) {
				dom.data = newProps;
			}
		}
	} else {
		// If excessDomChildren was not null, repopulate it with the current element's children:
		excessDomChildren = excessDomChildren && slice.call(dom.childNodes);

		oldProps = oldVNode.props || EMPTY_OBJ;

		// If we are in a situation where we are not hydrating but are using
		// existing DOM (e.g. replaceNode) we should read the existing DOM
		// attributes to diff them
		if (excessDomChildren != NULL) {
			// Read existing DOM attributes regardless of hydration state
			// This helps with both hydration and non-hydration cases
			let readProps = {};
			for (i = 0; i < dom.attributes.length; i++) {
				value = dom.attributes[i];
				readProps[value.name] = value.value;
			}
			
			// During hydration, we want to preserve server-rendered attributes
			// unless they're explicitly different in the client render
			if (isHydrating) {
				// Merge read attributes with oldProps for hydration
				oldProps = assign({}, oldProps, readProps);
			} else {
				oldProps = readProps;
			}
		}

		for (i in oldProps) {
			value = oldProps[i];
			if (i == 'children') {
			} else if (i == 'dangerouslySetInnerHTML') {
				oldHtml = value;
			} else if (!(i in newProps)) {
				if (
					(i == 'value' && 'defaultValue' in newProps) ||
					(i == 'checked' && 'defaultChecked' in newProps)
				) {
					continue;
				}
				setProperty(dom, i, NULL, value, namespace);
			}
		}

		// During hydration, we need to be more careful with props diffing
		// to ensure consistency between server and client rendering
		for (i in newProps) {
			value = newProps[i];
			if (i == 'children') {
				newChildren = value;
			} else if (i == 'dangerouslySetInnerHTML') {
				newHtml = value;
			} else if (i == 'value') {
				inputValue = value;
			} else if (i == 'checked') {
				checked = value;
			} else if (
				// During hydration, we should:
				// 1. Always update event handlers (functions)
				// 2. Update props that differ from server-rendered version
				// 3. Handle special cases like style objects that might look different but be equivalent
				((!isHydrating || 
				  typeof value == 'function' || 
				  oldProps[i] === undefined ||
				  (i === 'style' && typeof value === 'object') ||
				  oldProps[i] !== value))
			) {
				// During hydration, only update if there's a real difference
				// or for critical properties that need client-side handling
				if (!isHydrating || 
					typeof value == 'function' || 
					oldProps[i] === undefined || 
					oldProps[i] !== value) {
					setProperty(dom, i, value, oldProps[i], namespace);
				}
			}
		}

		// If the new vnode didn't have dangerouslySetInnerHTML, diff its children
		if (newHtml) {
			// Avoid re-applying the same '__html' if it did not changed between re-render
			if (
				// During hydration, we should preserve the server-rendered HTML
				// unless it's explicitly different from what we want to render
				!isHydrating &&
				(!oldHtml ||
					(newHtml.__html !== oldHtml.__html &&
						newHtml.__html !== dom.innerHTML))
			) {
				dom.innerHTML = newHtml.__html;
			}

			newVNode._children = [];
		} else {
			// Only clear innerHTML if we're not hydrating and there was oldHtml
			if (!isHydrating && oldHtml) dom.innerHTML = '';

			// When diffing children during hydration, we need to be careful about
			// preserving the server-rendered DOM structure while updating the virtual DOM
			diffChildren(
				// @ts-expect-error
				newVNode.type === 'template' ? dom.content : dom,
				isArray(newChildren) ? newChildren : [newChildren],
				newVNode,
				oldVNode,
				globalContext,
				nodeType == 'foreignObject' ? XHTML_NAMESPACE : namespace,
				excessDomChildren,
				commitQueue,
				excessDomChildren
					? excessDomChildren[0]
					: oldVNode._children && getDomSibling(oldVNode, 0),
				isHydrating,
				refQueue
			);

			// Remove children that are not part of any vnode.
			if (excessDomChildren != NULL) {
				for (i = excessDomChildren.length; i--; ) {
					if (excessDomChildren[i] != NULL) {
						// During hydration, we should log when we're removing nodes
						// that weren't expected, as this indicates a hydration mismatch
						if (isHydrating && options._hydrationMismatch) {
							options._hydrationMismatch(
								newVNode, 
								[excessDomChildren[i]], 
								'excess-children'
							);
						}
						removeNode(excessDomChildren[i]);
					}
				}
			}
		}

		// Handle special properties that need client-side updates
		// even during hydration for interactive elements
		i = 'value';
		if (nodeType == 'progress' && inputValue == NULL) {
			dom.removeAttribute('value');
		} else if (
			inputValue !== UNDEFINED &&
			// #2756 For the <progress>-element the initial value is 0,
			// despite the attribute not being present. When the attribute
			// is missing the progress bar is treated as indeterminate.
			// To fix that we'll always update it when it is 0 for progress elements
			(inputValue !== dom[i] ||
				(nodeType == 'progress' && !inputValue) ||
				// This is only for IE 11 to fix <select> value not being updated.
				// To avoid a stale select value we need to set the option.value
				// again, which triggers IE11 to re-evaluate the select value
				(nodeType == 'option' && inputValue !== oldProps[i]) ||
				// Always update form element values during hydration
				// to ensure interactive elements work correctly
				(isHydrating && (
					nodeType === 'input' || 
					nodeType === 'textarea' || 
					nodeType === 'select'
				)))
		) {
			setProperty(dom, i, inputValue, oldProps[i], namespace);
		}

		i = 'checked';
		if (checked !== UNDEFINED && 
			(checked !== dom[i] || 
			 // Always update checkbox/radio during hydration
			 (isHydrating && (nodeType === 'input')))
		) {
			setProperty(dom, i, checked, oldProps[i], namespace);
		}
	}

	return dom;
}

/**
 * Invoke or update a ref, depending on whether it is a function or object ref.
 * @param {Ref<any> & { _unmount?: unknown }} ref
 * @param {any} value
 * @param {VNode} vnode
 */
export function applyRef(ref, value, vnode) {
	try {
		if (typeof ref == 'function') {
			let hasRefUnmount = typeof ref._unmount == 'function';
			if (hasRefUnmount) {
				// @ts-ignore TS doesn't like moving narrowing checks into variables
				ref._unmount();
			}

			if (!hasRefUnmount || value != NULL) {
				// Store the cleanup function on the function
				// instance object itself to avoid shape
				// transitioning vnode
				ref._unmount = ref(value);
			}
		} else ref.current = value;
	} catch (e) {
		options._catchError(e, vnode);
	}
}

/**
 * Unmount a virtual node from the tree and apply DOM changes
 * @param {VNode} vnode The virtual node to unmount
 * @param {VNode} parentVNode The parent of the VNode that initiated the unmount
 * @param {boolean} [skipRemove] Flag that indicates that a parent node of the
 * current element is already detached from the DOM.
 */
export function unmount(vnode, parentVNode, skipRemove) {
	let r;
	if (options.unmount) options.unmount(vnode);

	if ((r = vnode.ref)) {
		if (!r.current || r.current === vnode._dom) {
			applyRef(r, NULL, parentVNode);
		}
	}

	if ((r = vnode._component) != NULL) {
		if (r.componentWillUnmount) {
			try {
				r.componentWillUnmount();
			} catch (e) {
				options._catchError(e, parentVNode);
			}
		}

		r.base = r._parentDom = NULL;
	}

	if ((r = vnode._children)) {
		for (let i = 0; i < r.length; i++) {
			if (r[i]) {
				unmount(
					r[i],
					parentVNode,
					skipRemove || typeof vnode.type != 'function'
				);
			}
		}
	}

	if (!skipRemove) {
		removeNode(vnode._dom);
	}

	vnode._component = vnode._parent = vnode._dom = UNDEFINED;
}

/** The `.render()` method for a PFC backing instance. */
function doRender(props, state, context) {
	return this.constructor(props, context);
}
