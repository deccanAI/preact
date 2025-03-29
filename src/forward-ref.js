import { assign } from './util';
import { NULL } from './constants';

/**
 * Forward ref implementation for Preact components
 * @param {Function} render The render function that accepts props and ref
 * @returns {Function} A component that forwards refs
 */
export function forwardRef(render) {
	function Forwarded(props) {
		const ref = props.ref;
		delete props.ref;
		return render(props, ref);
	}
	Forwarded.displayName =
		'ForwardRef(' + (render.displayName || render.name) + ')';
	return Forwarded;
}
