import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Loader2, Plane } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DEMO_PASSENGER,
  buildSeatMap,
  durationLabel,
  formatDateTime,
  formatMoney,
  generatePnr,
  seatClass,
  seatFare,
  seatLetters,
  type Flight,
} from "@/lib/airline";

export const Route = createFileRoute("/flights/$flightId")({
  head: () => ({
    meta: [
      { title: "Choose your seat — Skyline Air" },
      {
        name: "description",
        content: "Pick a seat from the live cabin map and confirm your Skyline Air reservation.",
      },
      { property: "og:title", content: "Choose your seat — Skyline Air" },
      {
        property: "og:description",
        content: "Pick a seat from the live cabin map and confirm your Skyline Air reservation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SeatPage,
});

function SeatPage() {
  const { flightId } = Route.useParams();
  const navigate = useNavigate();
  const [seat, setSeat] = useState<string | null>(null);
  const [name, setName] = useState(DEMO_PASSENGER.name);
  const [saving, setSaving] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["flight", flightId],
    queryFn: async () => {
      const [{ data: flight, error }, { data: bookings }] = await Promise.all([
        supabase.from("flights").select("*").eq("id", flightId).maybeSingle(),
        supabase.from("bookings").select("seat_no").eq("flight_id", flightId),
      ]);
      if (error) throw error;
      return {
        flight: flight as unknown as Flight | null,
        taken: new Set((bookings ?? []).map((b) => b.seat_no)),
      };
    },
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Skeleton className="h-96 w-full rounded-xl" />
      </main>
    );
  }

  const flight = data?.flight;
  const taken = data?.taken ?? new Set<string>();

  if (!flight) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-20 text-center">
        <p className="text-muted-foreground">That flight no longer exists.</p>
        <Button asChild className="mt-4">
          <Link to="/">Back to flights</Link>
        </Button>
      </main>
    );
  }

  const rows = buildSeatMap(flight.rows_count, flight.seats_per_row);
  const letters = seatLetters(flight.seats_per_row);
  const half = Math.ceil(flight.seats_per_row / 2);

  async function confirm() {
    if (!seat || !flight) return;
    setSaving(true);
    const cabin = seatClass(seat);
    const { data: created, error } = await supabase
      .from("bookings")
      .insert({
        pnr: generatePnr(),
        flight_id: flight.id,
        passenger_name: name.trim() || DEMO_PASSENGER.name,
        passenger_email: DEMO_PASSENGER.email,
        seat_no: seat,
        cabin_class: cabin,
        fare: seatFare(Number(flight.base_fare), seat),
        status: "CONFIRMED",
      })
      .select("pnr")
      .single();
    setSaving(false);

    if (error) {
      toast.error("That seat was just taken. Pick another one.");
      setSeat(null);
      refetch();
      return;
    }
    toast.success(`Booking confirmed — PNR ${created.pnr}`);
    navigate({ to: "/bookings", search: { pnr: created.pnr } });
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-20">
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All flights
      </Link>

      <section className="panel mt-4 flex flex-wrap items-center gap-6 p-6">
        <div>
          <p className="board-text text-sm text-primary">{flight.flight_no}</p>
          <h1 className="text-2xl font-semibold">
            {flight.origin_city} → {flight.destination_city}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(flight.depart_at)} · {durationLabel(flight.depart_at, flight.arrive_at)}{" "}
            · {flight.aircraft}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground">From</p>
          <p className="text-2xl font-semibold text-primary">
            {formatMoney(Number(flight.base_fare))}
          </p>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="panel p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Cabin layout</h2>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded bg-seat-free" /> Free
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded bg-seat-taken" /> Taken
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded bg-seat-selected" /> Yours
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center">
            <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Plane className="size-4 -rotate-45 text-primary" /> Nose of aircraft
            </div>

            <div className="flex gap-2 pb-2 text-[11px] text-muted-foreground">
              <span className="w-6" />
              {letters.map((l, i) => (
                <span key={l} className={`w-8 text-center ${i === half ? "ml-6" : ""}`}>
                  {l}
                </span>
              ))}
            </div>

            <div className="flex max-h-[520px] flex-col gap-2 overflow-y-auto pr-1">
              {rows.map((row, rowIndex) => (
                <div key={rowIndex} className="flex items-center gap-2">
                  <span className="w-6 text-right text-[11px] text-muted-foreground">
                    {rowIndex + 1}
                  </span>
                  {row.map((seatNo, i) => {
                    const isTaken = taken.has(seatNo);
                    const isSelected = seat === seatNo;
                    return (
                      <button
                        key={seatNo}
                        type="button"
                        disabled={isTaken}
                        onClick={() => setSeat(seatNo)}
                        title={`${seatNo} · ${seatClass(seatNo)}`}
                        className={[
                          "size-8 rounded text-[10px] font-medium transition-all",
                          i === half ? "ml-6" : "",
                          isTaken
                            ? "cursor-not-allowed bg-seat-taken text-muted-foreground/50"
                            : isSelected
                              ? "bg-seat-selected text-primary-foreground shadow-glow"
                              : "bg-seat-free text-foreground hover:bg-accent hover:text-accent-foreground",
                        ].join(" ")}
                      >
                        {seatNo}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="panel h-fit p-6">
          <h2 className="text-lg font-semibold">Passenger details</h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={DEMO_PASSENGER.email} readOnly disabled />
            </div>

            <div className="rounded-lg border border-border bg-secondary/50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Seat</span>
                <span className="font-medium">{seat ?? "—"}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-muted-foreground">Class</span>
                <span className="font-medium">{seat ? seatClass(seat) : "—"}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold text-primary">
                  {seat ? formatMoney(seatFare(Number(flight.base_fare), seat)) : "—"}
                </span>
              </div>
            </div>

            <Button className="w-full" disabled={!seat || saving} onClick={confirm}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Confirm booking
            </Button>
            <p className="text-xs text-muted-foreground">
              Rows 1–2 are Business class at 1.8× the base fare.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
