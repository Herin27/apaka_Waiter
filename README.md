# Aapka Waiter

Real-time QR table ordering, shared group carts, 3D live floor map, station Kitchen Display System (KDS), cashier POS with split/Razorpay billing, analytics, and AI voice/forecasting assistant.

Designed & Developed by **HeryxStudio**.

---

## Screenshots

- **Landing & Demo Mode (`/`, `/demo`):** Animated floor overview, pricing tiers, FAQ, lead capture, and instant table demo launch.
- **Customer QR Menu & Tracker (`/t/:branchSlug/:token`):** Multilingual menu (`EN` / `हिं` / `ગુ`), shared cart, voice ordering, live order tracker, and bill checkout.
- **Waiter Floor & 3D Map (`/dashboard/waiter`):** Live table states, glowing Kitchen-to-Table order paths, sound alerts, table transfers, and session closing.
- **Kitchen Display System (`/dashboard/kitchen`):** Station tabs (`All`, `Kitchen`, `Bar`, `Pastry`), color-coded elapsed timers, 10s undo, stock switches, and 80mm KOT print.
- **Cashier POS & Admin Analytics (`/dashboard/cashier`, `/dashboard/admin/*`):** Split bills, mixed payments, GST PDF invoices, Z-Report, Recharts analytics, inventory, loyalty, and floor editor.

---

## Setup in Under 10 Minutes

1. **Clone & install backend dependencies:**
   ```bash
   cd server
   npm install
   cp .env.example .env
   ```
2. **Configure `server/.env`:**
   Set `MONGO_URI`, `JWT_SECRET` (32+ chars), `CLIENT_URL=http://localhost:5173`, and optional `GEMINI_API_KEY` / `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`.
3. **Seed database & 30-day demo analytics:**
   ```bash
   npm run seed
   npm run seed:demo-orders
   npm run dev
   ```
4. **Install & run frontend (in a second terminal):**
   ```bash
   cd client
   npm install
   npm run dev
   ```

---

## 5-Minute Owner Demo Script

1. **Minute 0:00–1:00 — Landing & QR Scan:** Open `/demo` and click **Launch Demo Customer Menu (Table T1)**. Switch language to Hindi or Gujarati to show instant localization.
2. **Minute 1:00–2:00 — Shared Cart & Voice Order:** Add a dish and try voice/text ordering (`"Ek paneer tikka aur do cold coffee"`), then place the order.
3. **Minute 2:00–3:00 — Waiter Floor & 3D Map:** Switch to `/dashboard/waiter` (`waiter@demo.com` / `Demo@123`). Show the chime, flashing new order card, glowing path on the 3D floor map, and click **Confirm**.
4. **Minute 3:00–4:00 — Kitchen KDS & KOT:** Open `/dashboard/kitchen` (`kitchen@demo.com` / `Demo@123`). Start cooking, toggle an item ready, click **Print KOT** for the 80mm thermal ticket, and mark **Ready**.
5. **Minute 4:00–5:00 — Cashier Settlement & Analytics:** Open `/dashboard/cashier` (`cashier@demo.com` / `Demo@123`) to settle the bill, download the GST PDF invoice, and open `/dashboard/admin/analytics` (`admin@demo.com` / `Demo@123`) to show revenue charts and AI stocking advice.

---

## Downtime Procedure (Manual KOT Backup Plan)

If power or network connectivity is interrupted during peak hours:
1. **Customer & Floor:** Staff take orders verbally or on physical KOT pads; customer PWA continues reading cached menu data offline.
2. **Kitchen:** Chefs prepare tickets in sequence from printed KOT slips or urgent verbal callouts; mark stock out-of-stock on the physical board.
3. **Billing:** Cashier collects Cash or UPI reference numbers and settles/logs transactions in POS once connectivity returns.
4. **Recovery:** Verify `npm run dev` on `/server` and `npm run dev` on `/client`, confirm the **Live** connection dot turns green, and allow queued offline staff actions in IndexedDB to replay automatically.
