import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { z } from "zod";

import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai/run-id";
import { DEMO_PASSENGER, generatePnr, seatClass } from "@/lib/airline";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

function db() {
  return createClient(
    process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const FLIGHT_FIELDS =
  "id, flight_no, airline, origin, origin_city, destination, destination_city, depart_at, arrive_at, aircraft, rows_count, seats_per_row, base_fare";

function buildTools() {
  const supabase = db();

  return {
    search_flights: tool({
      description:
        "Search available flights by origin/destination city or airport code. Returns flight numbers, times, fares and seats left.",
      inputSchema: z.object({
        origin: z.string().nullable().describe("Origin city or IATA code, null for any"),
        destination: z.string().nullable().describe("Destination city or IATA code, null for any"),
      }),
      execute: async ({ origin, destination }) => {
        let query = supabase.from("flights").select(FLIGHT_FIELDS).order("depart_at");
        if (origin) query = query.or(`origin.ilike.%${origin}%,origin_city.ilike.%${origin}%`);
        if (destination)
          query = query.or(
            `destination.ilike.%${destination}%,destination_city.ilike.%${destination}%`,
          );
        const { data, error } = await query;
        if (error) return { error: error.message };
        const { data: booked } = await supabase.from("bookings").select("flight_id");
        const takenPerFlight = new Map<string, number>();
        (booked ?? []).forEach((b) => {
          takenPerFlight.set(b.flight_id, (takenPerFlight.get(b.flight_id) ?? 0) + 1);
        });
        return {
          flights: (data ?? []).map((f) => ({
            flight_no: f.flight_no,
            route: `${f.origin} (${f.origin_city}) -> ${f.destination} (${f.destination_city})`,
            depart_at: f.depart_at,
            arrive_at: f.arrive_at,
            aircraft: f.aircraft,
            base_fare: Number(f.base_fare),
            seats_left:
              f.rows_count * f.seats_per_row - (takenPerFlight.get(f.id) ?? 0),
          })),
        };
      },
    }),

    book_ticket: tool({
      description:
        "Book a seat for the signed-in demo passenger on a flight. If no seat is given, the first free seat is assigned.",
      inputSchema: z.object({
        flight_no: z.string().describe("Flight number, e.g. SK101"),
        seat_no: z.string().nullable().describe("Preferred seat like 12C, or null for auto"),
        passenger_name: z.string().nullable().describe("Passenger name, null for the demo user"),
      }),
      execute: async ({ flight_no, seat_no, passenger_name }) => {
        const { data: flight } = await supabase
          .from("flights")
          .select(FLIGHT_FIELDS)
          .ilike("flight_no", flight_no.trim())
          .maybeSingle();
        if (!flight) return { error: `No flight found with number ${flight_no}` };

        const { data: taken } = await supabase
          .from("bookings")
          .select("seat_no")
          .eq("flight_id", flight.id);
        const takenSet = new Set((taken ?? []).map((b) => b.seat_no));

        const letters = "ABCDEFGH".slice(0, flight.seats_per_row).split("");
        let seat = seat_no?.toUpperCase().trim() ?? null;
        if (seat && takenSet.has(seat)) return { error: `Seat ${seat} is already taken.` };
        if (!seat) {
          outer: for (let r = 1; r <= flight.rows_count; r += 1) {
            for (const letter of letters) {
              if (!takenSet.has(`${r}${letter}`)) {
                seat = `${r}${letter}`;
                break outer;
              }
            }
          }
        }
        if (!seat) return { error: "This flight is fully booked." };

        const cabin = seatClass(seat);
        const fare = Math.round(Number(flight.base_fare) * (cabin === "Business" ? 1.8 : 1));
        const { data: created, error } = await supabase
          .from("bookings")
          .insert({
            pnr: generatePnr(),
            flight_id: flight.id,
            passenger_name: passenger_name || DEMO_PASSENGER.name,
            passenger_email: DEMO_PASSENGER.email,
            seat_no: seat,
            cabin_class: cabin,
            fare,
            status: "CONFIRMED",
          })
          .select("pnr, seat_no, cabin_class, fare")
          .single();
        if (error) return { error: error.message };
        return {
          booked: true,
          pnr: created.pnr,
          flight_no: flight.flight_no,
          route: `${flight.origin} -> ${flight.destination}`,
          depart_at: flight.depart_at,
          seat_no: created.seat_no,
          cabin_class: created.cabin_class,
          fare: Number(created.fare),
          note: "The ticket PDF can be downloaded from the My Bookings page.",
        };
      },
    }),

    my_bookings: tool({
      description: "List all reservations belonging to the logged-in demo passenger.",
      inputSchema: z.object({
        only_upcoming: z.boolean().nullable().describe("Limit to future departures"),
      }),
      execute: async ({ only_upcoming }) => {
        const { data, error } = await supabase
          .from("bookings")
          .select(
            "pnr, seat_no, cabin_class, fare, status, created_at, flights(flight_no, origin, destination, depart_at)",
          )
          .eq("passenger_email", DEMO_PASSENGER.email)
          .order("created_at", { ascending: false });
        if (error) return { error: error.message };
        const rows = (data ?? []).filter((b) => {
          const flight = Array.isArray(b.flights) ? b.flights[0] : b.flights;
          if (!only_upcoming || !flight) return true;
          return new Date(flight.depart_at as string) > new Date();
        });
        return { count: rows.length, bookings: rows };
      },
    }),

    create_dispute: tool({
      description:
        "Open a reservation dispute / complaint for the demo passenger, optionally linked to a PNR.",
      inputSchema: z.object({
        pnr: z.string().nullable().describe("Related booking PNR, or null"),
        category: z
          .enum(["Refund", "Baggage", "Seat", "Schedule", "Other"])
          .describe("Dispute category"),
        description: z.string().describe("What went wrong, in the passenger's words"),
      }),
      execute: async ({ pnr, category, description }) => {
        let bookingId: string | null = null;
        if (pnr) {
          const { data } = await supabase
            .from("bookings")
            .select("id")
            .ilike("pnr", pnr.trim())
            .maybeSingle();
          bookingId = data?.id ?? null;
          if (!bookingId) return { error: `No booking found for PNR ${pnr}` };
        }
        const reference = `DSP-${Math.floor(1000 + Math.random() * 9000)}`;
        const { error } = await supabase.from("disputes").insert({
          reference,
          booking_id: bookingId,
          raised_by: DEMO_PASSENGER.email,
          category,
          description,
          status: "OPEN",
        });
        if (error) return { error: error.message };
        return { created: true, reference, category, status: "OPEN" };
      },
    }),
  };
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "AI is not configured." }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        const { messages } = (await request.json()) as { messages: UIMessage[] };

        const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
        const provider = createOpenAI({
          baseURL: GATEWAY_URL,
          apiKey,
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          fetch: runIdFetch.fetch,
        });

        const result = streamText({
          model: provider.responses(MODEL),
          system: `You are Skyline Assistant, the booking agent for the Skyline Air reservation system.
The signed-in passenger is ${DEMO_PASSENGER.name} (${DEMO_PASSENGER.email}).
You can: search flight availability, book tickets, look up the logged-in passenger's flights, and file reservation disputes.
Always use the tools for real data — never invent flight numbers, PNRs or fares.
Confirm the flight and seat before booking when the request is ambiguous. Fares are in Indian Rupees.
Answer briefly in markdown-free plain text with short lines.`,
          messages: await convertToModelMessages(messages),
          tools: buildTools(),
          stopWhen: stepCountIs(50),
          abortSignal: request.signal,
          providerOptions: {
            openai: {
              store: false,
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        return withLovableAiGatewayRunIdHeader(
          result.toUIMessageStreamResponse({ sendReasoning: true }),
          runIdFetch,
        );
      },
    },
  },
});
