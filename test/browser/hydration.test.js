import { createElement as h, render, hydrate, Component, Fragment } from '../../src/index';
import { setupRerender } from 'preact/test-utils';
import { setupScratch, teardown } from '../_util/helpers';
import { startHydration, endHydration, setHydrationOptions } from '../../src/hydration';

/** @jsx h */

describe('Hydration', () => {
	/** @type {HTMLDivElement} */
	let scratch;
	
	/** @type {() => void} */
	let rerender;
	
	beforeEach(() => {
		scratch = setupScratch();
		rerender = setupRerender();
	});
	
	afterEach(() => {
		teardown(scratch);
	});
	
	it('should hydrate existing DOM', () => {
		scratch.innerHTML = '<div>Hello</div>';
		
		hydrate(<div>Hello</div>, scratch);
		
		expect(scratch.innerHTML).to.equal('<div>Hello</div>');
		// Should not create new DOM nodes
		expect(scratch.childNodes.length).to.equal(1);
		expect(scratch.firstChild.textContent).to.equal('Hello');
	});
	
	it('should handle hydration mismatches', () => {
		scratch.innerHTML = '<div>Server</div>';
		
		let mismatchDetected = false;
		const onHydrationMismatch = (el, expected, actual) => {
			mismatchDetected = true;
			expect(el.tagName).to.equal('DIV');
			expect(expected).to.equal('Client');
			expect(actual).to.equal('Server');
		};
		
		hydrate(<div onHydrationMismatch={onHydrationMismatch}>Client</div>, scratch);
		
		expect(mismatchDetected).to.equal(true);
		// Content should be updated to match client version
		expect(scratch.innerHTML).to.equal('<div>Client</div>');
	});
	
	it('should preserve server content when hydrationMismatch="preserve"', () => {
		scratch.innerHTML = '<div>Server Content</div>';
		
		hydrate(<div hydrationMismatch="preserve">Client Content</div>, scratch);
		
		// Content should remain as server-rendered version
		expect(scratch.innerHTML).to.equal('<div>Server Content</div>');
	});
	
	it('should skip hydration for elements with hydrate="skip"', () => {
		scratch.innerHTML = '<div><span>Server</span></div>';
		
		hydrate(<div hydrate="skip"><span>Client</span></div>, scratch);
		
		// The outer div should be preserved, but inner content should be replaced
		expect(scratch.innerHTML).to.equal('<div><span>Client</span></div>');
	});
	
	it('should call onHydrated when hydration is complete', () => {
		scratch.innerHTML = '<div>Content</div>';
		
		let hydrationComplete = false;
		const onHydrated = (el) => {
			hydrationComplete = true;
			expect(el.tagName).to.equal('DIV');
		};
		
		hydrate(<div onHydrated={onHydrated}>Content</div>, scratch);
		
		expect(hydrationComplete).to.equal(true);
	});
	
	it('should support hydration options', () => {
		scratch.innerHTML = '<div>Server</div>';
		
		// Set hydration options to preserve server content
		setHydrationOptions({
			preserveServerContent: true,
			warnOnMismatches: false
		});
		
		hydrate(<div>Client</div>, scratch);
		
		// Content should remain as server-rendered version
		expect(scratch.innerHTML).to.equal('<div>Server</div>');
		
		// Reset options for other tests
		setHydrationOptions({
			preserveServerContent: false,
			warnOnMismatches: true
		});
	});
	
	it('should support data-hydrate attribute', () => {
		scratch.innerHTML = '<div data-hydrate="root"><span>Server</span></div>';
		
		let hydrated = false;
		const onHydrated = () => {
			hydrated = true;
		};
		
		hydrate(<div onHydrated={onHydrated}><span>Server</span></div>, scratch);
		
		expect(hydrated).to.equal(true);
		expect(scratch.innerHTML).to.equal('<div data-hydrate="root" data-ssr="true"><span data-ssr="true">Server</span></div>');
	});
	
	it('should handle nested components during hydration', () => {
		scratch.innerHTML = '<div><span>Nested</span></div>';
		
		class NestedComponent extends Component {
			render() {
				return <span>Nested</span>;
			}
		}
		
		class ParentComponent extends Component {
			render() {
				return (
					<div>
						<NestedComponent />
					</div>
				);
			}
		}
		
		hydrate(<ParentComponent />, scratch);
		
		expect(scratch.innerHTML).to.equal('<div data-ssr="true"><span data-ssr="true">Nested</span></div>');
	});
	
	it('should handle fragments during hydration', () => {
		scratch.innerHTML = '<div><span>A</span><span>B</span></div>';
		
		hydrate(
			<div>
				<Fragment>
					<span>A</span>
					<span>B</span>
				</Fragment>
			</div>,
			scratch
		);
		
		expect(scratch.innerHTML).to.equal('<div data-ssr="true"><span data-ssr="true">A</span><span data-ssr="true">B</span></div>');
	});
});
