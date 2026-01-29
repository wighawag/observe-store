import {createEmitter, type Emitter, type KeyedEventMap} from 'radiate';
import {recordPatches} from 'patch-recorder';
import {
	Draft,
	EventName,
	EventNames,
	ExtractKeyType,
	Key,
	KeyedObservableEventMap,
	KeyedSubscriptionsMap,
	NonPrimitive,
	Patches,
	SubscriptionsMap,
	CreateFunction,
} from './types.js';

function createFromPatchRecorder<T extends NonPrimitive>(
	state: T,
	mutate: (state: Draft<T>) => void,
): [T, Patches] {
	return [state, recordPatches<T>(state, mutate)];
}

export type ObservableStoreOptions = {
	createFunction?: CreateFunction;
};

/**
 * Type-safe observable store that emits events for each top-level field change.
 *
 * **Note:** Top-level fields must be objects or arrays, not primitives.
 * For primitive values, wrap them in an object: `{ value: number }` instead of `number`.
 *
 * @example
 * ```ts
 * type State = {
 *   user: { name: string; age: number };
 *   counter: { value: number };
 * };
 *
 * const store = createObservableStore<State>({
 *   user: { name: 'John', age: 30 },
 *   counter: { value: 0 }
 * });
 *
 * // Subscribe to user field changes
 * store.on('user:updated', (patches) => {
 *   console.log('User changed:', patches);
 * });
 *
 * // Update user field
 * store.update('user', (draft) => {
 *   draft.name = 'Jane';
 *   // Emits 'user:updated' event with patches
 * });
 *
 * // Update counter field
 * store.update('counter', (draft) => {
 *   draft.value += 1;
 * });
 * ```
 */
export class ObservableStore<T extends Record<string, NonPrimitive>> {
	private emitter: Emitter<any, KeyedObservableEventMap<T>>;

	public subscriptions: SubscriptionsMap<T>;
	public keyedSubscriptions: KeyedSubscriptionsMap<T>;

	private create: CreateFunction;

	constructor(
		protected state: T,
		protected options?: ObservableStoreOptions,
	) {
		this.create = options?.createFunction ?? createFromPatchRecorder;
		this.emitter = createEmitter();
		this.subscriptions = this.createSubscribeHandlers();
		this.keyedSubscriptions = this.createKeyedSubscribeHandlers();
	}

	/**
	 * Update a specific field and emit an event with the patches
	 *
	 * @param key - The field key to update
	 * @param mutate - Mutation function that receives a draft of the field value
	 *
	 * @example
	 * ```ts
	 * store.update('user', (draft) => {
	 *   draft.name = 'Jane';
	 * });
	 * ```
	 */
	public update<K extends keyof T>(key: K, mutate: (draft: Draft<T[K]>) => void): void {
		const [newState, patches] = this.create(this.state[key], mutate);
		this.state[key] = newState;

		const eventName = `${String(key)}:updated` as EventNames<T>;

		// Always emit field level event
		this.emitter.emit(eventName, patches);

		// Conditionally emit keyed events only when there are listeners (performance optimization)
		if (this.emitter.hasKeyedListeners(eventName)) {
			const changedKeys = this.extractKeysFromPatches(patches);
			for (const changedKey of changedKeys) {
				// Type assertions needed due to TypeScript limitations with generic string literals
				this.emitter.emitKeyed(eventName, changedKey as any, patches as any);
			}
		}
	}

	/**
	 * Get the current value of a field
	 *
	 * @param name - The field key to retrieve
	 * @returns The current value of the field
	 */
	public get<K extends keyof T>(name: K): Readonly<T[K]> {
		return this.state[name];
	}

	/**
	 * Subscribe to updates for a specific field
	 *
	 * @param event - The event name in format `${fieldName}:updated`
	 * @param callback - Callback function that receives the patches array
	 * @returns Unsubscribe function
	 *
	 * @example
	 * ```ts
	 * const unsubscribe = store.on('user:updated', (patches) => {
	 *   console.log('User changed:', patches);
	 * });
	 *
	 * // Later: unsubscribe();
	 * ```
	 */
	public on<K extends keyof T>(
		event: EventName<K & string>,
		callback: (patches: Patches) => void,
	): () => void {
		return this.emitter.on(event, callback);
	}

	/**
	 * Unsubscribe from a specific field event
	 *
	 * @param event - The event name in format `${fieldName}:updated`
	 * @param callback - The exact callback function to remove
	 *
	 * @example
	 * ```ts
	 * const callback = (patches) => console.log('User changed:', patches);
	 * store.on('user:updated', callback);
	 *
	 * // Later:
	 * store.off('user:updated', callback);
	 * ```
	 */
	public off<K extends keyof T>(
		event: EventName<K & string>,
		callback: (patches: Patches) => void,
	): void {
		this.emitter.off(event, callback);
	}

	/**
	 * Subscribe to updates for a specific field for a single emission only
	 *
	 * @param event - The event name in format `${fieldName}:updated`
	 * @param callback - Callback function that receives the patches array
	 * @returns Unsubscribe function to remove listener before it fires
	 *
	 * @example
	 * ```ts
	 * // Subscribe for single emission
	 * const unsubscribe = store.once('user:updated', (patches) => {
	 *   console.log('User changed once:', patches);
	 * });
	 *
	 * // Callback will fire once, then automatically unsubscribe
	 * ```
	 */
	public once<K extends keyof T>(
		event: EventName<K & string>,
		callback: (patches: Patches) => void,
	): () => void {
		return this.emitter.once(event, callback);
	}

	/**
	 * Subscribe to updates for a specific field with a specific key
	 *
	 * @param event - The event name in format `${fieldName}:updated`
	 * @param key - The specific key to listen for (e.g., user ID, array index)
	 * @param callback - Callback function that receives the patches array
	 * @returns Unsubscribe function
	 *
	 * @example
	 * ```ts
	 * // Subscribe to specific user changes
	 * const unsubscribe = store.onKeyed('users:updated', 'user-123', (patches) => {
	 *   console.log('User 123 changed:', patches);
	 * });
	 *
	 * // Later: unsubscribe();
	 * ```
	 */
	public onKeyed<K extends keyof T>(
		event: EventName<K & string>,
		key: Key,
		callback: (patches: Patches) => void,
	): () => void;

	/**
	 * Subscribe to all keys in a field (wildcard subscription)
	 *
	 * @param event - The event name in format `${fieldName}:updated`
	 * @param key - Use '*' to listen to all keys
	 * @param callback - Callback function that receives the key and patches array
	 * @returns Unsubscribe function
	 *
	 * @example
	 * ```ts
	 * // Subscribe to all user changes (userId is inferred as string)
	 * const unsubscribe = store.onKeyed('users:updated', '*', (userId, patches) => {
	 *   console.log(`User ${userId} changed:`, patches);
	 * });
	 *
	 * // Subscribe to all todo changes (index is inferred as number)
	 * const unsubscribe = store.onKeyed('todos:updated', '*', (index, patches) => {
	 *   console.log(`Todo at index ${index} changed:`, patches);
	 * });
	 *
	 * // Later: unsubscribe();
	 * ```
	 */
	public onKeyed<K extends keyof T>(
		event: EventName<K & string>,
		key: '*',
		callback: (key: ExtractKeyType<T[K]>, patches: Patches) => void,
	): () => void;

	/** @internal */
	public onKeyed<K extends keyof T>(
		event: EventName<K & string>,
		key: Key | '*',
		callback: (...args: any[]) => void,
	): () => void {
		// Type assertions needed due to TypeScript limitations with generic string literals
		return this.emitter.onKeyed(event as any, key as any, callback as any);
	}

	/**
	 * Unsubscribe from a keyed event
	 *
	 * @param event - The event name in format `${fieldName}:updated`
	 * @param key - The specific key to unsubscribe from
	 * @param callback - The exact callback function to remove
	 *
	 * @example
	 * ```ts
	 * const callback = (patches) => console.log('Changed:', patches);
	 * store.onKeyed('users:updated', 'user-123', callback);
	 *
	 * // Later:
	 * store.offKeyed('users:updated', 'user-123', callback);
	 * ```
	 */
	public offKeyed<K extends keyof T>(
		event: EventName<K & string>,
		key: Key,
		callback: (patches: Patches) => void,
	): void {
		// Type assertions needed due to TypeScript limitations with Key and generic string literals
		this.emitter.offKeyed(event as any, key as any, callback as any);
	}

	/**
	 * Subscribe to a keyed event for a single emission only
	 *
	 * @param event - The event name in format `${fieldName}:updated`
	 * @param key - The specific key to listen for
	 * @param callback - Callback function that receives the patches array
	 * @returns Unsubscribe function to remove listener before it fires
	 *
	 * @example
	 * ```ts
	 * // Subscribe for single emission
	 * const unsubscribe = store.onceKeyed('users:updated', 'user-123', (patches) => {
	 *   console.log('User 123 changed once:', patches);
	 * });
	 *
	 * // Callback will fire once, then automatically unsubscribe
	 * ```
	 */
	public onceKeyed<K extends keyof T>(
		event: EventName<K & string>,
		key: Key,
		callback: (patches: Patches) => void,
	): () => void;

	/**
	 * Subscribe to all keys in a field for a single emission only (wildcard)
	 *
	 * @param event - The event name in format `${fieldName}:updated`
	 * @param key - Use '*' to listen to all keys
	 * @param callback - Callback function that receives the key and patches array
	 * @returns Unsubscribe function to remove listener before it fires
	 *
	 * @example
	 * ```ts
	 * // Subscribe for single emission to all users (userId is inferred as string)
	 * const unsubscribe = store.onceKeyed('users:updated', '*', (userId, patches) => {
	 *   console.log(`User ${userId} changed once:`, patches);
	 * });
	 *
	 * // Subscribe for single emission to all todos (index is inferred as number)
	 * const unsubscribe = store.onceKeyed('todos:updated', '*', (index, patches) => {
	 *   console.log(`Todo at index ${index} changed once:`, patches);
	 * });
	 *
	 * // Callback will fire once, then automatically unsubscribe
	 * ```
	 */
	public onceKeyed<K extends keyof T>(
		event: EventName<K & string>,
		key: '*',
		callback: (key: ExtractKeyType<T[K]>, patches: Patches) => void,
	): () => void;

	/** @internal */
	public onceKeyed<K extends keyof T>(
		event: EventName<K & string>,
		key: Key | '*',
		callback: (...args: any[]) => void,
	): () => void {
		// Type assertions needed due to TypeScript limitations with generic string literals
		return this.emitter.onceKeyed(event as any, key as any, callback as any);
	}

	/**
	 * Get the entire current state
	 *
	 * @returns A shallow copy of the current state
	 */
	public getState(): Readonly<T> {
		return {...this.state};
	}

	// ------------------------------------------------------------------------
	// INTERNAL
	// ------------------------------------------------------------------------

	/**
	 * Create subscribe handlers for all fields in the state
	 * Each handler:
	 * 1. Calls the callback immediately with the current value
	 * 2. Subscribes to field updates to call the callback on each change
	 * 3. Returns an unsubscribe function
	 */
	private createSubscribeHandlers(): SubscriptionsMap<T> {
		const subscriptions = {} as SubscriptionsMap<T>;

		for (const key of Object.keys(this.state) as Array<keyof T>) {
			subscriptions[key] = (callback: (value: Readonly<T[keyof T]>) => void) => {
				// Call immediately with current value
				callback(this.get(key));

				// Subscribe to updates and call callback with new value on each change
				const eventName = `${String(key)}:updated` as EventNames<T>;
				const unsubscribe = this.emitter.on(eventName, () => {
					callback(this.get(key));
				});

				return unsubscribe;
			};
		}

		return subscriptions;
	}

	/**
	 * Create keyed subscribe handlers for all fields in the state
	 * Each handler:
	 * 1. Takes a key as parameter
	 * 2. Calls the callback immediately with the current value
	 * 3. Subscribes to keyed field updates to call the callback on each change
	 * 4. Returns an unsubscribe function
	 */
	private createKeyedSubscribeHandlers(): KeyedSubscriptionsMap<T> {
		const keyedSubscriptions = {} as KeyedSubscriptionsMap<T>;

		for (const key of Object.keys(this.state) as Array<keyof T>) {
			keyedSubscriptions[key] = (subscriptionKey: ExtractKeyType<T[typeof key]>) => {
				return (callback: (value: Readonly<T[keyof T]>) => void) => {
					// Call immediately with current value
					callback(this.get(key));

					// Subscribe to keyed updates and call callback with new value on each change
					const eventName = `${String(key)}:updated` as EventNames<T>;
					const unsubscribe = this.emitter.onKeyed(eventName as any, subscriptionKey as any, () => {
						callback(this.get(key));
					});

					return unsubscribe;
				};
			};
		}

		return keyedSubscriptions;
	}

	/**
	 * Extract unique keys from patches
	 * @param patches - Array of JSON patches
	 * @returns Set of unique keys found in patch paths
	 */
	private extractKeysFromPatches(patches: Patches): Set<Key> {
		const keys = new Set<Key>();
		for (const patch of patches) {
			if (patch.path.length > 0) {
				keys.add(patch.path[0]);
			}
		}
		return keys;
	}
}

/**
 * Create an ObservableStore instance with the given initial state
 *
 * @param state - The initial state object
 * @returns A new ObservableStore instance
 *
 * @example
 * ```ts
 * const store = createObservableStore({
 *   user: { name: 'John', age: 30 },
 *   counter: { value: 0 }
 * });
 * ```
 */
export function createObservableStore<T extends Record<string, NonPrimitive>>(
	state: T,
	options?: ObservableStoreOptions,
): ObservableStore<T> {
	return new ObservableStore(state, options);
}

export function createObservableStoreFactory(factoryOptions: ObservableStoreOptions) {
	return function createObservableStore<T extends Record<string, NonPrimitive>>(
		state: T,
		options?: ObservableStoreOptions,
	): ObservableStore<T> {
		return new ObservableStore(state, options ? {...factoryOptions, ...options} : factoryOptions);
	};
}
