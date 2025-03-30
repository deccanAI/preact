let batchDepth = 0;
const batchQueue = new Set();

export function batch(callback) {
	batchDepth++;
	try {
		callback();
	} finally {
		batchDepth--;
		if (batchDepth === 0) {
			const queue = Array.from(batchQueue);
			batchQueue.clear();
			for (const effect of queue) {
				effect();
			}
		}
	}
}

export function queueEffect(effect) {
	if (batchDepth > 0) {
		batchQueue.add(effect);
		return true;
	}
	return false;
}
