import { Link } from "@tanstack/react-router";
import { Bot, PlaneTakeoff, Ticket } from "lucide-react";

import { DEMO_PASSENGER } from "@/lib/airline";

const links = [
  { to: "/", label: "Flights", icon: PlaneTakeoff },
  { to: "/bookings", label: "My bookings", icon: Ticket },
  { to: "/assistant", label: "Assistant", icon: Bot },
] as const;

export function SiteNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <PlaneTakeoff className="size-5" />
          </span>
          <span className="board-text text-sm font-semibold">Skyline Air</span>
        </Link>

        <nav className="flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[status=active]:bg-secondary data-[status=active]:text-foreground"
            >
              <Icon className="size-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 text-right sm:flex">
          <div className="leading-tight">
            <p className="text-sm font-medium">{DEMO_PASSENGER.name}</p>
            <p className="text-xs text-muted-foreground">{DEMO_PASSENGER.email}</p>
          </div>
          <span className="grid size-9 place-items-center rounded-full bg-secondary text-sm font-semibold">
            RD
          </span>
        </div>
      </div>
    </header>
  );
}
