# observator

A type-safe store that emits events for each top-level field change. Uses [patch-recorder](https://github.com/wighawag/patch-recorder) by default for immutable updates with JSON Patch generation, but you can use any compatible library (e.g., mutative or immer). Uses [radiate](https://github.com/wighawag/radiate) for type-safe event emission.

## Features

- 🔒 **Type-safe event names** - Only valid field names can be used for updates and subscriptions
- 📝 **Patches included** - Event callbacks receive [JSON Patch](https://datatracker.ietf.org/doc/html/rfc6902) arrays
- 🎯 **Patch mechanism agnostic** - Use any patch generation library (patch-recorder, mutative, immer, etc.)
- 🎯 **Fine-grained subscriptions** - Subscribe to specific keys within Record/Map fields using keyed events
- 💡 **Value-based subscriptions** - Use the convenient `subscribe` API to receive current values immediately and on every change
- 🎯 **Minimal events** - Events are emitted only for the specific field being updated
- 📦 **Minimal dependencies** - Only depends on `patch-recorder` and `radiate`
- 🚀 **Lightweight** - Small footprint with powerful features

## Installation

```bash
npm install observator
# or
pnpm add observator
# or
yarn add observator
```

By default, `observator` uses [patch-recorder](https://github.com/wighawag/patch-recorder) for patch generation. To use a different library, install it as well:

```bash
# Using mutative
npm install mutative

# Using immer
npm install immer
```
## Usage

### Quick Start

The simplest way to use `observe-store` is to import `createObservableStore` and call it with your initial state. It uses [patch-recorder](https://github.com/wighawag/patch-recorder) by default:

```typescript
import {createObservableStore} from 'observator';

type State = {
  counter: number;
  user: { name: string };
};

const store = createObservableStore<State>({
  counter: 0,
  user: { name: 'John' }
});

// Subscribe to counter updates
store.on('counter:updated', (patches) => {
  console.log('Counter changed:', patches);
});

// Update counter
store.update((state) => {
  state.counter += 1;
});

console.log(store.get('counter')); // { value: 1 }
```


### Basic Example with Primitives

```typescript
import {createObservableStore} from 'observator';

type State = {
  counter: number;
  name: string;
};

const store = createObservableStore<State>({
  counter: 0,
  name: 'John'
});

// Subscribe to counter updates
store.on('counter:updated', (patches) => {
  console.log('Counter changed:', patches);
  // Output: [{ op: 'replace', path: ['value'], value: 1 }]
});

// Update counter
store.update((state) => {
  state.counter += 1;
});

console.log(store.get('counter')); // { value: 1 }
```

### Example with Complex Objects

```typescript
import {createObservableStore} from 'observator';

type State = {
  user: {
    name: string;
    age: number;
    email: string;
  };
  settings: {
    theme: 'light' | 'dark';
    notifications: boolean;
  };
};

const store = createObservableStore<State>({
  user: {
    name: 'John Doe',
    age: 30,
    email: 'john@example.com'
  },
  settings: {
    theme: 'light',
    notifications: true
  }
});

// Subscribe to user changes
store.on('user:updated', (patches) => {
  console.log('User updated:', patches);
  // Output: [{ op: 'replace', path: ['name'], value: 'Jane Doe' }]
});

// Update user
store.update((state) => {
  state.user.name = 'Jane Doe';
  state.user.age = 31;
});

// Subscribe to settings changes
const unsubscribe = store.on('settings:updated', (patches) => {
  console.log('Settings changed:', patches);
});

// Update settings
store.update((state) => {
  state.settings.theme = 'dark';
  state.settings.notifications = false;
});

// Unsubscribe later
unsubscribe();
```

### Value-based Subscriptions

The `subscribe` API provides a convenient way to subscribe to field values. Unlike the patch-based `on()` API, `subscribe`:

- **Executes immediately** with the current value
- **Provides the full value** on every change (not just patches)
- **Returns an unsubscribe function** for easy cleanup

```typescript
import {createObservableStore} from 'observator';

type State = {
  counter: number;
  user: { name: string };
};

const store = createObservableStore<State>({
  counter: 0,
  user: { name: 'John' }
});

// Subscribe to counter - callback fires immediately with current value
store.subscribe.counter((counter) => {
  console.log('Counter value:', counter.value);
});
// Output: Counter value: 0

// Update counter - callback fires again with new value
store.update((state) => {
  state.counter += 1;
});
// Output: Counter value: 1

// Subscribe to user
const unsubscribe = store.subscribe.user((user) => {
  console.log('User name:', user.name);
});
// Output: User name: John

// Unsubscribe from user updates
unsubscribe();

store.update((state) => {
  state.user.name = 'Jane';
});
// No callback fired (unsubscribed)
```

#### Benefits of Value-based Subscriptions

- **Simpler API**: No need to manually get current values or apply patches
- **Immediate execution**: Always receive the current value right away
- **Cleaner code**: Less boilerplate compared to patch-based subscriptions
- **Same type safety**: Full TypeScript support with field name inference

#### Comparison: Patch-based vs Value-based

```typescript
// Patch-based subscription
store.on('counter:updated', (patches) => {
  const current = store.get('counter');
  console.log('Counter:', current.value);
  // Need to manually get current value
});

// Value-based subscription
store.subscribe.counter((counter) => {
  console.log('Counter:', counter.value);
  // Automatically receives latest value
});
```

### Example with Arrays

```typescript
import {createObservableStore} from 'observator';

type State = {
  items: number[];
  todos: Array<{ id: number; text: string; done: boolean }>;
};

const store = createObservableStore<State>({
  items: [1, 2, 3],
  todos: [
    { id: 1, text: 'Learn TypeScript', done: false }
  ]
});

// Subscribe to items changes
store.on('items:updated', (patches) => {
  console.log('Items changed:', patches);
});

// Add item
store.update((state) => {
  state.items.push(4);
});

// Update todos
store.update((state) => {
  state.todos.push({ id: 2, text: 'Build apps', done: false });
  state.todos[0].done = true;
});
```

### Keyed Events - Subscribe to Specific Keys

For fields containing records or arrays, you can subscribe to changes for specific keys:

```typescript
import {createObservableStore} from 'observator';

type State = {
  users: Record<string, { name: string; email: string }>;
};

const store = createObservableStore<State>({
  users: {
    'user-1': { name: 'John', email: 'john@example.com' },
    'user-2': { name: 'Jane', email: 'jane@example.com' }
  }
});

// Subscribe to specific user changes
const unsubscribe1 = store.onKeyed('users:updated', 'user-1', (patches) => {
  console.log('User 1 changed:', patches);
});

// Update user-1
store.update((state) => {
  state.users['user-1'].name = 'Johnny';
});
// Only the user-1 callback fires

// Update user-2
store.update((state) => {
  state.users['user-2'].name = 'Janet';
});
// The user-1 callback does NOT fire

unsubscribe1();
```

#### Wildcard Subscription

Subscribe to all keys in a field using the wildcard `'*'`:

```typescript
// Subscribe to all user changes
const unsubscribe = store.onKeyed('users:updated', '*', (userId, patches) => {
  console.log(`User ${userId} changed:`, patches);
});

store.update((state) => {
  state.users['user-1'].name = 'Johnny';
  state.user['user-2'].name = 'Janet';
});

unsubscribe();
```

#### Array Index Subscription

Subscribe to specific array indices:

```typescript
type State = {
  todos: Array<{ id: number; text: string; done: boolean }>;
};

const store = createObservableStore<State>({
  todos: [
    { id: 1, text: 'Task 1', done: false },
    { id: 2, text: 'Task 2', done: false }
  ]
});

// Subscribe to first todo changes
store.onKeyed('todos:updated', 0, (patches) => {
  console.log('First todo changed:', patches);
});

store.update((state) => {
  state.todos[0].done = true;
});
// Only the first todo callback fires
```

#### Single Emission

Subscribe for a single event using `onceKeyed`:

```typescript
// Subscribe for single emission
store.onceKeyed('users:updated', 'user-1', (patches) => {
  console.log('User 1 changed once:', patches);
});

store.update((state) => {
  state.users['user-1'].name = 'Johnny';
});
// Callback fires once

store.update((state) => {
  state.users['user-1'].name = 'John';
});
// Callback does NOT fire again
```

#### Unsubscribe Specific Listener

Remove a specific listener from a keyed event:

```typescript
const callback1 = (patches) => console.log('Callback 1:', patches);
const callback2 = (patches) => console.log('Callback 2:', patches);

store.onKeyed('users:updated', 'user-1', callback1);
store.onKeyed('users:updated', 'user-1', callback2);

store.update((state) => {
  state.users['user-1'].name = 'Johnny';
});
// Both callbacks fire

store.offKeyed('users:updated', 'user-1', callback1);

store.update((state) => {
  state.users['user-1'].name = 'John';
});
// Only callback2 fires
```

### Multiple Subscribers

```typescript
import {createObservableStore} from 'observator';

type State = {
  count: number;
};

const store = createObservableStore<State>({
  count: 0
});

// Multiple subscribers to the same event
const unsubscribe1 = store.on('count:updated', (patches) => {
  console.log('Subscriber 1:', patches);
});

const unsubscribe2 = store.on('count:updated', (patches) => {
  console.log('Subscriber 2:', patches);
});

store.update((state) => {
  state.count += 1;
});

// Both subscribers receive the event
// Output:
// Subscriber 1: [{ op: 'replace', path: ['value'], value: 1 }]
// Subscriber 2: [{ op: 'replace', path: ['value'], value: 1 }]
```

### Get Entire State

```typescript
import {createObservableStore} from 'observator';

type State = {
  user: { name: string };
  counter: number;
};

const store = createObservableStore<State>({
  user: { name: 'John' },
  counter: 0
});

const entireState = store.getState();
console.log(entireState);
// { user: { name: 'John' }, counter: { value: 0 } }

// Returns a shallow copy, so modifications don't affect the store
const stateCopy = store.getState();
stateCopy.counter.value = 999;
console.log(store.get('counter')); // Still { value: 0 }
```

## API

### `createObservableStore<T>(state: T, create?: CreateFunction): ObservableStore<T>`

Creates a new ObservableStore instance with the given initial state. Uses `patch-recorder` by default, but you can pass a custom create function.

**Type Parameter:**
- `T` - The state type, must be `Record<string, object | Array<any>>`

**Parameters:**
- `state` - Initial state object
- `create` - Optional custom create function for patch generation

**Returns:**
- A new `ObservableStore<T>` instance

**Example (default usage):**
```typescript
import {createObservableStore} from 'observator';

const store = createObservableStore({
  user: { name: 'John' },
  counter: 0
});
```

**Example (with custom create function):**
```typescript
import {createObservableStore} from 'observator';
import {create} from 'mutative';

const store = createObservableStore(
  {
    user: { name: 'John' },
    counter: { value: 0 }
  },
  {createFunction: (state, mutate) => create(state, mutate, {enablePatches: true})},
);
```


### `ObservableStore<T>`

#### `update(mutate: (state: T) => void): void`

Updates the state and emits an event with the patches.

**Parameters:**
- `mutate` - Mutation function that receives a state of the field value

**Example:**
```typescript
store.update((state) => {
  state.user.name = 'Jane';
});
```

#### `get<K extends keyof T>(name: K): T[K]`

Gets the current value of a field.

**Type Parameters:**
- `K` - The field key to retrieve

**Parameters:**
- `name` - The field key to retrieve

**Returns:**
- The current value of the field

**Example:**
```typescript
const user = store.get('user');
console.log(user.name); // 'John'
```

#### `on<K extends keyof T>(event: `${K & string}:updated`, callback: (patches: Patches<true>) => void): () => void`

Subscribes to updates for a specific field.

**Type Parameters:**
- `K` - The field key to subscribe to

**Parameters:**
- `event` - The event name in format `${fieldName}:updated`
- `callback` - Callback function that receives the patches array

**Returns:**
- Unsubscribe function

**Example:**
```typescript
const unsubscribe = store.on('user:updated', (patches) => {
  console.log('User changed:', patches);
});

// Later: unsubscribe();
unsubscribe();
```

#### `onKeyed<K extends keyof T>(event: `${K & string}:updated`, key: PropertyKey, callback: (patches: Patches<true>) => void): () => void`

Subscribes to updates for a specific key within a field.

**Type Parameters:**
- `K` - The field key to subscribe to

**Parameters:**
- `event` - The event name in format `${fieldName}:updated`
- `key` - The specific key to listen for (e.g., user ID, array index)
- `callback` - Callback function that receives the patches array

**Returns:**
- Unsubscribe function

**Example:**
```typescript
const unsubscribe = store.onKeyed('users:updated', 'user-123', (patches) => {
  console.log('User 123 changed:', patches);
});

unsubscribe();
```

#### `onKeyed<K extends keyof T>(event: `${K & string}:updated`, key: '*', callback: (key: PropertyKey, patches: Patches<true>) => void): () => void`

Subscribes to all keys within a field (wildcard subscription).

**Parameters:**
- `event` - The event name in format `${fieldName}:updated`
- `key` - Use `'*'` to listen to all keys
- `callback` - Callback function that receives the key and patches array

**Returns:**
- Unsubscribe function

**Example:**
```typescript
const unsubscribe = store.onKeyed('users:updated', '*', (userId, patches) => {
  console.log(`User ${userId} changed:`, patches);
});

unsubscribe();
```

#### `offKeyed<K extends keyof T>(event: `${K & string}:updated`, key: PropertyKey, callback: (patches: Patches<true>) => void): void`

Unsubscribes a specific listener from a keyed event.

**Parameters:**
- `event` - The event name in format `${fieldName}:updated`
- `key` - The specific key to unsubscribe from
- `callback` - The exact callback function to remove

**Example:**
```typescript
const callback = (patches) => console.log('Changed:', patches);
store.onKeyed('users:updated', 'user-123', callback);

store.offKeyed('users:updated', 'user-123', callback);
```

#### `onceKeyed<K extends keyof T>(event: `${K & string}:updated`, key: PropertyKey, callback: (patches: Patches<true>) => void): () => void`

Subscribes to a keyed event for a single emission only.

**Parameters:**
- `event` - The event name in format `${fieldName}:updated`
- `key` - The specific key to listen for
- `callback` - Callback function that receives the patches array

**Returns:**
- Unsubscribe function to remove listener before it fires

**Example:**
```typescript
const unsubscribe = store.onceKeyed('users:updated', 'user-123', (patches) => {
  console.log('User 123 changed once:', patches);
});

// Callback will fire once, then automatically unsubscribe
```

#### `onceKeyed<K extends keyof T>(event: `${K & string}:updated`, key: '*', callback: (key: PropertyKey, patches: Patches<true>) => void): () => void`

Subscribes to all keys within a field for a single emission only (wildcard).

**Parameters:**
- `event` - The event name in format `${fieldName}:updated`
- `key` - Use `'*'` to listen to all keys
- `callback` - Callback function that receives the key and patches array

**Returns:**
- Unsubscribe function to remove listener before it fires

**Example:**
```typescript
const unsubscribe = store.onceKeyed('users:updated', '*', (userId, patches) => {
  console.log(`User ${userId} changed once:`, patches);
});

// Callback will fire once, then automatically unsubscribe
```

#### `getState(): T`

Gets the entire current state.

**Returns:**
- A shallow copy of the current state

**Example:**
```typescript
const state = store.getState();
console.log(state);
```

#### `subscribe: SubscribeMap<T>`

A convenient object with keys matching all state fields. Each field provides a subscribe function that:

- Executes the callback immediately with the current field value
- Executes the callback on every field change
- Returns an unsubscribe function

**Example:**
```typescript
// Subscribe to counter field
const unsubscribe = store.subscribe.counter((counter) => {
  console.log('Counter value:', counter.value);
});

// Unsubscribe later
unsubscribe();
```

**Type-safe access:**
```typescript
type State = {
  counter: { value: number };
  user: { name: string };
};

const store = createObservableStore<State>({ ... });

// ✅ Valid - TypeScript knows these are the available fields
store.subscribe.counter((counter) => { /* counter: { value: number } */ });
store.subscribe.user((user) => { /* user: { name: string } */ });

// ❌ Type error - Invalid field name
store.subscribe.invalid((value) => { /* Type error */ });
```

## Type Safety

The library provides full TypeScript type safety:

```typescript
type State = {
  user: { name: string };
  counter: { value: number };
};

const store = createObservableStore<State>({ ... });

// ✅ Valid
store.update('user', (state) => {
  state.name = 'Jane';
});

// ❌ Type error: Invalid field name
store.update('invalid', (state) => {
  // Type error
});

// ✅ Valid
store.on('user:updated', (patches) => {
  console.log(patches);
});

// ❌ Type error: Invalid event name
store.on('invalid:updated', (patches) => {
  // Type error
});

// ❌ Type error: Primitive types not allowed
const invalidStore = createObservableStore<{
  count: number;
}>({ count: 0 });

// ✅ Keyed events with type safety
type State = {
  users: Record<string, { name: string }>;
};

const store = createObservableStore<State>({ users: {} });

// ✅ Valid
store.onKeyed('users:updated', 'user-1', (patches) => {
  console.log(patches);
});

// ❌ Type error: Invalid event name
store.onKeyed('invalid:updated', 'user-1', (patches) => {
  // Type error
});

// ✅ Subscribe API with type safety
type State = {
  counter: { value: number };
  user: { name: string };
};

const store = createObservableStore<State>({ ... });

// ✅ Valid - TypeScript infers correct types
store.subscribe.counter((counter) => {
  // counter is typed as { value: number }
  console.log(counter.value);
});

store.subscribe.user((user) => {
  // user is typed as { name: string }
  console.log(user.name);
});

// ❌ Type error: Invalid field name
store.subscribe.invalid((value) => {
  // Type error
});
```

## Performance Considerations

Keyed events use conditional emission - they are only emitted when there are active keyed listeners. This means there's no performance overhead when you're not using keyed events:

```typescript
type State = {
  users: Record<string, { name: string }>;
};

const store = createObservableStore<State>({ users: {} });

// No keyed listeners - no performance overhead
store.on('users:updated', (patches) => {
  console.log('Regular event:', patches);
});

store.update('users', (state) => {
  state['user-1'] = { name: 'John' };
});
// Only regular event is emitted

// Add keyed listener - now keyed events are emitted
store.onKeyed('users:updated', 'user-1', (patches) => {
  console.log('Keyed event:', patches);
});

store.update('users', (state) => {
  state['user-1'].name = 'Jane';
});
// Both regular and keyed events are emitted
```

**Note:** Numeric keys in Record objects are converted to strings by most patch generation libraries in patch paths, so subscribe using the string version of the key.

## Working with Primitives

Since top-level fields must be objects or arrays, wrap primitives in an object:

```typescript
// ❌ Not allowed - primitives at top level
type BadState = {
  count: number;
  name: string;
  flag: boolean;
};

// ✅ Correct - wrapped primitives
type GoodState = {
  count: { value: number };
  name: { value: string };
  flag: { value: boolean };
};

// You can create a utility type for consistency
type PrimitiveField<T> = { value: T };

type BetterState = {
  count: PrimitiveField<number>;
  name: PrimitiveField<string>;
  flag: PrimitiveField<boolean>;
};

import {createObservableStore} from 'observator';

const store = createObservableStore<BetterState>({
  count: { value: 0 },
  name: { value: 'John' },
  flag: { value: false }
});

store.update('count', (state) => {
  state.value += 1;
});
```

## Understanding Patches

Patches follow the [JSON Patch (RFC 6902)](https://datatracker.ietf.org/doc/html/rfc6902) format. The exact patch format depends on the patch generation library you use:

- **patch-recorder (default)**: Generates patches with minimal overhead while keeping references
- **mutative**: Generates high-performance JSON patches with array optimizations
- **immer**: Generates standard JSON patches

```typescript
store.on('user:updated', (patches) => {
  patches.forEach(patch => {
    console.log(`Operation: ${patch.op}`);
    console.log(`Path: ${JSON.stringify(patch.path)}`);
    console.log(`Value: ${JSON.stringify(patch.value)}`);
  });
});
```

Common operations:
- `replace` - Replace a value at a path
- `add` - Add a value to an array or object
- `remove` - Remove a value from an array or object

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
