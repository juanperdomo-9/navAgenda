# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
React + TypeScript (Vite), Tailwind CSS v4 with CSS-variable tokens, Radix UI primitives, lucide-react icons. Backend FastAPI (Python 3.12), Postgres on Supabase, deploy on Render. Confirmed by the owner (Juan).

## Users
- **Clients of barbershops** in Argentina, booking from their phone, usually on the go. No account: they book with name + phone in under a minute.
- **Barbershop admins** (owner/manager) running the day from a single panel on phone and desktop: grid per barber, marking attended / no-show, configuring services, barbers, schedules and loyalty rules.
- **Superadmin** (Juan, the platform owner) creating barbershops and admin users.

## Product Purpose
NavAgenda is an online booking platform for barbershops. A shared portal lets clients find barbershops by area, service and date (list + map, and "free slots across all shops"), and each barbershop has its own branded page. Bookings confirm instantly, without deposits. Success: a client books in seconds from a phone, and an admin sees and runs the day at a glance.

## Positioning
A portal-plus-tools model (like court-booking portals in Argentina, but for barbershops): one place to find any shop's free time, combined with a per-shop operations panel and a loyalty counter tied to the client's phone number, with no client signup.

## Operating Context
- Clients: mobile browser, outdoors or at home, often one-handed.
- Admins/barbers: phone at the chair between cuts, desktop at the counter.
- Times stored in UTC, shown in America/Argentina/Buenos_Aires. Prices in ARS without decimals.

## Capabilities and Constraints
- Multi-barbershop from day one; strict data isolation per `barberia_id`.
- Clients have no login; private per-booking link to view/cancel. Loyalty per (barbershop, phone).
- Admin/superadmin login with username + password.
- Out of scope for MVP: payments, notifications (WhatsApp/SMS/email), phone verification, client accounts, barber logins, native apps.

## Brand Commitments
- Name: **NavAgenda**.
- Owner-approved visual direction: high-end barbershop, dark and sober. Warm charcoal ground `#0E0D0C`, graphite surfaces, ivory text `#F2ECE1`, warm metallic accent (old gold `#C9A46A`, copper preset `#C47F57`) configurable per barbershop. Bodoni Moda (display) + Manrope (UI). Thin borders, soft shadows, subtle micro-animations, lucide line icons. Admin panel is dark too.

## Evidence on Hand
No real barbershop content, photos, logos or testimonials yet. Any sample data (shops, barbers, prices) is illustrative and must be labeled as such; never invent customers, reviews or ratings presented as real.

## Product Principles
1. Booking is faster than calling: never ask the client for more than name and phone.
2. The day at a glance: the admin grid must be readable in one look on a phone.
3. Each shop is a brand: public pages feel like the shop's own site, not a form.
4. Only "attended" counts: revenue and loyalty reflect reality, never bookings.

## Accessibility & Inclusion
WCAG AA contrast, visible focus, touch targets ≥ 44px, respects reduced motion. Spanish (Argentina, voseo) UI copy.
