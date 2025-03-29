import { createElement as h, render } from 'preact';
import { setupScratch, teardown } from '../../../test/_util/helpers';
import { useEffect, useState } from '../../src';

/** @jsx h */

describe('Object.is comparison in hooks', () => {
	let scratch;

	beforeEach(() => {
		scratch = setupScratch();
	});

	afterEach(() => {
		teardown(scratch);
	});

	it('should handle NaN values correctly', () => {
		let effectCount = 0;
		let renderCount = 0;

		function App() {
			const [value, setValue] = useState(NaN);
			renderCount++;

			useEffect(() => {
				effectCount++;
			}, [value]);

			return h('div', {
				onClick: () => setValue(NaN)
			});
		}

		render(h(App), scratch);
		expect(effectCount).to.equal(1);
		expect(renderCount).to.equal(1);

		scratch.firstChild.click();
		expect(effectCount).to.equal(1); // Should not trigger effect
		expect(renderCount).to.equal(2);
	});

	it('should handle -0 and +0 values correctly', () => {
		let effectCount = 0;
		let renderCount = 0;

		function App() {
			const [value, setValue] = useState(-0);
			renderCount++;

			useEffect(() => {
				effectCount++;
			}, [value]);

			return h('div', {
				onClick: () => setValue(+0)
			});
		}

		render(h(App), scratch);
		expect(effectCount).to.equal(1);
		expect(renderCount).to.equal(1);

		scratch.firstChild.click();
		expect(effectCount).to.equal(2); // Should trigger effect
		expect(renderCount).to.equal(2);
	});
});
