const pendingUnmounts = new Map();
let isUnmounting = false;

export function scheduleUnmount(component) {
	if (!pendingUnmounts.has(component)) {
		pendingUnmounts.set(component, {
			cleanupFns: [],
			timeoutIds: new Set(),
			intervalIds: new Set(),
			asyncOperations: new WeakSet()
		});
	}
	return pendingUnmounts.get(component);
}

export function registerCleanup(component, cleanupFn) {
	const unmountData = scheduleUnmount(component);
	unmountData.cleanupFns.push(cleanupFn);
}

export function registerTimeout(component, timeoutId) {
	const unmountData = scheduleUnmount(component);
	unmountData.timeoutIds.add(timeoutId);
}

export function registerInterval(component, intervalId) {
	const unmountData = scheduleUnmount(component);
	unmountData.intervalIds.add(intervalId);
}

export function registerAsyncOperation(component, promise) {
	const unmountData = scheduleUnmount(component);
	unmountData.asyncOperations.add(promise);

	promise.finally(() => {
		if (unmountData.asyncOperations.has(promise)) {
			unmountData.asyncOperations.delete(promise);
		}
	});
}

export function performUnmount(component) {
	const unmountData = pendingUnmounts.get(component);
	if (!unmountData) return;

	isUnmounting = true;

	// Clear timeouts
	unmountData.timeoutIds.forEach(id => clearTimeout(id));

	// Clear intervals
	unmountData.intervalIds.forEach(id => clearInterval(id));

	// Run cleanup functions
	unmountData.cleanupFns.forEach(fn => {
		try {
			fn();
		} catch (e) {
			console.error('Error in cleanup function:', e);
		}
	});

	pendingUnmounts.delete(component);
	isUnmounting = false;
}

export function isComponentUnmounting() {
	return isUnmounting;
}
