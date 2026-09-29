import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowRight, PlaneTakeoff, Search, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  durationLabel,
  formatDateTime,
  formatMoney,
  formatTime,
  type Flight,
} from "@/lib/airline";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Skyline Air — Flight search & seat booking" },
      {
        name: "description",
        content:
          "Browse Skyline Air flights, pick your seat on a live cabin map and get an instant PDF ticket.",
      },
      { property: "og:title", content: "Skyline Air — Flight search & seat booking" },
      {
        property: "og:description",
        content:
          "Browse Skyline Air flights, pick your seat on a live cabin map and get an instant PDF ticket.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function useFlightBoard() {
  return useQuery({
    queryKey: ["flight-board"],
    queryFn: async () => {
      const [{ data: flights, error }, { data: bookings }] = await Promise.all([
        supabase.from("flights").select("*").order("depart_at"),
        supabase.from("bookings").select("flight_id"),
      ]);
      if (error) throw error;
      const taken = new Map<string, number>();
      (bookings ?? []).forEach((b) =>
        taken.set(b.flight_id, (taken.get(b.flight_id) ?? 0) + 1),
      );
      return (flights ?? []).map((f) => ({
        ...(f as unknown as Flight),
        seatsLeft: f.rows_count * f.seats_per_row - (taken.get(f.id) ?? 0),
      }));
    },
  });
}

function Index() {
  const { data, isLoading } = useFlightBoard();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const results = useMemo(() => {
    const match = (value: string, a: string, b: string) =>
      !value.trim() ||
      a.toLowerCase().includes(value.trim().toLowerCase()) ||
      b.toLowerCase().includes(value.trim().toLowerCase());
    return (data ?? []).filter(
      (f) =>
        match(from, f.origin, f.origin_city) && match(to, f.destination, f.destination_city),
    );
  }, [data, from, to]);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20">
      <section className="panel mt-8 overflow-hidden p-8 sm:p-12">
        <p className="board-text text-xs text-primary">Reservation system · live cabin map</p>
        <h1 className="mt-4 max-w-xl text-4xl font-bold sm:text-5xl">
          Search, seat and ticket a flight in under a minute.
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          Browse the schedule, pick a seat from the live aircraft layout, and download a
          generated PDF boarding pass. Or just ask the assistant to do it for you.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input
              id="from"
              placeholder="Delhi or DEL"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id="to"
              placeholder="Dubai or DXB"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              className="h-10 w-full sm:w-auto"
              onClick={() => {
                setFrom(from.trim());
                setTo(to.trim());
              }}
            >
              <Search className="size-4" /> Search
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Departures</h2>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Loading…" : `${results.length} flights`}
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}

          {!isLoading && results.length === 0 && (
            <div className="panel p-10 text-center text-muted-foreground">
              No flights match that route. Try Delhi, Mumbai, Goa, Dubai or Singapore.
            </div>
          )}

          {results.map((flight) => (
            <article
              key={flight.id}
              className="panel flex flex-col gap-4 p-5 transition-colors hover:border-primary/60 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-40 items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-secondary">
                  <PlaneTakeoff className="size-5 text-primary" />
                </span>
                <div>
                  <p className="board-text text-sm font-semibold">{flight.flight_no}</p>
                  <p className="text-xs text-muted-foreground">{flight.aircraft}</p>
                </div>
              </div>

              <div className="flex flex-1 items-center gap-4">
                <div>
                  <p className="text-xl font-semibold">{formatTime(flight.depart_at)}</p>
                  <p className="text-xs text-muted-foreground">
                    {flight.origin} · {flight.origin_city}
                  </p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-xs text-muted-foreground">
                    {durationLabel(flight.depart_at, flight.arrive_at)}
                  </p>
                  <div className="my-1 h-px w-full bg-border" />
                  <p className="text-[11px] text-muted-foreground">
                    {formatDateTime(flight.depart_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold">{formatTime(flight.arrive_at)}</p>
                  <p className="text-xs text-muted-foreground">
                    {flight.destination} · {flight.destination_city}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                <div className="text-right">
                  <p className="text-lg font-semibold text-primary">
                    {formatMoney(Number(flight.base_fare))}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="size-3" /> {flight.seatsLeft} seats left
                  </p>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link to="/flights/$flightId" params={{ flightId: flight.id }}>
                    Select seat <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
