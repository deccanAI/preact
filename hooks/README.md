# Preact Hooks

A collection of standard hooks for Preact.

## Dependency Comparison

As of version [NEW_VERSION], hook dependency comparisons use `Object.is()` for equality checks, matching React's behavior. This means:

- `NaN` is considered equal to `NaN`
- `-0` is not considered equal to `+0`
- All other values are compared using strict equality (`===`)

This change ensures consistent behavior between Preact and React when dealing with edge cases in hook dependencies.

## Example

```jsx
import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';

function Example() {
  const [count, setCount] = useState(NaN);
  
  useEffect(() => {
    // This effect will only run once, even if setCount(NaN) is called again
    console.log('Effect ran');
  }, [count]);

  return <button onClick={() => setCount(NaN)}>Update</button>;
}
```