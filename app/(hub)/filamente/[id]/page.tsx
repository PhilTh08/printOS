import { FilamentDetailClient } from "./filament-detail-client";

export default async function FilamentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ id }, query] = await Promise.all([
    params,
    searchParams,
  ]);

  return (
    <FilamentDetailClient
      filamentId={Number(id)}
      wasCreated={query.created === "1"}
    />
  );
}
