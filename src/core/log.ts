// Append-only event log: one line per notification, so support can trace
// exactly what happened to a payment.
import type { Clock, LogEntry } from './types';

export function createLog(clock: Clock) {
  let entries: LogEntry[] = [];
  return {
    add(entry: Omit<LogEntry, 'seq' | 'atMs'>): LogEntry {
      const full = { ...entry, seq: entries.length + 1, atMs: clock.nowMs() };
      entries.push(full);
      return full;
    },
    all(): LogEntry[] {
      return entries.map((e) => ({ ...e }));
    },
    clear(): void {
      entries = [];
    },
  };
}
