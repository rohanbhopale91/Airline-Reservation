export const DEMO_PASSENGER = {
  name: "Rohan Demo",
  email: "demo@skyline.app",
};

export type Flight = {
  id: string;
  flight_no: string;
  airline: string;
  origin: string;
  origin_city: string;
  destination: string;
  destination_city: string;
  depart_at: string;
  arrive_at: string;
  aircraft: string;
  rows_count: number;
  seats_per_row: number;
  base_fare: number;
};

export type Booking = {
  id: string;
  pnr: string;
  flight_id: string;
  passenger_name: string;
  passenger_email: string;
  seat_no: string;
  cabin_class: string;
  fare: number;
  status: string;
  created_at: string;
  flights?: Flight | null;
};

export type Dispute = {
  id: string;
  reference: string;
  booking_id: string | null;
  raised_by: string;
  category: string;
  description: string;
  status: string;
  created_at: string;
};

const LETTERS = "ABCDEFGH";

export function seatLetters(seatsPerRow: number) {
  return LETTERS.slice(0, seatsPerRow).split("");
}

export function buildSeatMap(rows: number, seatsPerRow: number) {
  const letters = seatLetters(seatsPerRow);
  return Array.from({ length: rows }, (_, i) =>
    letters.map((letter) => `${i + 1}${letter}`),
  );
}

export function seatClass(seatNo: string) {
  const row = parseInt(seatNo, 10);
  return row <= 2 ? "Business" : "Economy";
}

export function seatFare(baseFare: number, seatNo: string) {
  return Math.round(baseFare * (seatClass(seatNo) === "Business" ? 1.8 : 1));
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function durationLabel(from: string, to: string) {
  const mins = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

export function generatePnr() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
