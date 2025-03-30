import { h, hydrate, render } from '../src/index';

// Create a server-rendered HTML string
const serverHtml = `
  <div class="container">
    <h1>Hello World</h1>
    <p>This is a test</p>
    <div class="dynamic">Server Content</div>
  </div>
`;

// Create a container and set its HTML
const container = document.createElement('div');
container.innerHTML = serverHtml;

// Create the client-side virtual DOM that doesn't match server HTML
const clientVdom = h('div', { class: 'container' }, [
	h('h1', null, 'Hello World'),
	h('p', null, 'This is a test'),
	h('div', { class: 'dynamic' }, 'Client Content') // Content mismatch
]);

// Try to hydrate
hydrate(clientVdom, container);

// Check if hydration was successful
console.log('Container after hydration:', container.innerHTML);
console.log(
	'Dynamic content:',
	container.querySelector('.dynamic').textContent
);
