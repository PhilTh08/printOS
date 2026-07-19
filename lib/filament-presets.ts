export type FilamentPreset = {
  ean: string;
  manufacturer: string;
  material: string;
  color: string;
  weightPerRoll: number;
  price: number;
  variant?: "Refill" | "Rolle";
};

export const FILAMENT_PRESETS: FilamentPreset[] = [
  // PETG HF
  { ean: "6975337038207", manufacturer: "Bambu Lab", material: "PETG HF", color: "White", weightPerRoll: 1000, price: 25.99 },
  { ean: "6975337038221", manufacturer: "Bambu Lab", material: "PETG HF", color: "Black", weightPerRoll: 1000, price: 25.99 },
  { ean: "6975337038214", manufacturer: "Bambu Lab", material: "PETG HF", color: "Gray", weightPerRoll: 1000, price: 25.99 },
  { ean: "6975337038245", manufacturer: "Bambu Lab", material: "PETG HF", color: "Red", weightPerRoll: 1000, price: 25.99 },
  { ean: "6975337038269", manufacturer: "Bambu Lab", material: "PETG HF", color: "Blue", weightPerRoll: 1000, price: 25.99 },

  // PETG Translucent
  { ean: "6975337038016", manufacturer: "Bambu Lab", material: "PETG Translucent", color: "Clear", weightPerRoll: 1000, price: 25.99 },
  { ean: "6975337036005", manufacturer: "Bambu Lab", material: "PETG Translucent", color: "Orange", weightPerRoll: 1000, price: 25.99 },
  { ean: "921159956009", manufacturer: "Bambu Lab", material: "PETG Translucent", color: "Pink", weightPerRoll: 1000, price: 25.99 },
  { ean: "6975337036104", manufacturer: "Bambu Lab", material: "PETG Translucent", color: "Purple", weightPerRoll: 1000, price: 25.99 },
  { ean: "6975337035992", manufacturer: "Bambu Lab", material: "PETG Translucent", color: "Teal", weightPerRoll: 1000, price: 25.99 },
  { ean: "6975337035978", manufacturer: "Bambu Lab", material: "PETG Translucent", color: "Olive", weightPerRoll: 1000, price: 25.99 },
  { ean: "6975337035961", manufacturer: "Bambu Lab", material: "PETG Translucent", color: "Light Blue", weightPerRoll: 1000, price: 25.99 },
  { ean: "6975337035985", manufacturer: "Bambu Lab", material: "PETG Translucent", color: "Brown", weightPerRoll: 1000, price: 25.99 },

  // PETG-CF
  { ean: "6975337032243", manufacturer: "Bambu Lab", material: "PETG-CF", color: "Black", weightPerRoll: 1000, price: 35.99 },
  { ean: "6975337032502", manufacturer: "Bambu Lab", material: "PETG-CF", color: "Indigo Blue", weightPerRoll: 1000, price: 35.99 },
  { ean: "6975337033707", manufacturer: "Bambu Lab", material: "PETG-CF", color: "Titan Gray", weightPerRoll: 1000, price: 35.99 },

  // PLA Basic Refill
  { ean: "6975337030164", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Jade White", weightPerRoll: 1000, price: 22.90, variant: "Refill" },
  { ean: "6975337030201", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Beige", weightPerRoll: 1000, price: 22.90, variant: "Refill" },
  { ean: "6977252427197", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Sunflower Yellow", weightPerRoll: 1000, price: 22.90, variant: "Refill" },
  { ean: "6975337037354", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Gold", weightPerRoll: 1000, price: 22.90, variant: "Refill" },
  { ean: "6977252426954", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Pumpkin Orange", weightPerRoll: 1000, price: 22.90, variant: "Refill" },
  { ean: "6977252426978", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Hot Pink", weightPerRoll: 1000, price: 22.90, variant: "Refill" },
  { ean: "6975337037392", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Magenta", weightPerRoll: 1000, price: 22.90, variant: "Refill" },
  { ean: "6977252427203", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Maroon Red", weightPerRoll: 1000, price: 22.90, variant: "Refill" },
  { ean: "6975337037378", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Purple", weightPerRoll: 1000, price: 22.90, variant: "Refill" },
  { ean: "6977252427227", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Indigo Purple", weightPerRoll: 1000, price: 22.90, variant: "Refill" },
  { ean: "6977252426961", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Cobalt Blue", weightPerRoll: 1000, price: 22.90, variant: "Refill" },
  { ean: "6977252426992", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Bright Green", weightPerRoll: 1000, price: 22.90, variant: "Refill" },
  { ean: "6975337039082", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Light Gray", weightPerRoll: 1000, price: 22.90, variant: "Refill" },
  { ean: "6975337030195", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Gray", weightPerRoll: 1000, price: 22.90, variant: "Refill" },
  { ean: "6975337039075", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Dark Gray", weightPerRoll: 1000, price: 22.90, variant: "Refill" },
  { ean: "6975337030232", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Blue Gray", weightPerRoll: 1000, price: 22.90, variant: "Refill" },
  { ean: "6975337037361", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Bronze", weightPerRoll: 1000, price: 22.90, variant: "Refill" },
  { ean: "6975337030263", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Brown", weightPerRoll: 1000, price: 22.90, variant: "Refill" },

  // PLA Basic Rolle
  { ean: "6975337031956", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Yellow", weightPerRoll: 1000, price: 25.99, variant: "Rolle" },
  { ean: "6975337032311", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Orange", weightPerRoll: 1000, price: 25.99, variant: "Rolle" },
  { ean: "6975337032359", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Pink", weightPerRoll: 1000, price: 25.99, variant: "Rolle" },
  { ean: "6975337031413", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Red", weightPerRoll: 1000, price: 25.99, variant: "Rolle" },
  { ean: "6975337032052", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Cyan", weightPerRoll: 1000, price: 25.99, variant: "Rolle" },
  { ean: "6975337032533", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Blue", weightPerRoll: 1000, price: 25.99, variant: "Rolle" },
  { ean: "6975337033684", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Bambu Green", weightPerRoll: 1000, price: 25.99, variant: "Rolle" },
  { ean: "6975337035046", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Mistletoe Green", weightPerRoll: 1000, price: 25.99, variant: "Rolle" },
  { ean: "6975337031390", manufacturer: "Bambu Lab", material: "PLA Basic", color: "Silver", weightPerRoll: 1000, price: 25.99, variant: "Rolle" },
];

const PRESET_BY_EAN = new Map(
  FILAMENT_PRESETS.map((preset) => [preset.ean, preset]),
);

export function normalizeFilamentEan(ean: string): string {
  return ean.replace(/[^0-9]/g, "");
}

export function findFilamentPresetByEan(
  ean: string,
): FilamentPreset | undefined {
  return PRESET_BY_EAN.get(normalizeFilamentEan(ean));
}

export function formatPresetPrice(price: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}
