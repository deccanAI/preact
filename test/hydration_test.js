const { h, render, hydrate } = require('preact');

// Mock DOM environment
const parentDom = document.createElement('div');
document.body.appendChild(parentDom);

// Server-rendered content
parentDom.innerHTML = `
  <div class="container">
    <h1>Hello World</h1>
    <p>This is a test</p>
    <div class="dynamic">Initial content</div>
  </div>
`;

// Client-side component
const App = ({ dynamic }) =>
	h(
		'div',
		{ class: 'container' },
		h('h1', null, 'Hello World'),
		h('p', null, 'This is a test'),
		h('div', { class: 'dynamic' }, dynamic)
	);

// Hydrate with different content
hydrate(h(App, { dynamic: 'Updated content' }), parentDom);

// Check for hydration mismatches
console.log('DOM after hydration:', parentDom.innerHTML);
