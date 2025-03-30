import { enqueueRender } from './component';
import { NULL } from './constants';

export let i = 0;

export function createContext(defaultValue) {
	function Context(props) {
		if (!this.getChildContext) {
			/** @type {Set<import('./internal').Component> | null} */
			let subs = new Set();
			let ctx = {};
			ctx[Context._id] = this;
			
			// Track if we're in hydration mode
			this._hydrating = typeof document !== 'undefined' && document.readyState !== 'complete';

			this.getChildContext = () => ctx;

			this.componentWillUnmount = () => {
				subs = NULL;
			};

			this.shouldComponentUpdate = function (_props) {
				// @ts-expect-error even
				if (this.props.value !== _props.value) {
					// During hydration, we need to be more careful about updates
					// to avoid unnecessary re-renders that could cause mismatches
					const isHydrating = this._hydrating && document.readyState !== 'complete';
					
					subs.forEach(c => {
						// Mark component for update
						c._force = true;
						
						// Track if this update happened during hydration
						if (isHydrating) {
							c._hydrationMismatch = true;
						}
						
						enqueueRender(c);
					});
					
					// After first render, we're no longer in hydration mode
					this._hydrating = false;
				}
			};

			this.sub = c => {
				subs.add(c);
				let old = c.componentWillUnmount;
				c.componentWillUnmount = () => {
					if (subs) {
						subs.delete(c);
					}
					if (old) old.call(c);
				};
			};
		}

		return props.children;
	}

	Context._id = '__cC' + i++;
	Context._defaultValue = defaultValue;

	/** @type {import('./internal').FunctionComponent} */
	Context.Consumer = (props, contextValue) => {
		// If we're in a hydration mismatch situation, use the default value
		// to avoid layout shifts during hydration
		if (props._hydrationMismatch) {
			return props.children(Context._defaultValue);
		}
		return props.children(contextValue);
	};

	// we could also get rid of _contextRef entirely
	Context.Provider =
		Context._contextRef =
		Context.Consumer.contextType =
			Context;

	return Context;
}
