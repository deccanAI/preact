import { effect } from './signal';

const componentSubscriptions = new WeakMap();

export function withSignals(Component) {
	return function SignalWrapper(props) {
		let cleanup;

		this.componentWillMount = () => {
			cleanup = effect(() => {
				if (this.base) {
					this.setState({});
				}
			});
		};

		this.componentWillUnmount = () => {
			if (cleanup) {
				cleanup();
				cleanup = null;
			}
		};

		this.render = () => Component(props);
	};
}
