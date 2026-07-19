export type StockMode = "in" | "out";
export type LogSource = "scan" | "manual";

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
};

export type FilamentForm = {
  barcode: string;
  manufacturer: string;
  material: string;
  color: string;
  weightPerRoll: number;
  location: string;
  minimumStock: number;
  stock: number;
  orderLink: string;
};

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

export const emptyFilamentForm: FilamentForm = {
  barcode: "",
  manufacturer: "",
  material: "PLA",
  color: "",
  weightPerRoll: 1000,
  location: "",
  minimumStock: 1,
  stock: 0,
  orderLink: "",
};

export function normalizeBarcode(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

export function filamentLabel(filament: Filament): string {
  return `${filament.manufacturer} ${filament.material} ${filament.color}`;
}
