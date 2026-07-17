import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Self-cleaning: unmount React trees between tests (parallel-safe).
afterEach(() => {
  cleanup();
  vi.useRealTimers(); // tests opt into fake timers explicitly [R9]
});

// Convention: for undo-window / relative-time units, call vi.useFakeTimers() in the test,
// advance with vi.advanceTimersByTime(5000). Never rely on wall-clock time.
