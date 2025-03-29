# Ref Forwarding in Preact

Preact now automatically forwards refs through function components, making it easier to work with refs in your component tree. This behavior aligns with React's ref forwarding functionality while maintaining Preact's lightweight nature.

## Automatic Ref Forwarding

Function components now automatically forward refs to their rendered DOM elements:

```jsx
const Button = props => <button {...props} />;

// The ref will automatically point to the button DOM element
const buttonRef = createRef();
<Button ref={buttonRef} />;
```

## Class Components

Class components maintain their traditional ref behavior, where the ref points to the component instance:

```jsx
class Button extends Component {
    render(props) {
        return <button {...props} />;
    }
}

// The ref will point to the Button component instance
const buttonRef = createRef();
<Button ref={buttonRef} />;
```

## Manual Ref Forwarding

For more complex cases where you need custom ref handling, you can use the `forwardRef` utility:

```jsx
import { forwardRef } from 'preact';

const FancyButton = forwardRef((props, ref) => (
    <button ref={ref} className="fancy" {...props} />
));

// The ref will be forwarded to the button element
const buttonRef = createRef();
<FancyButton ref={buttonRef} />;
```

## Best Practices

- Use automatic ref forwarding for simple function components
- Use `forwardRef` when you need custom ref handling
- Remember that class component refs still point to component instances
- Avoid overusing refs; prefer props and state for most use cases