import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Node 22+ ships a built-in `localStorage` global (guarded by the
// `--experimental-webstorage` flag) that shadows jsdom's own Storage
// implementation on `globalThis`. That built-in is a stub outside a real
// browser (no getItem/setItem/etc.), so component tests that touch
// `localStorage` need it replaced with a working in-memory implementation.
// jsdom's `sessionStorage` is unaffected and left alone.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

function patchStorage(name: "localStorage" | "sessionStorage"): void {
  const current = (globalThis as unknown as Record<string, Storage | undefined>)[name];
  if (current && typeof current.setItem === "function") return; // already a working implementation
  Object.defineProperty(globalThis, name, {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
}

if (typeof window !== "undefined") {
  patchStorage("localStorage");
  patchStorage("sessionStorage");
}

// Auto-unmount React Testing Library trees between tests. RTL's own
// auto-cleanup relies on a *global* `afterEach` (only present when
// `test.globals: true`); this project imports test APIs explicitly, so
// without this hook, component test files with more than one `render()`
// in a describe block leak DOM across tests.
if (typeof window !== "undefined") {
  afterEach(cleanup);
}
