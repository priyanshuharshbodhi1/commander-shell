import type { FleetSignal, FleetSignalType } from './types.js';

type Listener<T extends FleetSignalType> = (
  signal: Extract<FleetSignal, { type: T }>,
) => void;

type AnyListener = (signal: FleetSignal) => void;

/** Unsubscribe handle returned by {@link FleetEmitter.on} / `.onAny`. */
export type Unsubscribe = () => void;

/**
 * Typed pub/sub bus for {@link FleetSignal}s. Listeners registered for a given
 * `type` only see signals of that type; `onAny` sees everything.
 */
export class FleetEmitter {
  private readonly typed = new Map<FleetSignalType, Set<AnyListener>>();
  private readonly all = new Set<AnyListener>();

  /** Subscribe to one signal type. Returns an unsubscribe callback. */
  on<T extends FleetSignalType>(type: T, listener: Listener<T>): Unsubscribe {
    const wrapped = listener as AnyListener;
    let set = this.typed.get(type);
    if (!set) {
      set = new Set();
      this.typed.set(type, set);
    }
    set.add(wrapped);
    return () => {
      set?.delete(wrapped);
    };
  }

  /** Subscribe to every signal regardless of type. */
  onAny(listener: AnyListener): Unsubscribe {
    this.all.add(listener);
    return () => {
      this.all.delete(listener);
    };
  }

  /** Publish one signal. Listener exceptions are caught and ignored. */
  emit(signal: FleetSignal): void {
    const byType = this.typed.get(signal.type);
    if (byType) {
      for (const l of byType) safeInvoke(l, signal);
    }
    for (const l of this.all) safeInvoke(l, signal);
  }

  /** Drop every listener. Mostly for tests. */
  clear(): void {
    this.typed.clear();
    this.all.clear();
  }
}

function safeInvoke(listener: AnyListener, signal: FleetSignal): void {
  try {
    listener(signal);
  } catch {
    // Listener crashes must not poison other subscribers.
  }
}
