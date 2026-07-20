import type {
  BackupData,
  BackupScope,
  Filament,
  LogEntry,
  LogSource,
  Order,
  OrderStatus,
  StockMode,
} from "./types";

const CSV_COLUMNS = [
  "record_type",
  "backup_version",
  "scope",
  "exported_at",
  "barcode",
  "manufacturer",
  "material",
  "color",
  "weight_per_roll",
  "location",
  "minimum_stock",
  "stock",
  "order_link",
  "image_url",
  "timestamp",
  "action",
  "source",
  "filament_name",
  "stock_after",
  "title",
  "customer_name",
  "status",
  "due_date",
  "notes",
  "created_at",
  "updated_at",
] as const;

type CsvColumn =
  (typeof CSV_COLUMNS)[number];

type CsvRow = Record<
  CsvColumn,
  string
>;

const VALID_ORDER_STATUS =
  new Set<OrderStatus>([
    "open",
    "in_progress",
    "completed",
    "cancelled",
  ]);

function emptyRow(): CsvRow {
  return Object.fromEntries(
    CSV_COLUMNS.map(
      (column) => [column, ""],
    ),
  ) as CsvRow;
}

function protectSpreadsheetValue(
  value: string,
): string {
  return /^[=+\-@]/.test(value)
    ? `'${value}`
    : value;
}

function restoreSpreadsheetValue(
  value: string,
): string {
  return /^'[=+\-@]/.test(value)
    ? value.slice(1)
    : value;
}

function csvCell(
  value: unknown,
): string {
  const text =
    value === null ||
    value === undefined
      ? ""
      : protectSpreadsheetValue(
          String(value),
        );

  return `"${text.replace(
    /"/g,
    '""',
  )}"`;
}

function serializeRows(
  rows: CsvRow[],
): string {
  return [
    CSV_COLUMNS.map(csvCell).join(","),
    ...rows.map((row) =>
      CSV_COLUMNS.map(
        (column) =>
          csvCell(row[column]),
      ).join(","),
    ),
  ].join("\r\n");
}

function parseCsvRows(
  text: string,
): string[][] {
  const normalized = text.replace(
    /^\uFEFF/,
    "",
  );
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (
    let index = 0;
    index < normalized.length;
    index += 1
  ) {
    const character =
      normalized[index];

    if (quoted) {
      if (character === '"') {
        if (
          normalized[index + 1] ===
          '"'
        ) {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }

      continue;
    }

    if (character === '"') {
      quoted = true;
      continue;
    }

    if (character === ",") {
      row.push(
        restoreSpreadsheetValue(
          field,
        ),
      );
      field = "";
      continue;
    }

    if (
      character === "\r" ||
      character === "\n"
    ) {
      if (
        character === "\r" &&
        normalized[index + 1] ===
          "\n"
      ) {
        index += 1;
      }

      row.push(
        restoreSpreadsheetValue(
          field,
        ),
      );
      field = "";

      if (
        row.some(
          (value) => value !== "",
        )
      ) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    field += character;
  }

  if (quoted) {
    throw new Error(
      "Die CSV-Datei enthält ein nicht geschlossenes Anführungszeichen.",
    );
  }

  row.push(
    restoreSpreadsheetValue(field),
  );

  if (
    row.some(
      (value) => value !== "",
    )
  ) {
    rows.push(row);
  }

  return rows;
}

function requireNumber(
  value: string,
  fieldName: string,
  fallback = 0,
): number {
  if (!value.trim()) {
    return fallback;
  }

  const result = Number(value);

  if (!Number.isFinite(result)) {
    throw new Error(
      `Ungültiger Zahlenwert in „${fieldName}“.`,
    );
  }

  return result;
}

function normalizeIsoDate(
  value: string,
  fallback: string,
): string {
  if (!value.trim()) {
    return fallback;
  }

  const parsed = new Date(value);

  if (
    Number.isNaN(parsed.getTime())
  ) {
    throw new Error(
      `Ungültiges Datum: ${value}`,
    );
  }

  return parsed.toISOString();
}

function normalizeDueDate(
  value: string,
): string | null {
  if (!value.trim()) {
    return null;
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    throw new Error(
      `Ungültiges Fälligkeitsdatum: ${value}`,
    );
  }

  return value;
}

function toCsvRow(
  values: Partial<CsvRow>,
): CsvRow {
  return {
    ...emptyRow(),
    ...values,
  };
}

export function buildBackupCsv(
  data: BackupData,
): string {
  const rows: CsvRow[] = [
    toCsvRow({
      record_type: "meta",
      backup_version: String(
        data.version,
      ),
      scope: data.scope,
      exported_at: data.exportedAt,
    }),
  ];

  for (
    const filament of data.filaments
  ) {
    rows.push(
      toCsvRow({
        record_type: "filament",
        barcode: filament.barcode,
        manufacturer:
          filament.manufacturer,
        material: filament.material,
        color: filament.color,
        weight_per_roll: String(
          filament.weightPerRoll,
        ),
        location: filament.location,
        minimum_stock: String(
          filament.minimumStock,
        ),
        stock: String(
          filament.stock,
        ),
        order_link:
          filament.orderLink,
        image_url: filament.imageUrl,
      }),
    );
  }

  for (const log of data.logs) {
    rows.push(
      toCsvRow({
        record_type: "log",
        timestamp: log.timestamp,
        action: log.action,
        source: log.source,
        filament_name:
          log.filamentName,
        barcode: log.barcode,
        stock_after: String(
          log.stockAfter,
        ),
      }),
    );
  }

  for (const order of data.orders) {
    rows.push(
      toCsvRow({
        record_type: "order",
        title: order.title,
        customer_name:
          order.customerName,
        status: order.status,
        due_date:
          order.dueDate ?? "",
        notes: order.notes,
        created_at:
          order.createdAt,
        updated_at:
          order.updatedAt,
      }),
    );
  }

  return serializeRows(rows);
}

export function createFullBackupData({
  filaments,
  logs,
  orders,
}: {
  filaments: Filament[];
  logs: LogEntry[];
  orders: Order[];
}): BackupData {
  return {
    version: 2,
    scope: "full",
    exportedAt:
      new Date().toISOString(),
    filaments: filaments.map(
      ({
        id: _id,
        userId: _userId,
        ...filament
      }) => filament,
    ),
    logs: logs.map(
      ({
        id: _id,
        userId: _userId,
        filamentId: _filamentId,
        ...log
      }) => log,
    ),
    orders: orders.map(
      ({
        id: _id,
        userId: _userId,
        ...order
      }) => order,
    ),
  };
}

export function createOrdersBackupData(
  orders: Order[],
): BackupData {
  return {
    version: 2,
    scope: "orders",
    exportedAt:
      new Date().toISOString(),
    filaments: [],
    logs: [],
    orders: orders.map(
      ({
        id: _id,
        userId: _userId,
        ...order
      }) => order,
    ),
  };
}

export function downloadBackupCsv(
  data: BackupData,
  filePrefix: string,
) {
  const csv = buildBackupCsv(data);
  const blob = new Blob(
    [`\uFEFF${csv}`],
    {
      type:
        "text/csv;charset=utf-8",
    },
  );
  const url =
    URL.createObjectURL(blob);
  const link =
    document.createElement("a");

  link.href = url;
  link.download = `${filePrefix}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function parseBackupCsv(
  text: string,
): BackupData {
  const rawRows =
    parseCsvRows(text);

  if (rawRows.length < 2) {
    throw new Error(
      "Die CSV-Datei enthält keine Backup-Daten.",
    );
  }

  const header = rawRows[0];

  if (
    header.length !==
      CSV_COLUMNS.length ||
    !CSV_COLUMNS.every(
      (column, index) =>
        header[index] === column,
    )
  ) {
    throw new Error(
      "Die CSV-Datei hat nicht das erwartete Philamentix-Format.",
    );
  }

  const records = rawRows
    .slice(1)
    .map((values) => {
      const record =
        emptyRow();

      CSV_COLUMNS.forEach(
        (column, index) => {
          record[column] =
            values[index] ?? "";
        },
      );

      return record;
    });

  const meta = records.find(
    (record) =>
      record.record_type ===
      "meta",
  );

  if (!meta) {
    throw new Error(
      "Die CSV-Datei enthält keine Backup-Metadaten.",
    );
  }

  if (
    Number(meta.backup_version) !== 2
  ) {
    throw new Error(
      "Diese Backup-Version wird nicht unterstützt.",
    );
  }

  const scope = meta.scope;

  if (
    scope !== "full" &&
    scope !== "orders"
  ) {
    throw new Error(
      "Der Backup-Umfang ist ungültig.",
    );
  }

  const exportedAt =
    normalizeIsoDate(
      meta.exported_at,
      new Date().toISOString(),
    );

  const filaments =
    records
      .filter(
        (record) =>
          record.record_type ===
          "filament",
      )
      .map((record) => ({
        barcode: record.barcode,
        manufacturer:
          record.manufacturer,
        material: record.material,
        color: record.color,
        weightPerRoll:
          requireNumber(
            record.weight_per_roll,
            "Gewicht pro Rolle",
            1000,
          ),
        location: record.location,
        minimumStock:
          requireNumber(
            record.minimum_stock,
            "Mindestbestand",
            1,
          ),
        stock: requireNumber(
          record.stock,
          "Bestand",
          0,
        ),
        orderLink:
          record.order_link,
        imageUrl:
          record.image_url,
      }));

  const logs = records
    .filter(
      (record) =>
        record.record_type ===
        "log",
    )
    .map((record) => {
      const action: StockMode =
        record.action === "out"
          ? "out"
          : "in";
      const source: LogSource =
        record.source === "scan"
          ? "scan"
          : "manual";

      return {
        timestamp:
          normalizeIsoDate(
            record.timestamp,
            new Date().toISOString(),
          ),
        action,
        source,
        filamentName:
          record.filament_name ||
          "Unbekanntes Filament",
        barcode: record.barcode,
        stockAfter:
          requireNumber(
            record.stock_after,
            "Bestand nach Buchung",
            0,
          ),
      };
    });

  const orders = records
    .filter(
      (record) =>
        record.record_type ===
        "order",
    )
    .map((record) => {
      if (
        !VALID_ORDER_STATUS.has(
          record.status as OrderStatus,
        )
      ) {
        throw new Error(
          `Ungültiger Auftragsstatus: ${record.status}`,
        );
      }

      if (
        !record.title.trim()
      ) {
        throw new Error(
          "Ein Auftrag in der CSV-Datei hat keinen Titel.",
        );
      }

      const createdAt =
        normalizeIsoDate(
          record.created_at,
          exportedAt,
        );

      return {
        title: record.title.trim(),
        customerName:
          record.customer_name.trim(),
        status:
          record.status as OrderStatus,
        dueDate:
          normalizeDueDate(
            record.due_date,
          ),
        notes: record.notes,
        createdAt,
        updatedAt:
          normalizeIsoDate(
            record.updated_at,
            createdAt,
          ),
      };
    });

  if (
    scope === "orders" &&
    (
      filaments.length > 0 ||
      logs.length > 0
    )
  ) {
    throw new Error(
      "Ein Auftrags-Export darf keine Filament- oder Protokolldaten enthalten.",
    );
  }

  return {
    version: 2,
    scope:
      scope as BackupScope,
    exportedAt,
    filaments,
    logs,
    orders,
  };
}
