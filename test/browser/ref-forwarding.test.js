import {
	createElement as h,
	render,
	createRef,
	Component
} from '../../src/index';
import { setupScratch, teardown } from '../_util/helpers';

/** @jsx h */

describe('Ref Forwarding', () => {
	let scratch;

	beforeEach(() => {
		scratch = setupScratch();
	});

	afterEach(() => {
		teardown(scratch);
	});

	it('should automatically forward refs for function components', () => {
		const ref = createRef();
		const Wrapper = props => <div {...props} />;
		render(<Wrapper ref={ref} />, scratch);

		expect(ref.current).to.equal(scratch.firstChild);
	});

	it('should not forward refs for class components', () => {
		const ref = createRef();
		class Wrapper extends Component {
			render(props) {
				return <div {...props} />;
			}
		}
		render(<Wrapper ref={ref} />, scratch);

		expect(ref.current).to.be.instanceOf(Wrapper);
	});

	it('should work with nested components', () => {
		const ref = createRef();
		const Inner = props => <div {...props} />;
		const Outer = props => <Inner {...props} />;
		render(<Outer ref={ref} />, scratch);

		expect(ref.current).to.equal(scratch.firstChild);
	});

	it('should maintain component instance with forwarded ref', () => {
		let instance;
		const ref = createRef();
		class Inner extends Component {
			constructor(props) {
				super(props);
				instance = this;
			}
			render() {
				return <div />;
			}
		}
		const Outer = props => <Inner {...props} />;
		render(<Outer ref={ref} />, scratch);

		expect(ref.current).to.equal(instance);
	});
});
