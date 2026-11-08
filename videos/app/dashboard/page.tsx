import DashboardView from "@/components/DashboardView";

export const metadata = { title: "Dashboard · VideoVault" };

/**
 * /dashboard — protegido por `proxy.ts` (redirige a /login sin sesión).
 * Los datos se piden desde el cliente a las Route Handlers, que vuelven a
 * validar el JWT en cada petición.
 */
export default function DashboardPage() {
  return <DashboardView />;
}
