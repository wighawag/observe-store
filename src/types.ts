import type {Patches} from 'mutative';
import type {KeyedEventMap} from 'radiate';

export type NonPrimitive = object | Array<unknown>;

/**
 * Generate event name for a field key
 * @example EventName<'user'> // 'user:updated'
 */
export type EventName<K extends string> = `${K}:updated`;

/**
 * Extract event names from state type
 * @example EventNames<{ a: string, b: number }> // 'a:updated' | 'b:updated'
 */
export type EventNames<T extends Record<string, NonPrimitive>> = {
	[K in keyof T]: EventName<K & string>;
}[keyof T];

export type Key = string | number; // TODO native PropertyKey (which include Symbol)?

/**
 * Extract key type from a field type
 * - For Record<K, V>, extracts K as the key type (constrained to Key)
 * - For Array<V>, extracts string as the key type (mutative converts indices to strings in patches)
 * - For other types, falls back to string
 *
 * Note: JSON Patch paths only support string and number, not symbol
 */
export type ExtractKeyType<T> =
	T extends Record<infer K, any>
		? K extends Key
			? K
			: string
		: T extends Array<any>
			? string
			: string;

/**
 * Keyed event map type for fine-grained subscriptions
 * Maps event names to their key and patch data structure
 */
export type KeyedObservableEventMap<T extends Record<string, NonPrimitive>> = KeyedEventMap<{
	[K in keyof T as EventName<K & string>]: {
		id: ExtractKeyType<T[K]>;
		data: Patches<true>;
	};
}>;

/**
 * Subscriptions map type for value-based subscriptions
 * Maps each field key to a subscribe function that:
 * - Executes the callback immediately with the current value
 * - Executes the callback on every field update
 * - Returns an unsubscribe function
 *
 * @example
 * ```ts
 * type State = { counter: { value: number }, user: { name: string } };
 * type SubscriptionsMap = SubscriptionsMap<State>;
 * // {
 * //   counter: (callback: (value: { value: number }) => void) => () => void;
 * //   user: (callback: (value: { name: string }) => void) => () => void;
 * // }
 * ```
 */
export type SubscriptionsMap<T extends Record<string, NonPrimitive>> = {
	[K in keyof T]: (callback: (value: Readonly<T[K]>) => void) => () => void;
};

/**
 * Keyed subscriptions map type for value-based keyed subscriptions
 * Maps each field key to a function that takes a key and returns a subscribe function
 * The subscribe function:
 * - Executes the callback immediately with the current value
 * - Executes the callback on every field update for that specific key
 * - Returns an unsubscribe function
 *
 * @example
 * ```ts
 * type State = { users: Record<string, { name: string }> };
 * type KeyedSubscriptionsMap = KeyedSubscriptionsMap<State>;
 * // {
 * //   users: {
 * //     (key: string): (callback: (value: { name: string }) => void) => () => void;
 * //   }
 * // }
 * ```
 */
export type KeyedSubscriptionsMap<T extends Record<string, NonPrimitive>> = {
	[K in keyof T]: {
		(key: ExtractKeyType<T[K]>): (callback: (value: Readonly<T[K]>) => void) => () => void;
	};
};
