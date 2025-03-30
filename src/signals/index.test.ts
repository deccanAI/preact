import { signal, computed } from './index.js';

describe('Signal System', () => {
	test('basic signal functionality', () => {
		const count = signal(0);
		expect(count.get()).toBe(0);

		count.set(1);
		expect(count.get()).toBe(1);
	});

	test('signal subscription', () => {
		const count = signal(0);
		const mock = jest.fn();

		count.subscribe(mock);
		count.set(1);

		expect(mock).toHaveBeenCalledTimes(1);
	});

	test('computed signals', () => {
		const count = signal(0);
		const doubled = computed(() => count.get() * 2);

		expect(doubled.get()).toBe(0);

		count.set(2);
		expect(doubled.get()).toBe(4);
	});

	test('batched updates', async () => {
		const count = signal(0);
		const mock = jest.fn();
		count.subscribe(mock);

		count.set(1);
		count.set(2);
		count.set(3);

		await Promise.resolve();
		expect(mock).toHaveBeenCalledTimes(1);
		expect(count.get()).toBe(3);
	});

	test('custom equality function', () => {
		const obj = signal(
			{ id: 1 },
			{
				equals: (a, b) => a.id === b.id
			}
		);

		const mock = jest.fn();
		obj.subscribe(mock);

		obj.set({ id: 1 });
		expect(mock).not.toHaveBeenCalled();

		obj.set({ id: 2 });
		expect(mock).toHaveBeenCalledTimes(1);
	});

	test('dependency tracking', () => {
		const a = signal(1);
		const b = signal(2);
		const sum = computed(() => a.get() + b.get());
		const mock = jest.fn();

		sum.subscribe(mock);
		expect(sum.get()).toBe(3);

		a.set(2);
		b.set(3);

		expect(mock).toHaveBeenCalledTimes(1);
		expect(sum.get()).toBe(5);
	});
});
