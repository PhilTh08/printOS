import { HubProvider } from "@/components/philamentix/hub-provider";
import { HubShell } from "@/components/philamentix/hub-shell";

export default function HubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HubProvider>
      <HubShell>{children}</HubShell>
    </HubProvider>
  );
}
