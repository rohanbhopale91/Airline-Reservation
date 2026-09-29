CREATE TABLE public.flights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_no text NOT NULL UNIQUE,
  airline text NOT NULL,
  origin text NOT NULL,
  origin_city text NOT NULL,
  destination text NOT NULL,
  destination_city text NOT NULL,
  depart_at timestamptz NOT NULL,
  arrive_at timestamptz NOT NULL,
  aircraft text NOT NULL DEFAULT 'Airbus A320',
  rows_count int NOT NULL DEFAULT 20,
  seats_per_row int NOT NULL DEFAULT 6,
  base_fare numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.flights TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flights TO authenticated;
GRANT ALL ON public.flights TO service_role;
ALTER TABLE public.flights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Flights are public" ON public.flights FOR SELECT USING (true);

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pnr text NOT NULL UNIQUE,
  flight_id uuid NOT NULL REFERENCES public.flights(id) ON DELETE CASCADE,
  passenger_name text NOT NULL,
  passenger_email text NOT NULL,
  seat_no text NOT NULL,
  cabin_class text NOT NULL DEFAULT 'Economy',
  fare numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'CONFIRMED',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flight_id, seat_no)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo bookings are open" ON public.bookings FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  raised_by text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  description text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.disputes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disputes TO authenticated;
GRANT ALL ON public.disputes TO service_role;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo disputes are open" ON public.disputes FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.flights (flight_no, airline, origin, origin_city, destination, destination_city, depart_at, arrive_at, aircraft, rows_count, seats_per_row, base_fare) VALUES
('SK101','Skyline Air','DEL','Delhi','BOM','Mumbai', now() + interval '1 day 6 hour', now() + interval '1 day 8 hour', 'Airbus A320', 20, 6, 4899),
('SK102','Skyline Air','BOM','Mumbai','DEL','Delhi', now() + interval '1 day 12 hour', now() + interval '1 day 14 hour', 'Airbus A320', 20, 6, 5120),
('SK201','Skyline Air','DEL','Delhi','BLR','Bengaluru', now() + interval '2 day 5 hour', now() + interval '2 day 8 hour', 'Boeing 737', 22, 6, 6250),
('SK202','Skyline Air','BLR','Bengaluru','DEL','Delhi', now() + interval '2 day 15 hour', now() + interval '2 day 18 hour', 'Boeing 737', 22, 6, 6090),
('SK301','Skyline Air','BOM','Mumbai','GOI','Goa', now() + interval '3 day 7 hour', now() + interval '3 day 8 hour', 'Airbus A319', 18, 6, 3450),
('SK302','Skyline Air','GOI','Goa','BOM','Mumbai', now() + interval '3 day 18 hour', now() + interval '3 day 19 hour', 'Airbus A319', 18, 6, 3600),
('SK401','Skyline Air','DEL','Delhi','CCU','Kolkata', now() + interval '4 day 9 hour', now() + interval '4 day 11 hour', 'Airbus A320', 20, 6, 5300),
('SK402','Skyline Air','CCU','Kolkata','DEL','Delhi', now() + interval '4 day 19 hour', now() + interval '4 day 21 hour', 'Airbus A320', 20, 6, 5410),
('SK501','Skyline Air','BLR','Bengaluru','HYD','Hyderabad', now() + interval '5 day 6 hour', now() + interval '5 day 7 hour', 'ATR 72', 16, 4, 2890),
('SK502','Skyline Air','HYD','Hyderabad','BLR','Bengaluru', now() + interval '5 day 17 hour', now() + interval '5 day 18 hour', 'ATR 72', 16, 4, 2950),
('SK601','Skyline Air','DEL','Delhi','DXB','Dubai', now() + interval '6 day 4 hour', now() + interval '6 day 8 hour', 'Boeing 787', 30, 6, 18400),
('SK602','Skyline Air','DXB','Dubai','DEL','Delhi', now() + interval '6 day 14 hour', now() + interval '6 day 18 hour', 'Boeing 787', 30, 6, 17950),
('SK701','Skyline Air','BOM','Mumbai','SIN','Singapore', now() + interval '7 day 2 hour', now() + interval '7 day 8 hour', 'Boeing 787', 30, 6, 24300),
('SK702','Skyline Air','SIN','Singapore','BOM','Mumbai', now() + interval '7 day 13 hour', now() + interval '7 day 19 hour', 'Boeing 787', 30, 6, 23800);

WITH names AS (
  SELECT full_name, row_number() OVER () - 1 AS idx
  FROM unnest(ARRAY['Aarav Sharma','Isha Verma','Rohan Mehta','Neha Kapoor','Vikram Rao','Ananya Iyer','Kabir Singh','Meera Nair','Arjun Patel','Sara Khan','Dev Malhotra','Priya Desai','Nikhil Joshi','Tara Bhat','Aditya Ghosh','Riya Chawla','Manav Sethi','Kavya Reddy','Yash Agarwal','Diya Menon']) AS full_name
), numbered AS (
  SELECT f.id AS flight_id, f.base_fare, f.seats_per_row, gs AS n,
         (row_number() OVER (ORDER BY f.flight_no, gs))::int AS rn
  FROM public.flights f
  CROSS JOIN LATERAL generate_series(1, 9) AS gs
)
INSERT INTO public.bookings (pnr, flight_id, passenger_name, passenger_email, seat_no, cabin_class, fare, status)
SELECT
  'SK' || lpad(nb.rn::text, 4, '0') || chr(65 + (nb.rn % 26)),
  nb.flight_id,
  CASE WHEN nb.rn % 7 = 0 THEN 'Rohan Demo' ELSE nm.full_name END,
  CASE WHEN nb.rn % 7 = 0 THEN 'demo@skyline.app' ELSE 'passenger' || nb.rn || '@example.com' END,
  (((nb.n - 1) / nb.seats_per_row) + 1)::text || chr(65 + ((nb.n - 1) % nb.seats_per_row)),
  CASE WHEN nb.n <= 2 THEN 'Business' ELSE 'Economy' END,
  nb.base_fare * CASE WHEN nb.n <= 2 THEN 1.8 ELSE 1 END,
  'CONFIRMED'
FROM numbered nb
JOIN names nm ON nm.idx = (nb.rn % 20);

INSERT INTO public.disputes (reference, booking_id, raised_by, category, description, status)
SELECT 'DSP-1001', id, passenger_email, 'Baggage', 'Checked baggage arrived damaged on this sector.', 'OPEN'
FROM public.bookings WHERE passenger_email = 'demo@skyline.app' LIMIT 1;