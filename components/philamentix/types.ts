export type StockMode = "in" | "out";
export type LogSource = "scan" | "manual";
export type StatisticsRange = "7" | "30" | "90" | "all";
export type FilamentImageMode =
  | "off"
  | "small"
  | "large";

export type OrderStatus =
  | "open"
  | "in_progress"
  | "completed"
  | "cancelled";

export type Order = {
  id: string;
  userId: string;
  title: string;
  customerName: string;
  status: OrderStatus;
  dueDate: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type OrderForm = {
  title: string;
  customerName: string;
  status: OrderStatus;
  dueDate: string;
  notes: string;
};

export type OrderRow = {
  id: string;
  user_id: string;
  title: string;
  customer_name: string;
  status: OrderStatus;
  due_date: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type FilamentDefaults = {
  manufacturer: string;
  material: string;
  weightPerRoll: number;
  location: string;
  minimumStock: number;
};

export type Filament = {
  id: number;
  userId: string;
  barcode: string;
  manufacturer: string;
  material: string;
  color: string;
  weightPerRoll: number;
  location: string;
  minimumStock: number;
  stock: number;
  orderLink: string;
  imageUrl: string;
};

export type FilamentForm = Omit<Filament, "id" | "userId">;

export type LogEntry = {
  id: string;
  userId: string;
  timestamp: string;
  action: StockMode;
  source: LogSource;
  filamentId: number | null;
  filamentName: string;
  barcode: string;
  stockAfter: number;
};

export type FilamentRow = {
  id: number;
  user_id: string;
  barcode: string;
  manufacturer: string;
  material: string;
  color: string;
  weight_per_roll: number;
  location: string;
  minimum_stock: number;
  stock: number;
  order_link: string;
  image_url: string | null;
};

export type LogRow = {
  id: string;
  user_id: string;
  created_at: string;
  action: StockMode;
  source: LogSource;
  filament_id: number | null;
  filament_name: string;
  barcode: string;
  stock_after: number;
};

export type BackupScope =
  | "full"
  | "orders";

export type BackupData = {
  version: 2;
  scope: BackupScope;
  exportedAt: string;
  filaments: Array<
    Omit<Filament, "id" | "userId">
  >;
  logs: Array<
    Omit<
      LogEntry,
      "id" | "userId" | "filamentId"
    >
  >;
  orders: Array<
    Omit<Order, "id" | "userId">
  >;
};

export type MaterialSummary = {
  material: string;
  stock: number;
  weight: number;
  typeCount: number;
  criticalCount: number;
  incoming: number;
  outgoing: number;
  activity: number;
  lastIn: string | null;
  lastOut: string | null;
};

export const defaultFilamentDefaults: FilamentDefaults = {
  manufacturer: "",
  material: "PLA",
  weightPerRoll: 1000,
  location: "",
  minimumStock: 1,
};

export const emptyOrderForm: OrderForm = {
  title: "",
  customerName: "",
  status: "open",
  dueDate: "",
  notes: "",
};

export const emptyFilamentForm: FilamentForm = {
  barcode: "",
  manufacturer:
    defaultFilamentDefaults.manufacturer,
  material: defaultFilamentDefaults.material,
  color: "",
  weightPerRoll:
    defaultFilamentDefaults.weightPerRoll,
  location: defaultFilamentDefaults.location,
  minimumStock:
    defaultFilamentDefaults.minimumStock,
  stock: 0,
  orderLink: "",
  imageUrl: "",
};

export function normalizeBarcode(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

export function filamentLabel(filament: Filament): string {
  return `${filament.manufacturer} ${filament.material} ${filament.color}`;
}
