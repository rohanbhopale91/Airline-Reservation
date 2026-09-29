import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Ticket, XCircle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DEMO_PASSENGER,
  formatDateTime,
  formatMoney,
  type Booking,
  type Dispute,
  type Flight,
} from "@/lib/airline";
import { downloadTicket } from "@/lib/ticket";

type Search = { pnr: string };

export const Route = createFileRoute("/bookings")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    pnr: typeof search["pnr"] === "string" ? (search["pnr"] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "My bookings & PDF tickets — Skyline Air" },
      {
        name: "description",
        content:
          "Every Skyline Air reservation for the signed-in passenger, with downloadable PDF tickets and open disputes.",
      },
      { property: "og:title", content: "My bookings & PDF tickets — Skyline Air" },
      {
        property: "og:description",
        content:
          "Every Skyline Air reservation for the signed-in passenger, with downloadable PDF tickets and open disputes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BookingsPage,
});

function BookingsPage() {
  const { pnr } = Route.useSearch();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: async () => {
      const [{ data: bookings, error }, { data: disputes }] = await Promise.all([
        supabase
          .from("bookings")
          .select("*, flights(*)")
          .eq("passenger_email", DEMO_PASSENGER.email)
          .order("created_at", { ascending: false }),
        supabase
          .from("disputes")
          .select("*")
          .eq("raised_by", DEMO_PASSENGER.email)
          .order("created_at", { ascending: false }),
      ]);
      if (error) throw error;
      return {
        bookings: (bookings ?? []) as unknown as Booking[],
        disputes: (disputes ?? []) as unknown as Dispute[],
      };
    },
  });

  async function cancel(booking: Booking) {
    const { error } = await supabase
      .from("bookings")
      .update({ status: "CANCELLED" })
      .eq("id", booking.id);
    if (error) {
      toast.error("Could not cancel that booking.");
      return;
    }
    toast.success(`${booking.pnr} cancelled`);
    queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
  }

  const bookings = data?.bookings ?? [];
  const disputes = data?.disputes ?? [];

  return (
    <main className="mx-auto max-w-5xl px-4 pb-20">
      <header className="mt-10">
        <h1 className="text-3xl font-bold">My bookings</h1>
        <p className="mt-2 text-muted-foreground">
          Reservations for {DEMO_PASSENGER.name}. Every ticket is generated as a PDF boarding
          pass.
        </p>
      </header>

      <section className="mt-6 grid gap-3">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}

        {!isLoading && bookings.length === 0 && (
          <div className="panel p-10 text-center">
            <Ticket className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">No reservations yet.</p>
            <Button asChild className="mt-4">
              <Link to="/">Find a flight</Link>
            </Button>
          </div>
        )}

        {bookings.map((booking) => {
          const flight = booking.flights as Flight | null;
          const highlight = pnr && booking.pnr === pnr;
          return (
            <article
              key={booking.id}
              className={`panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center ${
                highlight ? "border-primary shadow-glow" : ""
              }`}
            >
              <div className="min-w-32">
                <p className="board-text text-sm font-semibold text-primary">{booking.pnr}</p>
                <p className="text-xs text-muted-foreground">
                  {flight?.flight_no} · seat {booking.seat_no}
                </p>
              </div>

              <div className="flex-1">
                <p className="font-medium">
                  {flight ? `${flight.origin_city} → ${flight.destination_city}` : "Flight removed"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {flight ? formatDateTime(flight.depart_at) : "—"} · {booking.cabin_class} ·{" "}
                  {formatMoney(Number(booking.fare))}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant={booking.status === "CONFIRMED" ? "default" : "secondary"}
                  className="uppercase"
                >
                  {booking.status}
                </Badge>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!flight}
                  onClick={() => flight && downloadTicket(booking, flight)}
                >
                  <Download className="size-4" /> Ticket
                </Button>
                {booking.status === "CONFIRMED" && (
                  <Button size="sm" variant="ghost" onClick={() => cancel(booking)}>
                    <XCircle className="size-4" />
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Disputes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Raised through the assistant. Ask it to open one for any reservation.
        </p>
        <div className="mt-4 grid gap-3">
          {disputes.length === 0 && (
            <div className="panel p-6 text-sm text-muted-foreground">No open disputes.</div>
          )}
          {disputes.map((dispute) => (
            <div key={dispute.id} className="panel flex items-center gap-4 p-4">
              <span className="board-text text-sm text-primary">{dispute.reference}</span>
              <div className="flex-1">
                <p className="text-sm font-medium">{dispute.category}</p>
                <p className="text-xs text-muted-foreground">{dispute.description}</p>
              </div>
              <Badge variant="secondary">{dispute.status}</Badge>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
