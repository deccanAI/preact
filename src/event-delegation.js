import { createSyntheticEvent, releaseSyntheticEvent } from './event-utils';

const delegatedEvents = new Map();

export function addEventDelegation(eventName, handler, dom) {
	if (!delegatedEvents.has(eventName)) {
		delegatedEvents.set(eventName, new Map());
		document.addEventListener(eventName, handleDelegatedEvent, {
			capture: true,
			passive: false
		});
	}

	const handlerMap = delegatedEvents.get(eventName);
	if (!handlerMap.has(dom)) {
		handlerMap.set(dom, new Set());
	}
	handlerMap.get(dom).add(handler);
}

export function removeEventDelegation(eventName, handler, dom) {
	const handlerMap = delegatedEvents.get(eventName);
	if (!handlerMap) return;

	if (dom && handler) {
		const handlers = handlerMap.get(dom);
		if (handlers) {
			handlers.delete(handler);
			if (handlers.size === 0) {
				handlerMap.delete(dom);
			}
		}
	} else if (dom) {
		handlerMap.delete(dom);
	}

	if (handlerMap.size === 0) {
		delegatedEvents.delete(eventName);
		document.removeEventListener(eventName, handleDelegatedEvent, true);
	}
}

function handleDelegatedEvent(event) {
	const handlerMap = delegatedEvents.get(event.type);
	if (!handlerMap) return;

	let target = event.target;
	const syntheticEvent = createSyntheticEvent(event);

	while (target) {
		const handlers = handlerMap.get(target);
		if (handlers) {
			for (const handler of handlers) {
				handler(syntheticEvent);
				if (syntheticEvent.defaultPrevented) {
					break;
				}
			}
		}
		if (syntheticEvent.defaultPrevented) {
			break;
		}
		target = target.parentNode;
	}

	releaseSyntheticEvent(syntheticEvent);
}
