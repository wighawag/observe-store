import {createObservableStore} from '../src/index';

/**
 * Example demonstrating the subscribe API
 */

type State = {
	counter: {value: number};
	user: {name: string; age: number};
	todos: Array<{id: number; text: string; done: boolean}>;
};

const store = createObservableStore<State>({
	counter: {value: 0},
	user: {name: 'John', age: 30},
	todos: [],
});

console.log('=== Subscribe API Example ===\n');

// Example 1: Simple counter subscription
console.log('Example 1: Counter subscription');
console.log('Initial counter value:', store.get('counter').value);

store.subscriptions.counter((counter) => {
	console.log('Counter updated:', counter.value);
});

store.update('counter', (draft) => {
	draft.value += 1;
});
store.update('counter', (draft) => {
	draft.value += 1;
});
store.update('counter', (draft) => {
	draft.value += 1;
});
console.log('Final counter value:', store.get('counter').value);
console.log('');

// Example 2: User subscription
console.log('Example 2: User subscription');
console.log('Initial user:', store.get('user'));

store.subscriptions.user((user) => {
	console.log('User updated:', user.name, 'age', user.age);
});

store.update('user', (draft) => {
	draft.name = 'Jane';
	draft.age = 31;
});
console.log('');

// Example 3: Multiple subscriptionsrs to same field
console.log('Example 3: Multiple subscribers to same field');
const counter1 = store.subscriptions.counter((counter) => {
	console.log('Subscriber 1 - Counter:', counter.value);
});

const counter2 = store.subscriptions.counter((counter) => {
	console.log('Subscriber 2 - Counter:', counter.value);
});

store.update('counter', (draft) => {
	draft.value += 1;
});
console.log('');

// Example 4: Unsubscribe
console.log('Example 4: Unsubscribe');
console.log('Counter before:', store.get('counter').value);

const unsubscribe = store.subscriptions.counter((counter) => {
	console.log('This subscriber will be removed. Counter:', counter.value);
});

store.update('counter', (draft) => {
	draft.value += 1;
});

unsubscribe();

store.update('counter', (draft) => {
	draft.value += 1;
});
console.log('Callback should not fire after unsubscribe');
console.log('Counter after:', store.get('counter').value);
console.log('');

// Example 5: Array subscription
console.log('Example 5: Array subscription (todos)');
store.subscriptions.todos((todos) => {
	console.log('Todos updated:', todos.length, 'items');
	todos.forEach((todo) => {
		console.log('  -', todo.text, todo.done ? '✓' : '✗');
	});
});

store.update('todos', (draft) => {
	draft.push({id: 1, text: 'Learn TypeScript', done: false});
});

store.update('todos', (draft) => {
	draft.push({id: 2, text: 'Build apps', done: false});
});

store.update('todos', (draft) => {
	draft[0].done = true;
});
console.log('');

// Example 6: Comparison with patch-based API
console.log('Example 6: Comparison with patch-based API');
console.log('Patch-based subscription:');
store.on('counter:updated', (patches) => {
	console.log('  Patches:', patches);
});

console.log('Value-based subscription:');
store.subscriptions.counter((counter) => {
	console.log('  Value:', counter.value);
});

store.update('counter', (draft) => {
	draft.value += 1;
});
console.log('');

console.log('=== Example Complete ===');
