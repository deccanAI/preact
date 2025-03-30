import { EMPTY_OBJ } from './constants';

const HYDRATION_CACHE = new WeakMap();

export function createHydrationCache(dom) {
	if (!dom || !dom.nodeType) return null;

	const cache = {
		nodeType: dom.nodeType,
		nodeName: dom.nodeName.toLowerCase(),
		attributes: {},
		childNodes: Array.from(dom.childNodes).map(createHydrationCache)
	};

	if (dom.attributes) {
		for (let i = 0; i < dom.attributes.length; i++) {
			const attr = dom.attributes[i];
			cache.attributes[attr.name] = attr.value;
		}
	}

	HYDRATION_CACHE.set(dom, cache);
	return cache;
}

export function validateHydration(vnode, dom) {
	if (!dom || !dom.nodeType) return false;

	const cache = HYDRATION_CACHE.get(dom);
	if (!cache) return false;

	// Text nodes
	if (vnode.type === null) {
		return cache.nodeType === 3;
	}

	// Element nodes
	if (typeof vnode.type === 'string') {
		return cache.nodeName === vnode.type.toLowerCase();
	}

	return true;
}

export function getHydrationMismatch(vnode, dom) {
	if (!dom || !dom.nodeType) return 'Missing DOM node';

	const cache = HYDRATION_CACHE.get(dom);
	if (!cache) return 'No hydration cache found';

	if (vnode.type === null) {
		if (cache.nodeType !== 3) {
			return `Expected text node but found ${cache.nodeName}`;
		}
		return null;
	}

	if (typeof vnode.type === 'string') {
		if (cache.nodeName !== vnode.type.toLowerCase()) {
			return `Expected ${vnode.type} but found ${cache.nodeName}`;
		}
		return null;
	}

	return null;
}

export function cleanupHydrationCache(dom) {
	if (!dom) return;
	HYDRATION_CACHE.delete(dom);
	if (dom.childNodes) {
		Array.from(dom.childNodes).forEach(cleanupHydrationCache);
	}
}
