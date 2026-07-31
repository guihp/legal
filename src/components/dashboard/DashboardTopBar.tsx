export function DashboardTopBar() {
  return (
    <nav
      aria-label="Breadcrumb"
      className="hidden sm:flex text-sm text-muted-foreground whitespace-nowrap min-w-0"
    >
      <span>Analytics</span>
      <span className="mx-1.5 opacity-60">/</span>
      <span className="font-semibold text-foreground">Painel</span>
    </nav>
  );
}
