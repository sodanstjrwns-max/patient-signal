/** Keep deep competitor measurements bounded while covering every paid slot over time. */
export function selectCompetitorsForAeo<
  T extends { id: string; createdAt: Date },
>(competitors: T[], planLimit: number, now: Date, perRun = 5): T[] {
  const ordered = [...competitors].sort(
    (a, b) =>
      a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
  );
  const eligible =
    planLimit === -1 ? ordered : ordered.slice(0, Math.max(0, planLimit));
  if (eligible.length === 0) return [];

  const batchSize = Math.min(perRun, eligible.length);
  const kstDay = Math.floor(
    (now.getTime() + 9 * 60 * 60 * 1000) / (24 * 60 * 60 * 1000),
  );
  const start = (kstDay * batchSize) % eligible.length;
  return Array.from(
    { length: batchSize },
    (_, index) => eligible[(start + index) % eligible.length],
  );
}
