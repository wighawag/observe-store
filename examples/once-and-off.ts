import {createObservableStore} from '../src/index';

const store = createObservableStore({
	counter: {value: 0},
	user: {name: 'John', age: 30},
});

console.log("=== 'once' method example ===");
console.log('Subscribe to counter update that fires only once');

// Subscribe to a single emission using once
store.once('counter:updated', (patches) => {
	console.log('Counter updated (once only):', patches);
});

// First update - callback fires
console.log('First update:');
store.update('counter', (draft) => {
	draft.value += 1;
});
console.log('Counter value:', store.get('counter'));

// Second update - callback doesn't fire
console.log('\nSecond update:');
store.update('counter', (draft) => {
	draft.value += 1;
});
console.log('Counter value:', store.get('counter'));

console.log("\n=== 'off' method example ===");
console.log('Subscribe multiple listeners and remove one');

const callback1 = (patches: any) => console.log('Callback 1 - User updated:', patches);
const callback2 = (patches: any) => console.log('Callback 2 - User updated:', patches);

store.on('user:updated', callback1);
store.on('user:updated', callback2);

// Both callbacks fire
console.log('\nFirst update (both callbacks):');
store.update('user', (draft) => {
	draft.name = 'Jane';
});

// Remove callback1 using off
store.off('user:updated', callback1);

// Only callback2 fires now
console.log('\nSecond update (only callback2):');
store.update('user', (draft) => {
	draft.age = 31;
});

console.log("\n=== Unsubscribing 'once' before it fires ===");

// You can also unsubscribe from a once listener before it fires
const unsubscribeOnce = store.once('counter:updated', (patches) => {
	console.log('This will never fire because we unsubscribe first');
});

unsubscribeOnce();

console.log('Update after unsubscribing from once:');
store.update('counter', (draft) => {
	draft.value += 1;
});

console.log('\nAll examples completed!');
