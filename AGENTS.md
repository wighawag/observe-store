# AGENTS.md

This document provides guidance for AI agents working on the `observe-store` project.

## Project Overview

**observe-store** is a TypeScript library that provides a type-safe mutative store. It uses:
- [mutative](https://github.com/unadlib/mutative) for immutable state updates and patch generation
- [radiate](https://github.com/wighawag/radiate) for type-safe event emission

The store emits events for each top-level field change with JSON Patch arrays, enabling fine-grained reactivity.

## Key Design Decisions

### 1. Non-Primitive Type Constraint

**Critical:** Top-level fields must be objects or arrays, NOT primitives.

**Reason:** `mutative` requires objects or arrays to generate JSON patches. When you call `mutative.create()` on a primitive value (number, string, boolean), it returns empty patches.

**Pattern for primitives:** Wrap primitives in objects:
```typescript
// ❌ Don't do this
type BadState = {
  count: number;
};

// ✅ Do this instead
type GoodState = {
  count: { value: number };
};
```

### 2. Event Naming Convention

Events are named as `${fieldName}:updated` (e.g., `user:updated`, `counter:updated`).

This is enforced by TypeScript types:
```typescript
type EventName<K extends string> = `${K}:updated`;
```

### 3. Patch Structure

Patches are generated relative to the field being updated:
- For `{ count: { value: 0 } }`, updating `value` produces: `[{ op: 'replace', path: ['value'], value: 1 }]`
- For `{ user: { name: 'John' } }`, updating `name` produces: `[{ op: 'replace', path: ['name'], value: 'Jane' }]`

All patches follow [JSON Patch (RFC 6902)](https://datatracker.ietf.org/doc/html/rfc6902) format.

### 4. Type Safety

The library provides comprehensive type safety:
- Only valid field names can be used in `update()`
- Only valid event names can be used in `on()`
- Primitive types at top level are rejected at compile time

## Architecture

### Core Types

```typescript
type NonPrimitive = object | Array<unknown>;

type EventName<K extends string> = `${K}:updated`;

type EventMap<T extends Record<string, NonPrimitive>> = {
  [K in keyof T as EventName<K & string>]: Patches<true>;
};

export class ObservableStore<T extends Record<string, NonPrimitive>> {
  private emitter: Emitter<EventMap<T>>;
  // ...
}
```

### Key Methods

1. **`update<K>(key: K, mutate: (draft: Draft<T[K]>) => void): void`**
   - Updates a specific field
   - Emits `${key}:updated` event with patches
   - Only mutates `this.state[key]`, not the entire state

2. **`get<K>(name: K): T[K]`**
   - Gets current value of a field
   - Returns readonly reference

3. **`on<K>(event: EventName<K>, callback: (patches: Patches<true>) => void): () => void`**
   - Subscribes to field updates
   - Returns unsubscribe function

4. **`off<K>(event: EventName<K>, callback: (patches: Patches<true>) => void): void`**
   - Removes a specific event listener
   - Must pass the exact callback function used in `on()`

5. **`once<K>(event: EventName<K>, callback: (patches: Patches<true>) => void): () => void`**
   - Subscribes to a single emission of an event
   - Automatically unsubscribes after the first callback
   - Returns unsubscribe function to remove listener before it fires

6. **`getState(): T`**
   - Returns shallow copy of entire state

### Type System Limitations

There's a known TypeScript limitation with string literal types in the internal `emit` implementation:

```typescript
// Internal implementation uses type assertion
this.emitter.emit(eventName, patches as any);
```

**Why:** When accessing `EventMap<T>[keyof EventMap<T>]`, TypeScript sees this as a union of all patch types. Even though all events have the same type (`Patches<true>`), TypeScript can't verify this due to limitations with generic string literal types and mapped types.

**Important:** This limitation only affects internal implementation details. The public API (`update()`, `on()`, `get()`, `getState()`) provides full type safety and does not require any type assertions from users.

## Development Guidelines

### Adding Features

1. **Maintain type safety:** Any new methods should preserve the generic type `T` and enforce the non-primitive constraint.

2. **Test with both objects and arrays:** Ensure features work with complex objects and arrays.

3. **Test primitive wrappers:** Verify that primitive wrapper pattern works correctly.

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

store.update('counter', (draft) => {
  draft.value += 1;
});

expect(callback).toHaveBeenCalledWith([
  { op: 'replace', path: ['value'], value: 1 }
]);
```

### Common Pitfalls

1. **Forgetting to wrap primitives:** Always check if a state type includes primitives and suggest wrapping them.

2. **Trying to emit on entire state:** Events are only emitted per-field, not for the entire state.

3. **Assuming patches are relative to root:** Patches are relative to the field being updated, not the entire state object.

4. **Mutating state directly:** Always use the `update` method with the draft, never mutate `this.state` directly.

## File Structure

```
src/
├── index.ts       # Main implementation (ObservableStore class)
├── types.ts       # Type utilities (currently empty, types in index.ts)
test/
├── index.test.ts  # Comprehensive test suite
examples/
└── simple.ts      # Usage examples
```

## Dependencies

- **mutative:** Provides `create()`, `Draft`, and `Patches` types
- **radiate:** Provides `createEmitter()` and `Emitter` type

## Build System

- **TypeScript:** `tsc` for compilation
- **Vitest:** For testing
- **Prettier:** For code formatting

Run tests: `pnpm test`
Build: `pnpm build`
Format: `pnpm format`
Run examples: `pnpm tsx examples/<filename>.ts`

## Example Usage Patterns

### Simple Counter
```typescript
type State = {
  counter: { value: number };
};

const store = createObservableStore<State>({
  counter: { value: 0 }
});

store.update('counter', (draft) => {
  draft.value += 1;
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

store.update('users', (draft) => {
  draft['2'] = { name: 'Jane', email: 'jane@example.com' });
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

store.update('todos', (draft) => {
  draft.push({ id: 1, text: 'Learn TypeScript', done: false });
});
```

## When to Use This Library

Use mutative-emitter (ObservableStore) when you need:
- Fine-grained reactivity (know exactly which field changed)
- Type-safe event subscriptions
- JSON Patch support for change tracking
- Immutable state updates with minimal boilerplate

## When NOT to Use This Library

Consider alternatives if:
- You need primitive values at top level (use immer or similar)
- You need complex middleware or plugin system (use Redux, Zustand)
- You need time-travel debugging (use Redux with proper middleware)
- You have very simple state that doesn't need fine-grained events (use plain React state)

## Contributing

When contributing:
1. Maintain the non-primitive constraint
2. Add tests for new features
3. Update documentation in README.md
4. Ensure TypeScript compilation passes
5. Format code with Prettier

## Questions?

If you encounter issues with:
- Type errors: Check if you're trying to use primitives at top level
- Empty patches: Verify you're mutating an object/array, not a primitive
- Event not firing: Ensure you're using correct event name format (`${field}:updated`)