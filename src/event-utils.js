const eventPool = [];
const POOL_SIZE = 10;

export function createSyntheticEvent(nativeEvent) {
	let syntheticEvent =
		eventPool.length > 0 ? eventPool.pop() : { isPersistent: false };

	syntheticEvent.nativeEvent = nativeEvent;
	syntheticEvent.type = nativeEvent.type;
	syntheticEvent.target = nativeEvent.target;
	syntheticEvent.currentTarget = nativeEvent.currentTarget;
	syntheticEvent.bubbles = nativeEvent.bubbles;
	syntheticEvent.cancelable = nativeEvent.cancelable;
	syntheticEvent.timeStamp = nativeEvent.timeStamp;
	syntheticEvent.defaultPrevented = nativeEvent.defaultPrevented;
	syntheticEvent.isTrusted = nativeEvent.isTrusted;

	syntheticEvent.preventDefault = () => {
		syntheticEvent.defaultPrevented = true;
		nativeEvent.preventDefault();
	};

	syntheticEvent.stopPropagation = () => {
		nativeEvent.stopPropagation();
	};

	syntheticEvent.persist = () => {
		syntheticEvent.isPersistent = true;
	};

	return syntheticEvent;
}

export function releaseSyntheticEvent(syntheticEvent) {
	if (!syntheticEvent.isPersistent && eventPool.length < POOL_SIZE) {
		Object.keys(syntheticEvent).forEach(key => {
			syntheticEvent[key] = null;
		});
		eventPool.push(syntheticEvent);
	}
}
