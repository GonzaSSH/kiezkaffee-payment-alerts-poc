// Providers deliver notifications "at least once", so repeats are normal.
// We remember every event ID we have processed and skip repeats.
// (Demo: in memory. Production: stored for the same 30 days as the log.)
export function createDedupe() {
  const seen = new Set<string>();
  return {
    /** Returns true the first time an ID is seen, false for every repeat. */
    firstTime(eventId: string): boolean {
      if (seen.has(eventId)) return false;
      seen.add(eventId);
      return true;
    },
    clear(): void {
      seen.clear();
    },
  };
}
