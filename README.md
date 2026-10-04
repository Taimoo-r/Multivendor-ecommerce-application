# VendorZone

A multi-vendor marketplace: buyers shop across independent stores with one cart, and sellers run their
own shop from a dashboard. MERN stack (MongoDB, Express, React, Node) with Stripe payments.

Live demo: https://vendorzone.tech (sample data, Stripe test mode)

## Features

**Storefront**
- Home page with hero carousel, categories, deals, live sales and brand stores
- Product listing with search suggestions, category / price / rating / shop / stock filters and sorting
- Product pages with gallery, stock status, verified-purchase reviews and related products
- Live sales: limited-stock deals with their own price, stock and countdown
- Brand stores: a public page per shop with products, sales and reviews
- Cart (drawer and page), wishlist, coupon codes, per-shop free shipping over $50

**Checkout and orders**
- Prices, shipping, coupons and stock are always computed on the server from the database
- Pay by card (Stripe, verified server-side) or cash on delivery
- One order per shop, stock decremented in a MongoDB transaction
- Order tracking with a status timeline; buyers can cancel while an order is still Processing

**Accounts**
- Email activation, forgot / reset password, profile and avatar, saved addresses, password change
- Reviews are limited to buyers whose order was delivered

**Seller dashboard**
- Revenue chart, balance, orders needing action and low-stock alerts
- Orders with status workflow (Processing, Packed, Shipped, Out for delivery, Delivered)
- Products, live sales and coupons; shop settings and logo

## Project layout

```
backend/    Express API
  controller/   route handlers (user, shop, product, event, order, payment, coupon)
  model/        Mongoose models
  middleware/   auth (buyer / seller cookies), error handling
  utils/        pricing engine, mailer, password reset, uploads helpers
  seed/         demo data + photos (see "Demo data")
frontend/   React + Vite + Tailwind CSS v4
  src/pages/        storefront, account, auth and seller pages
  src/components/   layout and UI building blocks
  src/store/        Redux Toolkit slices (auth, catalogue, cart, wishlist)
```

## Run it locally

Requires Node 20+ and a MongoDB database (Atlas free tier works).

```bash
# 1. API
cd backend
cp .env.example .env        # fill in DB_URL, secrets, Stripe and SMTP values
npm install
npm run seed                # optional: demo shops, products, orders
npm run dev                 # http://localhost:8000

# 2. Frontend (in another terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxies /api and /uploads to :8000)
```

If `npm run seed` or the API fails with `querySrv ECONNREFUSED`, your DNS resolver is refusing the
SRV lookups Atlas needs. Set `DNS_SERVERS=1.1.1.1,8.8.8.8` in `backend/.env`.

Use Stripe's test card `4242 4242 4242 4242` with any future date and any CVC.

## Demo data

`npm run seed` creates 7 shops, 49 products with photos, 7 live sales, 7 coupons, 14 buyers with
reviews and about 650 orders. It only replaces accounts at `@demo.vendorzone.tech`; anything else in
the database is left alone. Product photos are from Unsplash (free licence); credits are in
`backend/seed/images/CREDITS.json`.

All demo accounts use the password `Demo@1234`:

| Role   | Email                                  |
| ------ | -------------------------------------- |
| Buyer  | `buyer@demo.vendorzone.tech`           |
| Seller | `northline-audio@demo.vendorzone.tech` |
| Seller | `technest@demo.vendorzone.tech`        |
| Seller | `atelier-moss@demo.vendorzone.tech`    |
| Seller | `stride-lab@demo.vendorzone.tech`      |
| Seller | `hearth-and-co@demo.vendorzone.tech`   |
| Seller | `verdant-beauty@demo.vendorzone.tech`  |
| Seller | `paper-and-pine@demo.vendorzone.tech`  |

Sample coupon codes: `AUDIO15`, `TECH10`, `MOSS20`, `STRIDE15`, `WELCOME10`, `GLOW20`, `PAPER10`.
Remove the demo accounts before running a real store.

## Configuration

See `backend/.env.example`. In production the API reads its settings from the process environment
(for example a systemd `EnvironmentFile`) and does not load `.env`.

## Deployment

Production runs on a single server: Nginx serves the built frontend and proxies `/api` and `/uploads`
to the Node API (managed by systemd); MongoDB is hosted on Atlas. Uploaded images live on the server's
disk under `backend/uploads`.

```bash
cd frontend && npm run build        # outputs frontend/dist for Nginx to serve
```
