import { h, hydrate, render } from '../src/index';
import { setupScratch, teardown } from './util';

describe('Hydration', () => {
	let scratch;

	beforeEach(() => {
		scratch = setupScratch();
	});

	afterEach(() => {
		teardown(scratch);
	});

	it('should handle hydration mismatches gracefully', () => {
		// Server-rendered content
		scratch.innerHTML = `
      <div class="parent">
        <span>Hello</span>
        <p class="child">World</p>
      </div>
    `;

		// Client-side render with different content
		const vnode = h('div', { class: 'parent' }, [
			h('span', null, 'Hi'),
			h('p', { class: 'child' }, 'Earth')
		]);

		hydrate(vnode, scratch);

		// Check that hydration worked and content was updated
		expect(scratch.innerHTML).to.contain('Hi');
		expect(scratch.innerHTML).to.contain('Earth');
	});
});
