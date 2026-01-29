import type {Patches} from '../src/types.js';
import {create} from 'mutative';
import {createObservableStore} from '../src/index.js';

// Example 1: User management with keyed events
console.log('=== Example 1: User Management ===');

type User = {
	name: string;
	email: string;
	age: number;
};

type State = {
	users: Record<string, User>;
};

const userStore = createObservableStore<State>({
	users: {
		'user-1': {name: 'John', email: 'john@example.com', age: 30},
		'user-2': {name: 'Jane', email: 'jane@example.com', age: 25},
	},
});

// Subscribe to specific user changes
const unsub1 = userStore.onKeyed('users:updated', 'user-1', (patches) => {
	console.log('User 1 changed:', patches);
});

// Subscribe to all user changes (wildcard)
const unsub2 = userStore.onKeyed('users:updated', '*', (userId, patches) => {
	console.log(`User ${userId} changed:`, patches);
});

// Update user-1
console.log('\nUpdating user-1...');
userStore.update('users', (draft) => {
	draft['user-1'].name = 'Johnny';
});
// Only user-1 and wildcard callbacks fire

// Update user-2
console.log('\nUpdating user-2...');
userStore.update('users', (draft) => {
	draft['user-2'].email = 'jane.doe@example.com';
});
// Only wildcard callback fires (user-1 callback doesn't fire)

unsub1();
unsub2();

// Example 2: Todo list with array index subscription
console.log('\n=== Example 2: Todo List ===');

type Todo = {
	id: number;
	text: string;
	done: boolean;
};

type TodoState = {
	todos: Array<Todo>;
};

const todoStore = createObservableStore<TodoState>({
	todos: [
		{id: 1, text: 'Learn TypeScript', done: false},
		{id: 2, text: 'Build apps', done: false},
		{id: 3, text: 'Deploy to production', done: false},
	],
});

// Subscribe to first todo changes
const unsub3 = todoStore.onKeyed('todos:updated', 0, (patches) => {
	console.log('First todo changed:', patches);
});

// Subscribe to all todo changes (wildcard)
const unsub4 = todoStore.onKeyed('todos:updated', '*', (index, patches) => {
	console.log(`Todo at index ${index} changed:`, patches);
});

// Update first todo
console.log('\nMarking first todo as done...');
todoStore.update('todos', (draft) => {
	draft[0].done = true;
});
// Both first todo and wildcard callbacks fire

// Update second todo
console.log('\nMarking second todo as done...');
todoStore.update('todos', (draft) => {
	draft[1].done = true;
});
// Only wildcard callback fires

unsub3();
unsub4();

// Example 3: onceKeyed - single emission
console.log('\n=== Example 3: Single Emission ===');

const counterStore = createObservableStore<{
	counters: Record<string, {value: number}>;
}>({
	counters: {},
});

counterStore.onceKeyed('counters:updated', 'counter-1', (patches) => {
	console.log('Counter 1 changed ONCE:', patches);
});

console.log('\nUpdating counter-1 (first time)...');
counterStore.update('counters', (draft) => {
	draft['counter-1'] = {value: 1};
});
// Callback fires

console.log('\nUpdating counter-1 (second time)...');
counterStore.update('counters', (draft) => {
	draft['counter-1'].value = 2;
});
// Callback does NOT fire (only once)

// Example 4: offKeyed - remove specific listener
console.log('\n=== Example 4: Remove Specific Listener ===');

const productStore = createObservableStore<{
	products: Record<string, {name: string; price: number}>;
}>({products: {}});

const callback1 = (patches: Patches) => console.log('Callback 1 - Product changed:', patches);
const callback2 = (patches: Patches) => console.log('Callback 2 - Product changed:', patches);

productStore.onKeyed('products:updated', 'product-1', callback1);
productStore.onKeyed('products:updated', 'product-1', callback2);

console.log('\nUpdating product-1 (both callbacks)...');
productStore.update('products', (draft) => {
	draft['product-1'] = {name: 'Widget', price: 10};
});
// Both callbacks fire

console.log('\nRemoving callback 1...');
productStore.offKeyed('products:updated', 'product-1', callback1);

console.log('\nUpdating product-1 (only callback 2)...');
productStore.update('products', (draft) => {
	draft['product-1'].price = 15;
});
// Only callback2 fires

console.log('\n=== All examples completed ===');
