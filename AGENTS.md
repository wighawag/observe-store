# AGENTS.md

This document provides guidance for AI agents working on the `observator` project.

## Project Overview

**observator** is a TypeScript library that provides a type-safe observable store. It uses:
- [patch-recorder](https://github.com/wighawag/patch-recorder) for mutable state updates and patch generation (default)
- [radiate](https://github.com/wighawag/radiate) for type-safe event emission

The store allows any custom patch generation library (mutative, immer, etc.) and emits events for each top-level field change with JSON Patch arrays, enabling fine-grained reactivity.

**Important:** The state can contain any values including primitives, objects, and arrays. The library works with primitives at the top level when using patch-recorder (the default).

## Key Design Decisions

### 1. Patch Generation Library Agnostic

The library is designed to work with any patch generation library that follows a specific interface. By default, it uses [patch-recorder](https://github.com/wighawag/patch-recorder) which:
- Provides minimal overhead while keeping object references
- Uses mutable objects internally
- Generates JSON Patch (RFC 6902) arrays

Users can optionally use other libraries like:
- **mutative**: High-performance immutable state updates with array optimizations
- **immer**: Well-known immutable state management with JSON patch support

**Important:** Different patch generation libraries may have different requirements:
- `patch-recorder` (default): Works with any values including primitives, uses mutable references
- `mutative/immer`: May require objects/arrays at field level to generate patches properly

### 2. State Update Model

**Critical:** The store updates the FULL state, not individual fields.

When calling [`update()`](src/index.ts:106), you receive a state of the entire state and can modify multiple fields in a single call. The store then:
1. Groups patches by top-level field
2. Emits events for each field that changed
3. Provides both regular events (`${field}:updated`) and keyed events for fine-grained subscriptions

**Example:**
```typescript
type State = {
  user: { name: string };
  counter: { value: number };
  items: string[];
};

// Update multiple fields in one call
store.update((state) => {
  state.user.name = 'Jane';
  state.counter.value += 1;
  state.items.push('new');
});
// Emits: 'user:updated', 'counter:updated', 'items:updated'
```

### 3. Non-Primitive Considerations

The library enforces that the state must be a non-primitive object or array at the top level. However, patch-recorder (the default) supports primitives at the field level.

For maximum compatibility across all patch generation libraries (including mutative/immer), wrap primitives in objects:
```typescript
// Works with patch-recorder (default)
type State1 = {
  count: number;  // ✅ Primitive at field level works with patch-recorder
};

// For maximum compatibility across all libraries
type State2 = {
  count: { value: number };  // ✅ Wrapped primitive works with all libraries
};
```

**Note:** The state type itself must extend `Record<string, unknown> & NonPrimitive`, which means the top-level state cannot be a primitive value.

### 4. Event Naming Convention

Events are named as `${fieldName}:updated` (e.g., `user:updated`, `counter:updated`).

This is enforced by TypeScript types:
```typescript
type EventName<K extends string> = `${K}:updated`;
```

### 5. Patch Structure

Patches are generated for the full state and grouped by top-level field:
- For state `{ count: { value: 0 } }`, updating `state.count.value = 1` produces: `[{ op: 'replace', path: ['count', 'value'], value: 1 }]`
- For state `{ user: { name: 'John' } }`, updating `state.user.name = 'Jane'` produces: `[{ op: 'replace', path: ['user', 'name'], value: 'Jane' }]`
- For state `{ count: 0 }`, updating `state.count = 1` produces: `[{ op: 'replace', path: ['count'], value: 1 }]` (works with patch-recorder)

The patches are grouped by field, so `user:updated` event receives patches with paths starting with `['user', ...]`.

All patches follow [JSON Patch (RFC 6902)](https://datatracker.ietf.org/doc/html/rfc6902) format with paths as arrays of strings, numbers, symbols, or objects.

### 6. Type Safety

The library provides comprehensive type safety:
- Only valid field names can be used in `update()`
- Only valid event names can be used in `on()`
- Primitive types at top level are rejected at compile time

## Architecture

### Core Types

```typescript
type NonPrimitive = object | Array<unknown>;

type EventName<K extends string> = `${K}:updated`;

type EventNames<T> = EventName<keyof T & string>;

type KeyedObservableEventMap<T> = KeyedEventMap<ExtractKeyType<T[T[keyof T]]>, EventNames<T>>;

export class ObservableStore<T extends Record<string, unknown> & NonPrimitive> {
  private emitter: Emitter<any, KeyedObservableEventMap<T>>;
  public subscriptions: SubscriptionsMap<T>;
  public keyedSubscriptions: KeyedSubscriptionsMap<T>;
  private create: CreateFunction;
  // ...
}
```

### Patch Generation Interface

The library accepts any function that matches the `CreateFunction` interface:
```typescript
type CreateFunction = <T extends NonPrimitive>(
  state: T,
  mutate: (state: T) => void
) => [T, Patches];
```

Default implementation using patch-recorder:
```typescript
function createFromPatchRecorder<T extends NonPrimitive>(
  state: T,
  mutate: (state: T) => void,
): [T, Patches] {
  return [state, recordPatches<T>(state, mutate)];
}
```

### Key Methods

1. **`update(mutate: (state: T) => void): Patches`**
   - Updates the full state with a mutation function
   - Receives a state of the entire state
   - Groups patches by top-level field
   - Emits `${field}:updated` events for each changed field
   - Conditionally emits keyed events when listeners exist
   - Returns all patches

2. **`get<K>(name: K): Readonly<T[K]>`**
   - Gets current value of a field
   - Returns readonly reference

3. **`on<K>(event: EventName<K>, callback: (patches: Patches) => void): () => void`**
   - Subscribes to field updates
   - Returns unsubscribe function

4. **`off<K>(event: EventName<K>, callback: (patches: Patches) => void): void`**
   - Removes a specific event listener
   - Must pass the exact callback function used in `on()`

5. **`once<K>(event: EventName<K>, callback: (patches: Patches) => void): () => void`**
   - Subscribes to a single emission of an event
   - Automatically unsubscribes after the first callback
   - Returns unsubscribe function to remove listener before it fires

6. **`onKeyed<K>(event: EventName<K>, key: Key | '*', callback): () => void`**
   - Subscribes to updates for a specific key within a field
   - Supports wildcard `'*'` for all keys
   - Returns unsubscribe function

7. **`offKeyed<K>(event: EventName<K>, key: Key, callback): void`**
   - Unsubscribes a specific listener from a keyed event

8. **`onceKeyed<K>(event: EventName<K>, key: Key | '*', callback): () => void`**
   - Subscribes to a keyed event for a single emission only
   - Supports wildcard `'*'`
   - Returns unsubscribe function

9. **`getState(): Readonly<T>`**
   - Returns shallow copy of entire state

10. **`subscribe: SubscriptionsMap<T>`**
    - Object with keys matching all state fields
    - Each field provides a subscribe function that:
      - Executes callback immediately with current value
      - Executes callback on every field change
      - Returns unsubscribe function

11. **`keyedSubscriptions: KeyedSubscriptionsMap<T>`**
    - Object with keys matching all state fields
    - Each field provides a function that takes a key and returns a subscribe function
    - Supports value-based subscriptions for specific keys

### Type System Limitations

There are known TypeScript limitations with string literal types and generic event maps:

```typescript
// Internal implementation uses type assertions
this.emitter.emit(eventName, fieldPatches);
this.emitter.emitKeyed(eventName, changedKey as any, fieldPatches as any);
```

**Why:** When working with generic string literal types (`EventNames<T>`) and keyed event maps, TypeScript can't always verify the exact type match due to limitations with generic type inference and mapped types.

**Important:** These limitations only affect internal implementation details. The public API provides full type safety:
- `update()` - Only accepts valid mutation functions
- `on()`/`once()`/`off()` - Only accepts valid event names
- `onKeyed()`/`onceKeyed()`/`offKeyed()` - Type-safe key access
- `subscribe` / `keyedSubscriptions` - Type-safe field access

## Development Guidelines

### Adding Features

1. **Maintain type safety:** Any new methods should preserve the generic type `T`.

2. **Support multiple patch generation libraries:** Ensure features work with both patch-recorder (default) and optional libraries like mutative/immer.

3. **Test with both objects and arrays:** Ensure features work with complex objects and arrays.

4. **Test keyed events:** Verify that keyed subscriptions work correctly for Records and Arrays.

5. **Test value-based subscriptions:** Ensure `subscribe` API provides immediate execution and correct values.

### Testing Patterns

Tests should cover:
- Basic field updates
- Nested object modifications
- Array operations (push, splice, etc.)
- Multiple subscribers to same event
- Unsubscribing from events
- Type safety violations (using `// @ts-expect-error`)

Example test structure:
```typescript
type State = {
  counter: { value: number };
  user: { name: string; age: number };
};

const store = createObservableStore<State>({ ... });

const callback = vi.fn();
store.on('counter:updated', callback);

store.update((state) => {
  state.counter.value += 1;
});

expect(callback).toHaveBeenCalledWith([
  { op: 'replace', path: ['counter', 'value'], value: 1 }
]);
```

### Common Pitfalls

1. **Assuming patches are relative to field:** Patches are relative to the full state root, not to individual fields. The store groups them by top-level field but the patch paths start from root.

2. **Trying to emit on entire state:** Events are only emitted per-field, not for the entire state.

3. **Mutating state directly:** Always use the [`update()`](src/index.ts:106) method with the state, never mutate `this.state` directly.

4. **Forgetting keyed events only emit when listeners exist:** Keyed events are conditionally emitted for performance. They only fire when there are active keyed listeners.

## File Structure

```
src/
├── index.ts       # Main implementation (ObservableStore class)
├── types.ts       # Type utilities (EventName, Patches, etc.)
test/
├── index.test.ts  # Comprehensive test suite
```

## Dependencies

- **patch-recorder:** Default patch generation library (mutable, keeps references)
- **radiate:** Provides `createEmitter()`, `Emitter` type, and keyed event support
- **mutative:** Optional dependency for immutable state updates

## Build System

- **TypeScript:** `tsc` for compilation
- **Vitest:** For testing
- **Prettier:** For code formatting

Run tests: `pnpm test`
Build: `pnpm build`
Format: `pnpm format`
Watch build: `pnpm dev`

## Example Usage Patterns

### Simple Counter
```typescript
type State = {
  counter: number;
};

const store = createObservableStore<State>({
  counter: 0
});

store.update((state) => {
  state.counter += 1;
});
```

### User Management
```typescript
type State = {
  users: Record<string, { name: string; email: string }>;
};

const store = createObservableStore<State>({
  users: {
    '1': { name: 'John', email: 'john@example.com' }
  }
});

store.update((state) => {
  state.users['2'] = { name: 'Jane', email: 'jane@example.com' };
});
```

### Todo List
```typescript
type State = {
  todos: Array<{ id: number; text: string; done: boolean }>;
};

const store = createObservableStore<State>({
  todos: []
});

store.update((state) => {
  state.todos.push({ id: 1, text: 'Learn TypeScript', done: false });
});
```

## When to Use This Library

Use observator (ObservableStore) when you need:
- Fine-grained reactivity (know exactly which field changed)
- Type-safe event subscriptions
- JSON Patch support for change tracking
- Patch generation library agnostic (use patch-recorder, mutative, immer, or custom)
- Value-based subscriptions with immediate execution
- Keyed subscriptions for Record/Array fields

## When NOT to Use This Library

Consider alternatives if:
- You need complex middleware or plugin system (use Redux, Zustand)
- You need time-travel debugging (use Redux with proper middleware)
- You have very simple state that doesn't need fine-grained events (use plain React state)

## Contributing

When contributing:
1. Maintain type safety with generic type `T`
2. Add tests for new features
3. Update documentation in README.md and AGENTS.md
4. Ensure TypeScript compilation passes
5. Format code with Prettier

## Questions?

If you encounter issues with:
- Type errors: Check your state type definitions and event names
- Empty patches: Verify you're using a compatible patch generation library
- Event not firing: Ensure you're using correct event name format (`${field}:updated`)
- Keyed events not firing: Check that you have active keyed listeners (they're conditional)