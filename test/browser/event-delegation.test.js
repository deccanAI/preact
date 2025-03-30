import { createElement, render } from 'preact';
import { setupScratch, teardown } from '../_util/helpers';
import {
	addEventDelegation,
	removeEventDelegation
} from '../../src/event-delegation';

describe('Event Delegation', () => {
	let scratch;

	beforeEach(() => {
		scratch = setupScratch();
	});

	afterEach(() => {
		teardown(scratch);
	});

	it('should properly handle synthetic events', () => {
		let eventData = null;
		const handler = e => {
			eventData = {
				type: e.type,
				target: e.target,
				currentTarget: e.currentTarget,
				isPersistent: e.isPersistent,
				defaultPrevented: e.defaultPrevented
			};
		};

		const Button = () => <button onClick={handler}>Click Me</button>;

		render(<Button />, scratch);

		const button = scratch.querySelector('button');
		button.click();

		expect(eventData).to.not.be.null;
		expect(eventData.type).to.equal('click');
		expect(eventData.target).to.equal(button);
		expect(eventData.defaultPrevented).to.be.false;
	});

	it('should clean up event listeners on unmount', () => {
		const handler = () => {};
		const dom = document.createElement('div');

		addEventDelegation('click', handler, dom);
		expect(delegatedEvents.get('click').has(dom)).to.be.true;

		removeEventDelegation('click', handler, dom);
		expect(delegatedEvents.get('click')).to.be.undefined;
	});

	it('should handle event bubbling correctly', () => {
		const events = [];
		const Parent = () => (
			<div onClick={() => events.push('parent')}>
				<Child />
			</div>
		);

		const Child = () => (
			<button
				onClick={e => {
					events.push('child');
					e.stopPropagation();
				}}
			>
				Click Me
			</button>
		);

		render(<Parent />, scratch);

		const button = scratch.querySelector('button');
		button.click();

		expect(events).to.deep.equal(['child']);
	});
});
