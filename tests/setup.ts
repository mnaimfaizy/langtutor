// Registers an in-memory IndexedDB (and IDBKeyRange) on globalThis so Dexie runs under
// Vitest's node environment. Tests use unique DB names and delete them in afterEach for
// isolation.
import "fake-indexeddb/auto";
