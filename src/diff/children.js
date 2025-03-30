import { diff, unmount, applyRef } from './index';
import { createVNode, Fragment } from '../create-element';
import {
	EMPTY_OBJ,
	EMPTY_ARR,
	INSERT_VNODE,
	MATCHED,
	UNDEFINED,
	NULL
} from '../constants';
import { isArray } from '../util';
import { getDomSibling } from '../component';

/**
 * @typedef {import('../internal').ComponentChildren} ComponentChildren
 * @typedef {import('../internal').Component} Component
 * @typedef {import('../internal').PreactElement} PreactElement
 * @typedef {import('../internal').VNode} VNode
 */

/**
 * Diff the children of a virtual node
 * @param {PreactElement} parentDom The DOM element whose children are being
 * diffed
 * @param {ComponentChildren[]} renderResult
 * @param {VNode} newParentVNode The new virtual node whose children should be
 * diff'ed against oldParentVNode
 * @param {VNode} oldParentVNode The old virtual node whose children should be
 * diff'ed against newParentVNode
 * @param {object} globalContext The current context object - modified by
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
export function diffChildren(
	parentDom,
	renderResult,
	newParentVNode,
	oldParentVNode,
	globalContext,
	namespace,
	excessDomChildren,
	commitQueue,
	oldDom,
	isHydrating,
	refQueue
) {
	let i,
		/** @type {VNode} */
		oldVNode,
		/** @type {VNode} */
		childVNode,
		/** @type {PreactElement} */
		newDom,
		/** @type {PreactElement} */
		firstChildDom;

	// This is a compression of oldParentVNode!=null && oldParentVNode != EMPTY_OBJ && oldParentVNode._children || EMPTY_ARR
	// as EMPTY_OBJ._children should be `undefined`.
	/** @type {VNode[]} */
	let oldChildren = (oldParentVNode && oldParentVNode._children) || EMPTY_ARR;

	let newChildrenLength = renderResult.length;
	
	// Fast path: if no children or identical children, we can skip most of the work
	if (newChildrenLength === 0) {
		// If we had children before but not anymore, we need to unmount them
		if (oldChildren.length) {
			for (i = 0; i < oldChildren.length; i++) {
				if (oldChildren[i] != NULL) {
					unmount(oldChildren[i], oldChildren[i]);
				}
			}
		}
		newParentVNode._dom = null;
		return null;
	}
	
	// Construct the new children array and prepare for diffing
	oldDom = constructNewChildrenArray(
		newParentVNode,
		renderResult,
		oldChildren,
		oldDom,
		newChildrenLength
	);

	// Process each new child
	for (i = 0; i < newChildrenLength; i++) {
		childVNode = newParentVNode._children[i];
		if (childVNode == NULL) continue;

		// At this point, constructNewChildrenArray has assigned _index to be the
		// matchingIndex for this VNode's oldVNode (or -1 if there is no oldVNode).
		if (childVNode._index === -1) {
			oldVNode = EMPTY_OBJ;
		} else {
			oldVNode = oldChildren[childVNode._index] || EMPTY_OBJ;
		}

		// Update childVNode._index to its final index
		childVNode._index = i;

		// Skip diffing if the nodes are identical (same object reference)
		// This is a performance optimization for cases where a parent re-renders
		// but children don't actually change
		if (childVNode === oldVNode && childVNode._dom) {
			newDom = childVNode._dom;
		} else {
			// Morph the old element into the new one, but don't append it to the dom yet
			let result = diff(
				parentDom,
				childVNode,
				oldVNode,
				globalContext,
				namespace,
				excessDomChildren,
				commitQueue,
				oldDom,
				isHydrating,
				refQueue
			);

			// Handle refs
			newDom = childVNode._dom;
			if (childVNode.ref && oldVNode.ref != childVNode.ref) {
				if (oldVNode.ref) {
					applyRef(oldVNode.ref, NULL, childVNode);
				}
				refQueue.push(
					childVNode.ref,
					childVNode._component || newDom,
					childVNode
				);
			}

			// Handle function component result
			if (typeof childVNode.type == 'function' && result !== UNDEFINED) {
				oldDom = result;
			}
		}

		// Track the first DOM node for the parent
		if (firstChildDom == NULL && newDom != NULL) {
			firstChildDom = newDom;
		}

		// Determine if we need to insert this node
		if (
			childVNode._flags & INSERT_VNODE ||
			oldVNode._children === childVNode._children
		) {
			oldDom = insert(childVNode, oldDom, parentDom);
		} else if (newDom) {
			oldDom = newDom.nextSibling;
		}

		// Unset diffing flags
		childVNode._flags &= ~(INSERT_VNODE | MATCHED);
	}

	newParentVNode._dom = firstChildDom;

	return oldDom;
}

/**
 * @param {VNode} newParentVNode
 * @param {ComponentChildren[]} renderResult
 * @param {VNode[]} oldChildren
 */
function constructNewChildrenArray(
	newParentVNode,
	renderResult,
	oldChildren,
	oldDom,
	newChildrenLength
) {
	/** @type {number} */
	let i;
	/** @type {VNode} */
	let childVNode;
	/** @type {VNode} */
	let oldVNode;

	let oldChildrenLength = oldChildren.length,
		remainingOldChildren = oldChildrenLength;

	let skew = 0;
	
	// Fast path for common case: no children changed
	let hasIdenticalChildren = newChildrenLength === oldChildrenLength;
	
	// Pre-allocate the new children array
	newParentVNode._children = new Array(newChildrenLength);
	
	for (i = 0; i < newChildrenLength; i++) {
		// @ts-expect-error We are reusing the childVNode variable to hold both the
		// pre and post normalized childVNode
		childVNode = renderResult[i];

		if (
			childVNode == NULL ||
			typeof childVNode == 'boolean' ||
			typeof childVNode == 'function'
		) {
			newParentVNode._children[i] = NULL;
			hasIdenticalChildren = false;
			continue;
		}
		// If this newVNode is being reused (e.g. <div>{reuse}{reuse}</div>) in the same diff,
		// or we are rendering a component (e.g. setState) copy the oldVNodes so it can have
		// it's own DOM & etc. pointers
		else if (
			typeof childVNode == 'string' ||
			typeof childVNode == 'number' ||
			// eslint-disable-next-line valid-typeof
			typeof childVNode == 'bigint' ||
			childVNode.constructor == String
		) {
			childVNode = newParentVNode._children[i] = createVNode(
				NULL,
				childVNode,
				NULL,
				NULL,
				NULL
			);
			// Text nodes can't be identical to previous render
			hasIdenticalChildren = false;
		} else if (isArray(childVNode)) {
			childVNode = newParentVNode._children[i] = createVNode(
				Fragment,
				{ children: childVNode },
				NULL,
				NULL,
				NULL
			);
			hasIdenticalChildren = false;
		} else if (childVNode.constructor === UNDEFINED && childVNode._depth > 0) {
			// VNode is already in use, clone it. This can happen in the following
			// scenario:
			//   const reuse = <div />
			//   <div>{reuse}<span />{reuse}</div>
			childVNode = newParentVNode._children[i] = createVNode(
				childVNode.type,
				childVNode.props,
				childVNode.key,
				childVNode.ref ? childVNode.ref : NULL,
				childVNode._original
			);
			hasIdenticalChildren = false;
		} else {
			childVNode = newParentVNode._children[i] = childVNode;
			
			// Check if this child is identical to the one at the same position in oldChildren
			if (hasIdenticalChildren && i < oldChildrenLength) {
				const oldChild = oldChildren[i];
				if (!oldChild || 
					childVNode.key !== oldChild.key || 
					childVNode.type !== oldChild.type) {
					hasIdenticalChildren = false;
				}
			}
		}

		const skewedIndex = i + skew;
		childVNode._parent = newParentVNode;
		childVNode._depth = newParentVNode._depth + 1;

		// Fast path: if we've determined all children are identical, we can skip the matching process
		if (hasIdenticalChildren && i < oldChildrenLength) {
			childVNode._index = i;
			oldVNode = oldChildren[i];
			if (oldVNode) {
				oldVNode._flags |= MATCHED;
				remainingOldChildren--;
			}
			continue;
		}

		// Temporarily store the matchingIndex on the _index property so we can pull
		// out the oldVNode in diffChildren. We'll override this to the VNode's
		// final index after using this property to get the oldVNode
		const matchingIndex = (childVNode._index = findMatchingIndex(
			childVNode,
			oldChildren,
			skewedIndex,
			remainingOldChildren
		));

		oldVNode = NULL;
		if (matchingIndex !== -1) {
			oldVNode = oldChildren[matchingIndex];
			remainingOldChildren--;
			if (oldVNode) {
				oldVNode._flags |= MATCHED;
			}
		}

		// Here, we define isMounting for the purposes of the skew diffing
		// algorithm. Nodes that are unsuspending are considered mounting and we detect
		// this by checking if oldVNode._original === null
		const isMounting = oldVNode == NULL || oldVNode._original === NULL;

		if (isMounting) {
			if (matchingIndex == -1) {
				// When the array of children is growing we need to decrease the skew
				// as we are adding a new element to the array.
				// Example:
				// [1, 2, 3] --> [0, 1, 2, 3]
				// oldChildren   newChildren
				//
				// The new element is at index 0, so our skew is 0,
				// we need to decrease the skew as we are adding a new element.
				// The decrease will cause us to compare the element at position 1
				// with value 1 with the element at position 0 with value 0.
				//
				// A linear concept is applied when the array is shrinking,
				// if the length is unchanged we can assume that no skew
				// changes are needed.
				if (newChildrenLength > oldChildrenLength) {
					skew--;
				} else if (newChildrenLength < oldChildrenLength) {
					skew++;
				}
			}

			// If we are mounting a DOM VNode, mark it for insertion
			if (typeof childVNode.type != 'function') {
				childVNode._flags |= INSERT_VNODE;
			}
		} else if (matchingIndex != skewedIndex) {
			// Optimize for common patterns:
			// 1. Small shifts (by 1 position)
			if (matchingIndex == skewedIndex - 1) {
				skew--;
			} else if (matchingIndex == skewedIndex + 1) {
				skew++;
			} 
			// 2. Larger shifts
			else {
				// Calculate optimal skew adjustment based on the direction of movement
				if (matchingIndex > skewedIndex) {
					skew--;
				} else {
					skew++;
				}

				// Only mark for insertion if we actually need to move the DOM node
				// This avoids unnecessary DOM operations
				childVNode._flags |= INSERT_VNODE;
			}
		}
	}

	// Remove remaining oldChildren if there are any. Loop forwards so that as we
	// unmount DOM from the beginning of the oldChildren, we can adjust oldDom to
	// point to the next child, which needs to be the first DOM node that won't be
	// unmounted.
	if (remainingOldChildren) {
		for (i = 0; i < oldChildrenLength; i++) {
			oldVNode = oldChildren[i];
			if (oldVNode != NULL && (oldVNode._flags & MATCHED) == 0) {
				if (oldVNode._dom == oldDom) {
					oldDom = getDomSibling(oldVNode);
				}

				unmount(oldVNode, oldVNode);
			}
		}
	}

	return oldDom;
}

/**
 * @param {VNode} parentVNode
 * @param {PreactElement} oldDom
 * @param {PreactElement} parentDom
 * @returns {PreactElement}
 */
function insert(parentVNode, oldDom, parentDom) {
	// Note: VNodes in nested suspended trees may be missing _children.

	if (typeof parentVNode.type == 'function') {
		let children = parentVNode._children;
		if (!children) return oldDom;
		
		// Fast path: if there's only one child, avoid the loop
		if (children.length === 1 && children[0]) {
			children[0]._parent = parentVNode;
			return insert(children[0], oldDom, parentDom);
		}
		
		// Process multiple children
		for (let i = 0; i < children.length; i++) {
			if (children[i]) {
				// If we enter this code path on sCU bailout, where we copy
				// oldVNode._children to newVNode._children, we need to update the old
				// children's _parent pointer to point to the newVNode (parentVNode
				// here).
				children[i]._parent = parentVNode;
				oldDom = insert(children[i], oldDom, parentDom);
			}
		}

		return oldDom;
	} else if (parentVNode._dom != oldDom) {
		// Skip DOM insertion if the node is already in the right place
		if (oldDom && parentVNode._dom && oldDom === parentVNode._dom.nextSibling) {
			oldDom = parentVNode._dom;
		} else {
			// Check if we need to do an actual DOM insertion
			if (oldDom && parentVNode.type && !parentDom.contains(oldDom)) {
				oldDom = getDomSibling(parentVNode);
			}
			
			// Only perform the insertion if the DOM node exists
			if (parentVNode._dom) {
				parentDom.insertBefore(parentVNode._dom, oldDom || NULL);
				oldDom = parentVNode._dom;
			}
		}
	}

	// Skip comment nodes when looking for the next sibling
	do {
		oldDom = oldDom && oldDom.nextSibling;
	} while (oldDom != NULL && oldDom.nodeType == 8);

	return oldDom;
}

/**
 * Flatten and loop through the children of a virtual node
 * @param {ComponentChildren} children The unflattened children of a virtual
 * node
 * @returns {VNode[]}
 */
export function toChildArray(children, out) {
	out = out || [];
	if (children == NULL || typeof children == 'boolean') {
	} else if (isArray(children)) {
		children.some(child => {
			toChildArray(child, out);
		});
	} else {
		out.push(children);
	}
	return out;
}

/**
 * @param {VNode} childVNode
 * @param {VNode[]} oldChildren
 * @param {number} skewedIndex
 * @param {number} remainingOldChildren
 * @returns {number}
 */
function findMatchingIndex(
	childVNode,
	oldChildren,
	skewedIndex,
	remainingOldChildren
) {
	const key = childVNode.key;
	const type = childVNode.type;
	let oldVNode = oldChildren[skewedIndex];

	// Fast path: direct match at the expected index
	if (
		oldVNode &&
		key == oldVNode.key &&
		type === oldVNode.type &&
		(oldVNode._flags & MATCHED) == 0
	) {
		return skewedIndex;
	}

	// Fast path: null child with no key
	if (oldVNode === NULL && childVNode.key == null) {
		return skewedIndex;
	}

	// We only need to perform a search if there are more children
	// (remainingOldChildren) to search. However, if the oldVNode we just looked
	// at skewedIndex was not already used in this diff, then there must be at
	// least 1 other (so greater than 1) remainingOldChildren to attempt to match
	// against.
	let shouldSearch =
		remainingOldChildren >
		(oldVNode != NULL && (oldVNode._flags & MATCHED) == 0 ? 1 : 0);

	if (shouldSearch) {
		// Optimize for keyed elements by checking keys first
		if (key != null) {
			// First check if we have a direct key match at the expected index
			// (already handled in the fast path above)
			
			// Search outward from the expected position
			let x = skewedIndex - 1;
			let y = skewedIndex + 1;
			
			// Prioritize nearby matches to optimize for small shifts
			while (x >= 0 || y < oldChildren.length) {
				if (x >= 0) {
					oldVNode = oldChildren[x];
					if (
						oldVNode &&
						(oldVNode._flags & MATCHED) == 0 &&
						key == oldVNode.key &&
						type === oldVNode.type
					) {
						return x;
					}
					x--;
				}

				if (y < oldChildren.length) {
					oldVNode = oldChildren[y];
					if (
						oldVNode &&
						(oldVNode._flags & MATCHED) == 0 &&
						key == oldVNode.key &&
						type === oldVNode.type
					) {
						return y;
					}
					y++;
				}
			}
		} else {
			// For unkeyed elements, we need to be more careful to avoid
			// unintended state reuse. Only search nearby positions.
			let x = skewedIndex - 1;
			let y = skewedIndex + 1;
			
			// Limit search radius for unkeyed elements to avoid incorrect matches
			const searchRadius = 3;
			let searchCount = 0;
			
			while ((x >= 0 || y < oldChildren.length) && searchCount < searchRadius) {
				searchCount++;
				
				if (x >= 0) {
					oldVNode = oldChildren[x];
					if (
						oldVNode &&
						(oldVNode._flags & MATCHED) == 0 &&
						oldVNode.key == null &&
						type === oldVNode.type
					) {
						return x;
					}
					x--;
				}

				if (y < oldChildren.length) {
					oldVNode = oldChildren[y];
					if (
						oldVNode &&
						(oldVNode._flags & MATCHED) == 0 &&
						oldVNode.key == null &&
						type === oldVNode.type
					) {
						return y;
					}
					y++;
				}
			}
		}
	}

	return -1;
}
