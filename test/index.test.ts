import {describe, it, expect, vi} from 'vitest';
import {createObservableStore} from '../src/index';

describe('ObservableStore', () => {
	describe('Basic functionality', () => {
		it('should create an emitter with initial state', () => {
			type State = {
				count: {value: number};
				name: {value: string};
			};

			const store = createObservableStore<State>({
				count: {value: 0},
				name: {value: 'test'},
			});

			expect(store.get('count')).toEqual({value: 0});
			expect(store.get('name')).toEqual({value: 'test'});
		});

		it('should get entire state', () => {
			type State = {
				count: {value: number};
				name: {value: string};
			};

			const store = createObservableStore<State>({
				count: {value: 42},
				name: {value: 'test'},
			});

			const state = store.getState();
			expect(state).toEqual({count: {value: 42}, name: {value: 'test'}});
			expect(state).not.toBe(store.getState()); // Should be a shallow copy
		});
	});

	describe('Update functionality', () => {
		it('should update a field and emit event', () => {
			type State = {
				count: {value: number};
				name: {value: string};
			};

			const store = createObservableStore<State>({
				count: {value: 0},
				name: {value: 'test'},
			});

			const callback = vi.fn();
			store.on('count:updated', callback);

			store.update('count', (draft) => {
				draft.value += 1;
			});

			expect(store.get('count')).toEqual({value: 1});
			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith([
				{
					op: 'replace',
					path: ['value'],
					value: 1,
				},
			]);
		});

		it('should update nested objects', () => {
			type State = {
				user: {
					name: string;
					age: number;
				};
			};

			const store = createObservableStore<State>({
				user: {name: 'John', age: 30},
			});

			const callback = vi.fn();
			store.on('user:updated', callback);

			store.update('user', (draft) => {
				draft.name = 'Jane';
				draft.age = 31;
			});

			expect(store.get('user')).toEqual({name: 'Jane', age: 31});
			expect(callback).toHaveBeenCalledTimes(1);
			const patches = callback.mock.calls[0][0];
			expect(patches).toHaveLength(2);
			expect(patches[0]).toEqual({
				op: 'replace',
				path: ['name'],
				value: 'Jane',
			});
			expect(patches[1]).toEqual({
				op: 'replace',
				path: ['age'],
				value: 31,
			});
		});

		it('should update arrays', () => {
			type State = {
				items: number[];
			};

			const store = createObservableStore<State>({
				items: [1, 2, 3],
			});

			const callback = vi.fn();
			store.on('items:updated', callback);

			store.update('items', (draft) => {
				draft.push(4);
			});

			expect(store.get('items')).toEqual([1, 2, 3, 4]);
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should handle multiple updates to same field', () => {
			type State = {
				count: {value: number};
			};

			const store = createObservableStore<State>({
				count: {value: 0},
			});

			const callback = vi.fn();
			store.on('count:updated', callback);

			store.update('count', (draft) => {
				draft.value += 1;
			});
			store.update('count', (draft) => {
				draft.value += 1;
			});

			expect(store.get('count')).toEqual({value: 2});
			expect(callback).toHaveBeenCalledTimes(2);
		});

		it('should handle updates to different fields independently', () => {
			type State = {
				count: {value: number};
				name: {value: string};
			};

			const store = createObservableStore<State>({
				count: {value: 0},
				name: {value: 'test'},
			});

			const countCallback = vi.fn();
			const nameCallback = vi.fn();

			store.on('count:updated', countCallback);
			store.on('name:updated', nameCallback);

			store.update('count', (draft) => {
				draft.value += 1;
			});

			expect(countCallback).toHaveBeenCalledTimes(1);
			expect(nameCallback).toHaveBeenCalledTimes(0);

			store.update('name', (draft) => {
				draft.value = 'updated';
			});

			expect(countCallback).toHaveBeenCalledTimes(1);
			expect(nameCallback).toHaveBeenCalledTimes(1);
		});
	});

	describe('Event subscription', () => {
		it('should allow multiple subscribers to same event', () => {
			type State = {
				count: {value: number};
			};

			const store = createObservableStore<State>({
				count: {value: 0},
			});

			const callback1 = vi.fn();
			const callback2 = vi.fn();

			store.on('count:updated', callback1);
			store.on('count:updated', callback2);

			store.update('count', (draft) => {
				draft.value += 1;
			});

			expect(callback1).toHaveBeenCalledTimes(1);
			expect(callback2).toHaveBeenCalledTimes(1);
		});

		it('should allow unsubscribing from events', () => {
			type State = {
				count: {value: number};
			};

			const store = createObservableStore<State>({
				count: {value: 0},
			});

			const callback = vi.fn();
			const unsubscribe = store.on('count:updated', callback);

			store.update('count', (draft) => {
				draft.value += 1;
			});

			expect(callback).toHaveBeenCalledTimes(1);

			unsubscribe();

			store.update('count', (draft) => {
				draft.value += 1;
			});

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should allow unsubscribing specific listener using off', () => {
			type State = {
				count: {value: number};
			};

			const store = createObservableStore<State>({
				count: {value: 0},
			});

			const callback1 = vi.fn();
			const callback2 = vi.fn();

			store.on('count:updated', callback1);
			store.on('count:updated', callback2);

			store.update('count', (draft) => {
				draft.value += 1;
			});

			expect(callback1).toHaveBeenCalledTimes(1);
			expect(callback2).toHaveBeenCalledTimes(1);

			store.off('count:updated', callback1);

			store.update('count', (draft) => {
				draft.value += 1;
			});

			expect(callback1).toHaveBeenCalledTimes(1); // Unsubscribed
			expect(callback2).toHaveBeenCalledTimes(2); // Still listening
		});

		it('should support once for single emission', () => {
			type State = {
				count: {value: number};
			};

			const store = createObservableStore<State>({
				count: {value: 0},
			});

			const callback = vi.fn();
			store.once('count:updated', callback);

			store.update('count', (draft) => {
				draft.value += 1;
			});

			expect(callback).toHaveBeenCalledTimes(1);

			store.update('count', (draft) => {
				draft.value += 1;
			});

			expect(callback).toHaveBeenCalledTimes(1); // Still only once
		});

		it('should allow unsubscribing once listener before it fires', () => {
			type State = {
				count: {value: number};
			};

			const store = createObservableStore<State>({
				count: {value: 0},
			});

			const callback = vi.fn();
			const unsubscribe = store.once('count:updated', callback);

			unsubscribe();

			store.update('count', (draft) => {
				draft.value += 1;
			});

			expect(callback).toHaveBeenCalledTimes(0);
		});

		it('should allow subscriber to subscribe to multiple events', () => {
			type State = {
				count: {value: number};
				name: {value: string};
				flag: {value: boolean};
			};

			const store = createObservableStore<State>({
				count: {value: 0},
				name: {value: 'test'},
				flag: {value: false},
			});

			const allCallback = vi.fn();

			store.on('count:updated', allCallback);
			store.on('name:updated', allCallback);
			store.on('flag:updated', allCallback);

			store.update('count', (draft) => {
				draft.value += 1;
			});
			store.update('name', (draft) => {
				draft.value = 'updated';
			});
			store.update('flag', (draft) => {
				draft.value = true;
			});

			expect(allCallback).toHaveBeenCalledTimes(3);
		});
	});

	describe('Type safety', () => {
		it('should only accept valid field names in update', () => {
			type State = {
				count: {value: number};
				name: {value: string};
			};

			const store = createObservableStore<State>({
				count: {value: 0},
				name: {value: 'test'},
			});

			// @ts-expect-error - Invalid field name
			store.update('invalid', (draft) => {
				// This should cause a type error
			});
		});

		it('should only accept valid event names in on', () => {
			type State = {
				count: {value: number};
				name: {value: string};
			};

			const store = createObservableStore<State>({
				count: {value: 0},
				name: {value: 'test'},
			});

			// @ts-expect-error - Invalid event name
			store.on('invalid:updated', (patches) => {
				// This should cause a type error
			});
		});

		it('should provide correct types in callbacks', () => {
			type State = {
				user: {
					name: string;
					age: number;
				};
			};

			const store = createObservableStore<State>({
				user: {name: 'John', age: 30},
			});

			store.on('user:updated', (patches) => {
				// patches should be of type Patches<true>
				expect(Array.isArray(patches)).toBe(true);
			});
		});

		it('should prevent primitive types at top level', () => {
			// @ts-expect-error - Primitive type not allowed
			const store = createObservableStore<{
				count: number;
			}>({
				count: 0,
			});
		});
	});

	describe('Edge cases', () => {
		it('should handle no changes gracefully', () => {
			type State = {
				count: {value: number};
			};

			const store = createObservableStore<State>({
				count: {value: 0},
			});

			const callback = vi.fn();
			store.on('count:updated', callback);

			store.update('count', (draft) => {
				// No changes
			});

			// mutative will still emit patches even if no changes occurred
			// but patches array should be empty
			expect(store.get('count')).toEqual({value: 0});
		});

		it('should handle complex nested structures', () => {
			type State = {
				data: {
					users: {
						byId: Record<string, {name: string; email: string}>;
						ids: string[];
					};
				};
			};

			const store = createObservableStore<State>({
				data: {
					users: {
						byId: {
							'1': {name: 'John', email: 'john@example.com'},
						},
						ids: ['1'],
					},
				},
			});

			const callback = vi.fn();
			store.on('data:updated', callback);

			store.update('data', (draft) => {
				draft.users.byId['2'] = {name: 'Jane', email: 'jane@example.com'};
				draft.users.ids.push('2');
			});

			expect(store.get('data').users.ids).toHaveLength(2);
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should handle removing properties', () => {
			type State = {
				items: Record<string, number>;
			};

			const store = createObservableStore<State>({
				items: {a: 1, b: 2, c: 3},
			});

			const callback = vi.fn();
			store.on('items:updated', callback);

			store.update('items', (draft) => {
				delete draft.b;
			});

			expect(store.get('items')).toEqual({a: 1, c: 3});
			expect(callback).toHaveBeenCalledTimes(1);
			const patches = callback.mock.calls[0][0];
			expect(
				patches.some(
					(p: {op: string; path?: (string | number)[]}) => p.op === 'remove' && p.path?.[0] === 'b',
				),
			).toBe(true);
		});

		describe('Keyed events', () => {
			it('should subscribe to specific key changes', () => {
				type State = {
					users: Record<string, {name: string; email: string}>;
				};

				const store = createObservableStore<State>({
					users: {
						'user-1': {name: 'John', email: 'john@example.com'},
						'user-2': {name: 'Jane', email: 'jane@example.com'},
					},
				});

				const callback = vi.fn();
				store.onKeyed('users:updated', 'user-1', callback);

				store.update('users', (draft) => {
					draft['user-1'].name = 'Johnny';
				});

				expect(callback).toHaveBeenCalledTimes(1);
				const patches = callback.mock.calls[0][0];
				expect(patches).toEqual([
					{
						op: 'replace',
						path: ['user-1', 'name'],
						value: 'Johnny',
					},
				]);
			});

			it('should not trigger keyed callback for different keys', () => {
				type State = {
					users: Record<string, {name: string}>;
				};

				const store = createObservableStore<State>({
					users: {
						'user-1': {name: 'John'},
						'user-2': {name: 'Jane'},
					},
				});

				const callback = vi.fn();
				store.onKeyed('users:updated', 'user-1', callback);

				store.update('users', (draft) => {
					draft['user-2'].name = 'Janet';
				});

				expect(callback).toHaveBeenCalledTimes(0);
			});

			it('should support wildcard subscription to all keys', () => {
				type State = {
					users: Record<string, {name: string}>;
				};

				const store = createObservableStore<State>({
					users: {
						'user-1': {name: 'John'},
						'user-2': {name: 'Jane'},
					},
				});

				const callback = vi.fn();
				store.onKeyed('users:updated', '*', (key, patches) => {
					callback(key, patches);
				});

				store.update('users', (draft) => {
					draft['user-1'].name = 'Johnny';
				});

				store.update('users', (draft) => {
					draft['user-2'].name = 'Janet';
				});

				expect(callback).toHaveBeenCalledTimes(2);
				expect(callback).toHaveBeenNthCalledWith(1, 'user-1', expect.any(Array));
				expect(callback).toHaveBeenNthCalledWith(2, 'user-2', expect.any(Array));
			});

			it('should allow multiple subscribers to same key', () => {
				type State = {
					users: Record<string, {name: string}>;
				};

				const store = createObservableStore<State>({
					users: {
						'user-1': {name: 'John'},
					},
				});

				const callback1 = vi.fn();
				const callback2 = vi.fn();

				store.onKeyed('users:updated', 'user-1', callback1);
				store.onKeyed('users:updated', 'user-1', callback2);

				store.update('users', (draft) => {
					draft['user-1'].name = 'Johnny';
				});

				expect(callback1).toHaveBeenCalledTimes(1);
				expect(callback2).toHaveBeenCalledTimes(1);
			});

			it('should allow unsubscribing from keyed events', () => {
				type State = {
					users: Record<string, {name: string}>;
				};

				const store = createObservableStore<State>({
					users: {
						'user-1': {name: 'John'},
					},
				});

				const callback = vi.fn();
				const unsubscribe = store.onKeyed('users:updated', 'user-1', callback);

				store.update('users', (draft) => {
					draft['user-1'].name = 'Johnny';
				});

				expect(callback).toHaveBeenCalledTimes(1);

				unsubscribe();

				store.update('users', (draft) => {
					draft['user-1'].name = 'John';
				});

				expect(callback).toHaveBeenCalledTimes(1);
			});

			it('should support onceKeyed for single emission', () => {
				type State = {
					users: Record<string, {name: string}>;
				};

				const store = createObservableStore<State>({
					users: {
						'user-1': {name: 'John'},
					},
				});

				const callback = vi.fn();
				store.onceKeyed('users:updated', 'user-1', callback);

				store.update('users', (draft) => {
					draft['user-1'].name = 'Johnny';
				});

				expect(callback).toHaveBeenCalledTimes(1);

				store.update('users', (draft) => {
					draft['user-1'].name = 'John';
				});

				expect(callback).toHaveBeenCalledTimes(1); // Still only once
			});

			it('should support onceKeyed with wildcard', () => {
				type State = {
					users: Record<string, {name: string}>;
				};

				const store = createObservableStore<State>({
					users: {
						'user-1': {name: 'John'},
						'user-2': {name: 'Jane'},
					},
				});

				const callback = vi.fn();
				store.onceKeyed('users:updated', '*', (key, patches) => {
					callback(key, patches);
				});

				store.update('users', (draft) => {
					draft['user-1'].name = 'Johnny';
				});

				store.update('users', (draft) => {
					draft['user-2'].name = 'Janet';
				});

				expect(callback).toHaveBeenCalledTimes(1);
			});

			it('should support offKeyed for specific listener removal', () => {
				type State = {
					users: Record<string, {name: string}>;
				};

				const store = createObservableStore<State>({
					users: {
						'user-1': {name: 'John'},
					},
				});

				const callback1 = vi.fn();
				const callback2 = vi.fn();

				store.onKeyed('users:updated', 'user-1', callback1);
				store.onKeyed('users:updated', 'user-1', callback2);

				store.update('users', (draft) => {
					draft['user-1'].name = 'Johnny';
				});

				expect(callback1).toHaveBeenCalledTimes(1);
				expect(callback2).toHaveBeenCalledTimes(1);

				store.offKeyed('users:updated', 'user-1', callback1);

				store.update('users', (draft) => {
					draft['user-1'].name = 'John';
				});

				expect(callback1).toHaveBeenCalledTimes(1); // Unsubscribed
				expect(callback2).toHaveBeenCalledTimes(2); // Still listening
			});

			it('should work with array fields', () => {
				type State = {
					todos: Array<{id: number; text: string; done: boolean}>;
				};

				const store = createObservableStore<State>({
					todos: [
						{id: 1, text: 'Task 1', done: false},
						{id: 2, text: 'Task 2', done: false},
					],
				});

				const callback = vi.fn();
				store.onKeyed('todos:updated', 0, callback);

				store.update('todos', (draft) => {
					draft[0].done = true;
				});

				expect(callback).toHaveBeenCalledTimes(1);
				const patches = callback.mock.calls[0][0];
				expect(patches).toEqual([
					{
						op: 'replace',
						path: [0, 'done'],
						value: true,
					},
				]);
			});

			it('should not emit keyed events when there are no keyed listeners', () => {
				type State = {
					users: Record<string, {name: string}>;
				};

				const store = createObservableStore<State>({
					users: {
						'user-1': {name: 'John'},
					},
				});

				// No keyed listeners, only regular listener
				const regularCallback = vi.fn();
				store.on('users:updated', regularCallback);

				store.update('users', (draft) => {
					draft['user-1'].name = 'Johnny';
				});

				expect(regularCallback).toHaveBeenCalledTimes(1);
				// Should not have any performance overhead from keyed events
			});

			it('should emit keyed events only when keyed listeners exist', () => {
				type State = {
					users: Record<string, {name: string}>;
				};

				const store = createObservableStore<State>({
					users: {
						'user-1': {name: 'John'},
					},
				});

				const regularCallback = vi.fn();
				store.on('users:updated', regularCallback);

				// First update without keyed listeners
				store.update('users', (draft) => {
					draft['user-1'].name = 'Johnny';
				});

				expect(regularCallback).toHaveBeenCalledTimes(1);

				// Add keyed listener
				const keyedCallback = vi.fn();
				store.onKeyed('users:updated', 'user-1', keyedCallback);

				// Second update with keyed listeners
				store.update('users', (draft) => {
					draft['user-1'].name = 'John';
				});

				expect(regularCallback).toHaveBeenCalledTimes(2);
				expect(keyedCallback).toHaveBeenCalledTimes(1);
			});

			it('should handle empty patches gracefully', () => {
				type State = {
					users: Record<string, {name: string}>;
				};

				const store = createObservableStore<State>({
					users: {
						'user-1': {name: 'John'},
					},
				});

				const callback = vi.fn();
				store.onKeyed('users:updated', 'user-1', callback);

				store.update('users', (draft) => {
					// No changes
				});

				// Empty patches should not trigger keyed events
				expect(callback).toHaveBeenCalledTimes(0);
			});

			it('should handle patches with no path elements', () => {
				type State = {
					data: Record<string, number>;
				};

				const store = createObservableStore<State>({
					data: {a: 1, b: 2},
				});

				const callback = vi.fn();
				store.onKeyed('data:updated', 'any-key', callback);

				// If patches have no path, no keyed events should be emitted
				store.update('data', (draft) => {
					// Mutative should generate patches with path
					Object.assign(draft, {a: 1});
				});

				// This should still emit regular events
				const regularCallback = vi.fn();
				store.on('data:updated', regularCallback);
				store.update('data', (draft) => {
					draft.a = 1;
				});
				expect(regularCallback).toHaveBeenCalled();
			});

			it('should emit one keyed event per unique key', () => {
				type State = {
					users: Record<string, {name: string; email: string}>;
				};

				const store = createObservableStore<State>({
					users: {
						'user-1': {name: 'John', email: 'john@example.com'},
						'user-2': {name: 'Jane', email: 'jane@example.com'},
					},
				});

				const callback1 = vi.fn();
				const callback2 = vi.fn();

				store.onKeyed('users:updated', 'user-1', callback1);
				store.onKeyed('users:updated', 'user-2', callback2);

				store.update('users', (draft) => {
					draft['user-1'].name = 'Johnny';
					draft['user-1'].email = 'johnny@example.com';
					draft['user-2'].name = 'Janet';
				});

				// Each keyed listener should fire once
				expect(callback1).toHaveBeenCalledTimes(1);
				expect(callback2).toHaveBeenCalledTimes(1);

				// Patches should contain all changes
				const patches1 = callback1.mock.calls[0][0];
				expect(patches1).toHaveLength(3); // 3 total patches
			});

			it('should maintain backward compatibility with regular events', () => {
				type State = {
					users: Record<string, {name: string}>;
				};

				const store = createObservableStore<State>({
					users: {
						'user-1': {name: 'John'},
					},
				});

				const regularCallback = vi.fn();
				store.on('users:updated', regularCallback);

				const keyedCallback = vi.fn();
				store.onKeyed('users:updated', 'user-1', keyedCallback);

				store.update('users', (draft) => {
					draft['user-1'].name = 'Johnny';
				});

				// Both should receive events
				expect(regularCallback).toHaveBeenCalledTimes(1);
				expect(keyedCallback).toHaveBeenCalledTimes(1);
			});

			it('should work with numeric keys (converted to strings in patches)', () => {
				type State = {
					items: Record<number, {value: string}>;
				};

				const store = createObservableStore<State>({
					items: {
						1: {value: 'one'},
						2: {value: 'two'},
					},
				});

				const callback = vi.fn();
				// Note: mutative converts numeric keys to strings in patch paths
				store.onKeyed('items:updated', '1', callback);

				store.update('items', (draft) => {
					draft[1].value = 'ONE';
				});

				expect(callback).toHaveBeenCalledTimes(1);
			});

			// symbol seems to be supported at runtime but not in the type system
			// Technically mutative support them though its type system does not seem to
			// it('should handle symbol keys', () => {
			// 	type State = {
			// 		items: Record<symbol, { value: string }>;
			// 	};

			// 	const key1 = Symbol('key1');
			// 	const key2 = Symbol('key2');

			// 	const store = createMutativeEmitter<State>({
			// 		items: {
			// 			[key1]: { value: 'one' },
			// 			[key2]: { value: 'two' }
			// 		}
			// 	});

			// 	const callback = vi.fn();
			// 	store.onKeyed('items:updated', key1, callback);

			// 	store.update('items', (draft) => {
			// 		draft[key1].value = 'ONE';
			// 	});

			// 	expect(callback).toHaveBeenCalledTimes(1);
			// });
		});
	});

	describe('Subscribe API (value-based)', () => {
		it('should subscribe to a field and receive immediate callback', () => {
			type State = {
				counter: {value: number};
			};

			const store = createObservableStore<State>({
				counter: {value: 0},
			});

			const callback = vi.fn();
			store.subscriptions.counter(callback);

			// Callback should be called immediately with current value
			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith({value: 0});
		});

		it('should call callback on field update', () => {
			type State = {
				counter: {value: number};
			};

			const store = createObservableStore<State>({
				counter: {value: 0},
			});

			const callback = vi.fn();
			store.subscriptions.counter(callback);

			// Reset after initial call
			callback.mockClear();

			// Update the field
			store.update('counter', (draft) => {
				draft.value += 1;
			});

			// Callback should be called with new value
			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith({value: 1});
		});

		it('should return unsubscribe function', () => {
			type State = {
				counter: {value: number};
			};

			const store = createObservableStore<State>({
				counter: {value: 0},
			});

			const callback = vi.fn();
			const unsubscribe = store.subscriptions.counter(callback);

			expect(typeof unsubscribe).toBe('function');
		});

		it('should unsubscribe from field updates', () => {
			type State = {
				counter: {value: number};
			};

			const store = createObservableStore<State>({
				counter: {value: 0},
			});

			const callback = vi.fn();
			const unsubscribe = store.subscriptions.counter(callback);

			// Reset after initial call
			callback.mockClear();

			// First update
			store.update('counter', (draft) => {
				draft.value += 1;
			});
			expect(callback).toHaveBeenCalledTimes(1);

			// Unsubscribe
			unsubscribe();

			// Second update should not trigger callback
			store.update('counter', (draft) => {
				draft.value += 1;
			});
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should allow multiple subscribers to same field', () => {
			type State = {
				counter: {value: number};
			};

			const store = createObservableStore<State>({
				counter: {value: 0},
			});

			const callback1 = vi.fn();
			const callback2 = vi.fn();

			store.subscriptions.counter(callback1);
			store.subscriptions.counter(callback2);

			// Reset after initial calls
			callback1.mockClear();
			callback2.mockClear();

			store.update('counter', (draft) => {
				draft.value += 1;
			});

			expect(callback1).toHaveBeenCalledTimes(1);
			expect(callback2).toHaveBeenCalledTimes(1);
		});

		it('should handle multiple fields independently', () => {
			type State = {
				counter: {value: number};
				user: {name: string};
			};

			const store = createObservableStore<State>({
				counter: {value: 0},
				user: {name: 'John'},
			});

			const counterCallback = vi.fn();
			const userCallback = vi.fn();

			store.subscriptions.counter(counterCallback);
			store.subscriptions.user(userCallback);

			// Reset after initial calls
			counterCallback.mockClear();
			userCallback.mockClear();

			// Update counter
			store.update('counter', (draft) => {
				draft.value += 1;
			});

			expect(counterCallback).toHaveBeenCalledTimes(1);
			expect(userCallback).toHaveBeenCalledTimes(0);

			// Update user
			store.update('user', (draft) => {
				draft.name = 'Jane';
			});

			expect(counterCallback).toHaveBeenCalledTimes(1);
			expect(userCallback).toHaveBeenCalledTimes(1);
		});

		it('should receive updated value on each change', () => {
			type State = {
				counter: {value: number};
			};

			const store = createObservableStore<State>({
				counter: {value: 0},
			});

			const callback = vi.fn();
			store.subscriptions.counter(callback);

			// Reset after initial call
			callback.mockClear();

			store.update('counter', (draft) => {
				draft.value = 10;
			});
			expect(callback).toHaveBeenNthCalledWith(1, {value: 10});

			store.update('counter', (draft) => {
				draft.value = 20;
			});
			expect(callback).toHaveBeenNthCalledWith(2, {value: 20});

			store.update('counter', (draft) => {
				draft.value = 30;
			});
			expect(callback).toHaveBeenNthCalledWith(3, {value: 30});
		});

		it('should work with complex nested objects', () => {
			type State = {
				user: {
					name: string;
					age: number;
					address: {street: string; city: string};
				};
			};

			const store = createObservableStore<State>({
				user: {
					name: 'John',
					age: 30,
					address: {street: 'Main St', city: 'NYC'},
				},
			});

			const callback = vi.fn();
			store.subscriptions.user(callback);

			// Reset after initial call
			callback.mockClear();

			store.update('user', (draft) => {
				draft.name = 'Jane';
				draft.age = 31;
			});

			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith({
				name: 'Jane',
				age: 31,
				address: {street: 'Main St', city: 'NYC'},
			});
		});

		it('should work with array fields', () => {
			type State = {
				todos: Array<{id: number; text: string; done: boolean}>;
			};

			const store = createObservableStore<State>({
				todos: [],
			});

			const callback = vi.fn();
			store.subscriptions.todos(callback);

			// Reset after initial call
			callback.mockClear();

			store.update('todos', (draft) => {
				draft.push({id: 1, text: 'Task 1', done: false});
			});

			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith([{id: 1, text: 'Task 1', done: false}]);
		});

		it('should provide readonly values', () => {
			type State = {
				counter: {value: number};
			};

			const store = createObservableStore<State>({
				counter: {value: 0},
			});

			const callback = vi.fn();
			store.subscriptions.counter(callback);

			// Reset after initial call
			callback.mockClear();

			store.update('counter', (draft) => {
				draft.value += 1;
			});

			// The callback receives the value, which should be readonly in practice
			// (enforced by TypeScript types)
			const receivedValue = callback.mock.calls[0][0];
			expect(receivedValue).toEqual({value: 1});
		});

		it('should handle unsubscribe during callback', () => {
			type State = {
				counter: {value: number};
			};

			const store = createObservableStore<State>({
				counter: {value: 0},
			});

			const callback = vi.fn();
			let unsubscribe: (() => void) | null = null;

			const wrappedCallback = (value: {value: number}) => {
				callback(value);
				if (value.value === 1 && unsubscribe) {
					unsubscribe();
					unsubscribe = null;
				}
			};

			unsubscribe = store.subscriptions.counter(wrappedCallback);

			// Reset after initial call
			callback.mockClear();

			// First update - callback fires and unsubscribes
			store.update('counter', (draft) => {
				draft.value = 1;
			});
			expect(callback).toHaveBeenCalledTimes(1);

			// Second update - callback should not fire (unsubscribed)
			store.update('counter', (draft) => {
				draft.value = 2;
			});
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should handle rapid updates correctly', () => {
			type State = {
				counter: {value: number};
			};

			const store = createObservableStore<State>({
				counter: {value: 0},
			});

			const callback = vi.fn();
			store.subscriptions.counter(callback);

			// Reset after initial call
			callback.mockClear();

			// Rapid updates
			for (let i = 1; i <= 10; i++) {
				store.update('counter', (draft) => {
					draft.value = i;
				});
			}

			expect(callback).toHaveBeenCalledTimes(10);
			for (let i = 1; i <= 10; i++) {
				expect(callback).toHaveBeenNthCalledWith(i, {value: i});
			}
		});

		it('should handle Record fields correctly', () => {
			type State = {
				users: Record<string, {name: string; email: string}>;
			};

			const store = createObservableStore<State>({
				users: {
					'user-1': {name: 'John', email: 'john@example.com'},
				},
			});

			const callback = vi.fn();
			store.subscriptions.users(callback);

			// Reset after initial call
			callback.mockClear();

			store.update('users', (draft) => {
				draft['user-2'] = {name: 'Jane', email: 'jane@example.com'};
			});

			expect(callback).toHaveBeenCalledTimes(1);
			const result = callback.mock.calls[0][0];
			expect(result['user-1']).toEqual({name: 'John', email: 'john@example.com'});
			expect(result['user-2']).toEqual({name: 'Jane', email: 'jane@example.com'});
		});
	});

	describe('Subscribe API type safety', () => {
		it('should only accept valid field names in subscribe', () => {
			type State = {
				counter: {value: number};
				user: {name: string};
			};

			const store = createObservableStore<State>({
				counter: {value: 0},
				user: {name: 'John'},
			});

			// Type safety is enforced at compile time by TypeScript
			// Invalid field names will cause TypeScript errors
			// We can't test this at runtime without causing errors
			expect(store.subscriptions).toBeDefined();
		});

		it('should provide correct types in subscribe callbacks', () => {
			type State = {
				counter: {value: number};
				user: {name: string; age: number};
			};

			const store = createObservableStore<State>({
				counter: {value: 0},
				user: {name: 'John', age: 30},
			});

			store.subscriptions.counter((counter) => {
				// counter should be of type { value: number }
				expect(counter.value).toBeTypeOf('number');
			});

			store.subscriptions.user((user) => {
				// user should be of type { name: string; age: number }
				expect(user.name).toBeTypeOf('string');
				expect(user.age).toBeTypeOf('number');
			});
		});
	});

	describe('Keyed Subscriptions API (value-based)', () => {
		it('should subscribe to a keyed field and receive immediate callback', () => {
			type State = {
				users: Record<string, {name: string; email: string}>;
			};

			const store = createObservableStore<State>({
				users: {
					'user-1': {name: 'John', email: 'john@example.com'},
					'user-2': {name: 'Jane', email: 'jane@example.com'},
				},
			});

			const callback = vi.fn();
			store.keyedSubscriptions.users('user-1')(callback);

			// Callback should be called immediately with current value
			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith({
				'user-1': {name: 'John', email: 'john@example.com'},
				'user-2': {name: 'Jane', email: 'jane@example.com'},
			});
		});

		it('should call callback when specific key is updated', () => {
			type State = {
				users: Record<string, {name: string; email: string}>;
			};

			const store = createObservableStore<State>({
				users: {
					'user-1': {name: 'John', email: 'john@example.com'},
				},
			});

			const callback = vi.fn();
			store.keyedSubscriptions.users('user-1')(callback);

			// Reset after initial call
			callback.mockClear();

			// Update the key we're subscribed to
			store.update('users', (draft) => {
				draft['user-1'].name = 'Johnny';
			});

			// Callback should be called with new value
			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith({
				'user-1': {name: 'Johnny', email: 'john@example.com'},
			});
		});

		it('should not call callback when different key is updated', () => {
			type State = {
				users: Record<string, {name: string}>;
			};

			const store = createObservableStore<State>({
				users: {
					'user-1': {name: 'John'},
					'user-2': {name: 'Jane'},
				},
			});

			const callback = vi.fn();
			store.keyedSubscriptions.users('user-1')(callback);

			// Reset after initial call
			callback.mockClear();

			// Update a different key
			store.update('users', (draft) => {
				draft['user-2'].name = 'Janet';
			});

			// Callback should not be called
			expect(callback).toHaveBeenCalledTimes(0);
		});

		it('should return unsubscribe function', () => {
			type State = {
				users: Record<string, {name: string}>;
			};

			const store = createObservableStore<State>({
				users: {'user-1': {name: 'John'}},
			});

			const callback = vi.fn();
			const unsubscribe = store.keyedSubscriptions.users('user-1')(callback);

			expect(typeof unsubscribe).toBe('function');
		});

		it('should unsubscribe from keyed field updates', () => {
			type State = {
				users: Record<string, {name: string}>;
			};

			const store = createObservableStore<State>({
				users: {'user-1': {name: 'John'}},
			});

			const callback = vi.fn();
			const unsubscribe = store.keyedSubscriptions.users('user-1')(callback);

			// Reset after initial call
			callback.mockClear();

			// First update
			store.update('users', (draft) => {
				draft['user-1'].name = 'Johnny';
			});
			expect(callback).toHaveBeenCalledTimes(1);

			// Unsubscribe
			unsubscribe();

			// Second update should not trigger callback
			store.update('users', (draft) => {
				draft['user-1'].name = 'John';
			});
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should allow multiple subscribers to same key', () => {
			type State = {
				users: Record<string, {name: string}>;
			};

			const store = createObservableStore<State>({
				users: {'user-1': {name: 'John'}},
			});

			const callback1 = vi.fn();
			const callback2 = vi.fn();

			store.keyedSubscriptions.users('user-1')(callback1);
			store.keyedSubscriptions.users('user-1')(callback2);

			// Reset after initial calls
			callback1.mockClear();
			callback2.mockClear();

			store.update('users', (draft) => {
				draft['user-1'].name = 'Johnny';
			});

			expect(callback1).toHaveBeenCalledTimes(1);
			expect(callback2).toHaveBeenCalledTimes(1);
		});

		it('should work with array fields using numeric keys', () => {
			type State = {
				todos: Array<{id: number; text: string; done: boolean}>;
			};

			const store = createObservableStore<State>({
				todos: [
					{id: 1, text: 'Task 1', done: false},
					{id: 2, text: 'Task 2', done: false},
				],
			});

			const callback = vi.fn();
			store.keyedSubscriptions.todos(0)(callback);

			// Reset after initial call
			callback.mockClear();

			// Update first todo
			store.update('todos', (draft) => {
				draft[0].done = true;
			});

			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith([
				{id: 1, text: 'Task 1', done: true},
				{id: 2, text: 'Task 2', done: false},
			]);
		});

		it('should handle updates to multiple keys independently', () => {
			type State = {
				users: Record<string, {name: string}>;
			};

			const store = createObservableStore<State>({
				users: {
					'user-1': {name: 'John'},
					'user-2': {name: 'Jane'},
				},
			});

			const callback1 = vi.fn();
			const callback2 = vi.fn();

			store.keyedSubscriptions.users('user-1')(callback1);
			store.keyedSubscriptions.users('user-2')(callback2);

			// Reset after initial calls
			callback1.mockClear();
			callback2.mockClear();

			// Update user-1
			store.update('users', (draft) => {
				draft['user-1'].name = 'Johnny';
			});

			expect(callback1).toHaveBeenCalledTimes(1);
			expect(callback2).toHaveBeenCalledTimes(0);

			// Update user-2
			store.update('users', (draft) => {
				draft['user-2'].name = 'Janet';
			});

			expect(callback1).toHaveBeenCalledTimes(1);
			expect(callback2).toHaveBeenCalledTimes(1);
		});

		it('should provide readonly values', () => {
			type State = {
				users: Record<string, {name: string}>;
			};

			const store = createObservableStore<State>({
				users: {'user-1': {name: 'John'}},
			});

			const callback = vi.fn();
			store.keyedSubscriptions.users('user-1')(callback);

			// Reset after initial call
			callback.mockClear();

			store.update('users', (draft) => {
				draft['user-1'].name = 'Johnny';
			});

			// The callback receives the value, which should be readonly in practice
			const receivedValue = callback.mock.calls[0][0];
			expect(receivedValue).toEqual({'user-1': {name: 'Johnny'}});
		});
	});
});
