/**
 * @typedef {import('./internal').VNode} VNode
 */

/**
 * Hydration utilities for Preact
 */

/**
 * Handle hydration mismatches between server and client rendering
 * @param {VNode} vnode The current vnode being hydrated
 * @param {Array<Element>} [domChildren] Any excess DOM children found
 * @param {string} [mismatchType] The type of mismatch that occurred
 */
export function handleHydrationMismatch(vnode, domChildren, mismatchType) {
  console.warn(
    `Hydration mismatch: ${mismatchType || 'unknown'} for`,
    vnode,
    domChildren
  );
  
  // We could implement more sophisticated recovery strategies here
  // For now, we'll just log the issue
}

/**
 * Handle resuming hydration after a suspense
 * @param {VNode} newVNode The new vnode
 * @param {VNode} oldVNode The old vnode
 */
export function resumeHydration(newVNode, oldVNode) {
  // Implement special handling for resuming hydration after suspense
  // This is a hook for future improvements
}

/**
 * Special handling for Fragment hydration
 * @param {VNode} vnode The Fragment vnode
 * @param {VNode} parentVNode The parent vnode
 */
export function handleFragmentHydration(vnode, parentVNode) {
  // Special handling for fragments during hydration
  // This helps with proper matching of fragment children
}

/**
 * Called after children have been hydrated
 * @param {VNode} newVNode The new vnode
 * @param {VNode} oldVNode The old vnode
 */
export function afterChildrenHydration(newVNode, oldVNode) {
  // Post-processing after children have been hydrated
  // This is useful for cleanup or validation
}

/**
 * Handle suspended hydration (e.g., when Suspense is used)
 * @param {VNode} vnode The vnode that suspended
 * @param {Error} error The error or promise that caused suspension
 */
export function handleHydrationSuspended(vnode, error) {
  // Handle suspended hydration, potentially storing state
  // to resume later
}

/**
 * Called when hydration is complete for a subtree
 * @param {VNode} vnode The vnode that was hydrated
 */
export function completeHydration(vnode) {
  // Mark hydration as complete and perform any necessary cleanup
}

/**
 * Handle errors during hydration
 * @param {Error} error The error that occurred
 * @param {VNode} newVNode The new vnode
 * @param {VNode} oldVNode The old vnode
 */
export function handleHydrationError(error, newVNode, oldVNode) {
  console.error('Hydration error:', error);
  // Implement recovery strategies for hydration errors
}

/**
 * Initialize hydration hooks in options
 * @param {object} options The Preact options object
 */
export function setupHydrationHooks(options) {
  options._hydrationMismatch = handleHydrationMismatch;
  options._hydrationResume = resumeHydration;
  options._fragmentHydration = handleFragmentHydration;
  options._afterChildrenHydration = afterChildrenHydration;
  options._hydrationSuspended = handleHydrationSuspended;
  options._hydrationComplete = completeHydration;
  options._hydrationError = handleHydrationError;
}
