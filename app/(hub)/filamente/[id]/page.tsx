import { FilamentDetailClient } from "./filament-detail-client";

export default async function FilamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <FilamentDetailClient filamentId={Number(id)} />
  );
}
