import { NewFilamentClient } from "./new-filament-client";

export default async function NewFilamentPage({
  searchParams,
}: {
  searchParams: Promise<{
    barcode?: string;
    stock?: string;
    source?: string;
  }>;
}) {
  const params = await searchParams;

  return (
    <NewFilamentClient
      initialBarcode={params.barcode ?? ""}
      initialStock={params.stock === "1" ? 1 : 0}
      fromScanner={params.source === "scanner"}
    />
  );
}
