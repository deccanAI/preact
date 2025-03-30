type Subscriber = () => void;
type EqualityFn = (prev: any, next: any) => boolean;

class SignalBatch {
	private static instance: SignalBatch;
	private queue: Set<Signal<any>> = new Set();
	private isScheduled = false;

	static getInstance(): SignalBatch {
		if (!SignalBatch.instance) {
			SignalBatch.instance = new SignalBatch();
		}
		return SignalBatch.instance;
	}

	schedule(signal: Signal<any>): void {
		this.queue.add(signal);
		if (!this.isScheduled) {
			this.isScheduled = true;
			queueMicrotask(() => this.flush());
		}
	}

	private flush(): void {
		const sortedSignals = Array.from(this.queue).sort(
			(a, b) => b.depth - a.depth
		);

		this.queue.clear();
		this.isScheduled = false;

		for (const signal of sortedSignals) {
			signal.notify();
		}
	}
}

export class Signal<T> {
	protected value: T;
	private subscribers = new Set<Subscriber>();
	private dependencies = new WeakMap<Signal<any>, boolean>();
	depth = 0;
	private previousValue: T;
	private equalityFn: EqualityFn;

	constructor(initialValue: T, options: { equals?: EqualityFn } = {}) {
		this.value = initialValue;
		this.previousValue = initialValue;
		this.equalityFn = options.equals || Object.is;
	}

	get(): T {
		this.trackDependency();
		return this.value;
	}

	set(newValue: T): void {
		if (this.equalityFn(this.value, newValue)) {
			return;
		}

		this.previousValue = this.value;
		this.value = newValue;

		// Mark dependent computed signals as dirty
		for (const [signal] of this.dependencies) {
			if (signal instanceof ComputedSignal) {
				signal.markDirty();
			}
		}

		SignalBatch.getInstance().schedule(this);
	}

	subscribe(callback: Subscriber): () => void {
		this.subscribers.add(callback);
		return () => this.subscribers.delete(callback);
	}

	notify(): void {
		this.subscribers.forEach(callback => callback());
	}

	private trackDependency(): void {
		const runningComputation = ComputedSignal.currentComputation;
		if (runningComputation) {
			this.dependencies.set(runningComputation, true);
			runningComputation.depth = Math.max(
				runningComputation.depth,
				this.depth + 1
			);
			runningComputation.addDependency(this);
		}
	}

	addDependency(signal: Signal<any>): void {
		this.dependencies.set(signal, true);
	}
}

export class ComputedSignal<T> extends Signal<T> {
	static currentComputation: ComputedSignal<any> | null = null;
	private computation: () => T;
	private isDirty = true;

	constructor(computation: () => T) {
		super(undefined as T);
		this.computation = computation;
		this.value = this.compute();
	}

	get(): T {
		if (this.isDirty) {
			this.value = this.compute();
			this.isDirty = false;
		}
		return super.get();
	}

	private compute(): T {
		const previousComputation = ComputedSignal.currentComputation;
		ComputedSignal.currentComputation = this;

		try {
			return this.computation();
		} finally {
			ComputedSignal.currentComputation = previousComputation;
		}
	}

	markDirty(): void {
		this.isDirty = true;
		SignalBatch.getInstance().schedule(this);
	}
}

export function signal<T>(
	initialValue: T,
	options?: { equals?: EqualityFn }
): Signal<T> {
	return new Signal(initialValue, options);
}

export function computed<T>(computation: () => T): Signal<T> {
	return new ComputedSignal(computation);
}
