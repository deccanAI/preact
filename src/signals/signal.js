import { batch, queueEffect } from './batch';

const signalValues = new WeakMap();
const signalSubscriptions = new WeakMap();
const computedCache = new WeakMap();
let currentEffect = null;

export function signal(initialValue) {
	const s = {
		value: initialValue,
		version: 0
	};

	signalValues.set(s, initialValue);
	signalSubscriptions.set(s, new Set());

	return {
		subscribe(effect) {
			const subs = signalSubscriptions.get(s);
			subs.add(effect);
			return () => subs.delete(effect);
		},

		peek() {
			return signalValues.get(s);
		},

		get value() {
			const value = signalValues.get(s);
			if (currentEffect) {
				this.subscribe(currentEffect);
			}
			return value;
		},

		set value(newValue) {
			const oldValue = signalValues.get(s);
			if (Object.is(oldValue, newValue)) {
				return;
			}

			signalValues.set(s, newValue);
			s.version++;

			const subs = signalSubscriptions.get(s);
			if (subs.size > 0) {
				const effects = Array.from(subs);
				if (
					!queueEffect(() => batch(() => effects.forEach(effect => effect())))
				) {
					batch(() => effects.forEach(effect => effect()));
				}
			}
		}
	};
}

export function computed(compute) {
	const signal = {
		value: undefined,
		version: 0,
		dirty: true
	};

	signalSubscriptions.set(signal, new Set());

	const effect = () => {
		const oldEffect = currentEffect;
		currentEffect = effect;

		try {
			const newValue = compute();
			if (!Object.is(signal.value, newValue)) {
				signal.value = newValue;
				signal.version++;
				signal.dirty = false;

				const subs = signalSubscriptions.get(signal);
				if (subs.size > 0) {
					const effects = Array.from(subs);
					batch(() => effects.forEach(fn => fn()));
				}
			}
		} finally {
			currentEffect = oldEffect;
		}
	};

	return {
		subscribe(fn) {
			const subs = signalSubscriptions.get(signal);
			subs.add(fn);
			return () => subs.delete(fn);
		},

		get value() {
			if (signal.dirty) {
				effect();
			}
			if (currentEffect) {
				this.subscribe(currentEffect);
			}
			return signal.value;
		}
	};
}

export function effect(callback) {
	const effect = () => {
		const oldEffect = currentEffect;
		currentEffect = effect;
		try {
			callback();
		} finally {
			currentEffect = oldEffect;
		}
	};
	effect();
}
