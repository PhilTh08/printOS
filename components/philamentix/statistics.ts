import type {
  Filament,
  LogEntry,
  MaterialSummary,
  StatisticsRange,
} from "./types";

export function logsForRange(
  logs: LogEntry[],
  range: StatisticsRange,
  now = Date.now(),
): LogEntry[] {
  if (range === "all") {
    return logs;
  }

  const threshold =
    now - Number(range) * 24 * 60 * 60 * 1000;

  return logs.filter(
    (entry) =>
      new Date(entry.timestamp).getTime() >= threshold,
  );
}

export function buildMaterialSummary(
  filaments: Filament[],
  logs: LogEntry[],
): MaterialSummary[] {
  const summary = new Map<string, MaterialSummary>();

  for (const filament of filaments) {
    const existing = summary.get(filament.material) ?? {
      material: filament.material,
      stock: 0,
      weight: 0,
      typeCount: 0,
      criticalCount: 0,
      incoming: 0,
      outgoing: 0,
      activity: 0,
      lastIn: null,
      lastOut: null,
    };

    existing.stock += filament.stock;
    existing.weight +=
      filament.stock * filament.weightPerRoll;
    existing.typeCount += 1;
    existing.criticalCount +=
      filament.stock <= filament.minimumStock ? 1 : 0;
    summary.set(filament.material, existing);
  }

  const byBarcode = new Map(
    filaments.map((filament) => [
      filament.barcode,
      filament,
    ]),
  );

  for (const entry of logs) {
    const filament = byBarcode.get(entry.barcode);
    const material = filament?.material;

    if (!material) {
      continue;
    }

    const existing = summary.get(material);

    if (!existing) {
      continue;
    }

    existing.activity += 1;

    if (entry.action === "in") {
      existing.incoming += 1;
      if (
        !existing.lastIn ||
        new Date(entry.timestamp).getTime() >
          new Date(existing.lastIn).getTime()
      ) {
        existing.lastIn = entry.timestamp;
      }
    } else {
      existing.outgoing += 1;
      if (
        !existing.lastOut ||
        new Date(entry.timestamp).getTime() >
          new Date(existing.lastOut).getTime()
      ) {
        existing.lastOut = entry.timestamp;
      }
    }
  }

  return [...summary.values()].sort(
    (a, b) => b.stock - a.stock,
  );
}

export function buildMovementChart(
  logs: LogEntry[],
  range: StatisticsRange,
  now = new Date(),
) {
  const dayCount =
    range === "7"
      ? 7
      : range === "30"
        ? 15
        : range === "90"
          ? 18
          : 12;

  if (range === "all") {
    const buckets = Array.from(
      { length: dayCount },
      (_, index) => {
        const date = new Date(
          now.getFullYear(),
          now.getMonth() - (dayCount - 1 - index),
          1,
        );
        return {
          key: `${date.getFullYear()}-${date.getMonth()}`,
          label: date.toLocaleDateString("de-DE", {
            month: "short",
          }),
          incoming: 0,
          outgoing: 0,
        };
      },
    );

    const byKey = new Map(
      buckets.map((bucket) => [bucket.key, bucket]),
    );

    for (const entry of logs) {
      const date = new Date(entry.timestamp);
      const bucket = byKey.get(
        `${date.getFullYear()}-${date.getMonth()}`,
      );
      if (bucket) {
        bucket[entry.action === "in" ? "incoming" : "outgoing"] += 1;
      }
    }

    return buckets;
  }

  const totalDays = Number(range);
  const bucketSize = Math.max(
    1,
    Math.ceil(totalDays / dayCount),
  );
  const buckets = Array.from(
    { length: dayCount },
    (_, index) => {
      const endOffset =
        (dayCount - 1 - index) * bucketSize;
      const startOffset = Math.min(
        totalDays - 1,
        endOffset + bucketSize - 1,
      );
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - startOffset);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      end.setDate(end.getDate() - endOffset);

      return {
        start: start.getTime(),
        end: end.getTime(),
        label:
          bucketSize === 1
            ? end.toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "2-digit",
              })
            : end.toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "2-digit",
              }),
        incoming: 0,
        outgoing: 0,
      };
    },
  );

  for (const entry of logs) {
    const timestamp = new Date(entry.timestamp).getTime();
    const bucket = buckets.find(
      (candidate) =>
        timestamp >= candidate.start &&
        timestamp <= candidate.end,
    );

    if (bucket) {
      bucket[entry.action === "in" ? "incoming" : "outgoing"] += 1;
    }
  }

  return buckets;
}

export function buildFilamentActivity(
  filaments: Filament[],
  logs: LogEntry[],
) {
  return filaments
    .map((filament) => {
      const entries = logs.filter(
        (entry) => entry.barcode === filament.barcode,
      );
      const incoming = entries.filter(
        (entry) => entry.action === "in",
      ).length;
      const outgoing = entries.filter(
        (entry) => entry.action === "out",
      ).length;

      return {
        filament,
        incoming,
        outgoing,
        activity: incoming + outgoing,
      };
    })
    .sort((a, b) => b.activity - a.activity);
}
