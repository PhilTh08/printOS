import type {
  Filament,
  FilamentForm,
  FilamentRow,
  LogEntry,
  LogRow,
  Order,
  OrderForm,
  OrderRow,
} from "./types";

export function rowToFilament(row: FilamentRow): Filament {
  return {
    id: row.id,
    userId: row.user_id,
    barcode: row.barcode,
    manufacturer: row.manufacturer,
    material: row.material,
    color: row.color,
    weightPerRoll: row.weight_per_roll,
    location: row.location,
    minimumStock: row.minimum_stock,
    stock: row.stock,
    orderLink: row.order_link,
    imageUrl: row.image_url ?? "",
  };
}

export function rowToLog(row: LogRow): LogEntry {
  return {
    id: row.id,
    userId: row.user_id,
    timestamp: row.created_at,
    action: row.action,
    source: row.source,
    filamentId: row.filament_id,
    filamentName: row.filament_name,
    barcode: row.barcode,
    stockAfter: row.stock_after,
  };
}

export function filamentFormToRow(
  form: FilamentForm,
  userId: string,
) {
  return {
    user_id: userId,
    barcode: form.barcode,
    manufacturer: form.manufacturer,
    material: form.material,
    color: form.color,
    weight_per_roll: form.weightPerRoll,
    location: form.location,
    minimum_stock: form.minimumStock,
    stock: form.stock,
    order_link: form.orderLink,
    image_url: form.imageUrl,
  };
}

export function filamentToForm(
  filament: Filament,
): FilamentForm {
  return {
    barcode: filament.barcode,
    manufacturer: filament.manufacturer,
    material: filament.material,
    color: filament.color,
    weightPerRoll: filament.weightPerRoll,
    location: filament.location,
    minimumStock: filament.minimumStock,
    stock: filament.stock,
    orderLink: filament.orderLink,
    imageUrl: filament.imageUrl,
  };
}


export function rowToOrder(
  row: OrderRow,
): Order {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    customerName: row.customer_name,
    status: row.status,
    dueDate: row.due_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function orderFormToRow(
  form: OrderForm,
  userId: string,
) {
  return {
    user_id: userId,
    title: form.title.trim(),
    customer_name: form.customerName.trim(),
    status: form.status,
    due_date: form.dueDate || null,
    notes: form.notes.trim(),
  };
}

export function orderToForm(
  order: Order,
): OrderForm {
  return {
    title: order.title,
    customerName: order.customerName,
    status: order.status,
    dueDate: order.dueDate ?? "",
    notes: order.notes,
  };
}
