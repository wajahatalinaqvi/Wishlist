# Shopify Customer Wishlist API

A lightweight backend that lets logged-in Shopify customers save products to a personal wishlist. Wishlist data is stored directly on the customer record as a **Shopify metafield**, so there is no separate database to manage. The API is deployed as a serverless function on **Netlify**.

## Project structure

```
.
├── netlify/
│   └── functions/
│       └── api.js          Netlify serverless function wrapper
├── routes/
│   └── wishlist.js         All /api/wishlist route handlers
├── middleware/
│   └── auth.js             Input validation middleware
├── utils/
│   └── shopify.js          Shopify Admin REST API helpers
├── server.js               Express app (also used locally)
├── netlify.toml            Netlify build + redirect config
├── .env.example            Required environment variables (template)
└── package.json
```

## How it works

1. A customer visits a product page → the theme renders an **Add to Wishlist** button (via `wishlist-button.liquid`).
2. Clicking the button calls this API, which reads/writes a metafield on the Shopify customer record (`namespace: wishlist`, `key: products`). The metafield stores a JSON array of numeric product IDs.
3. The dedicated wishlist page (`/pages/wishlist`) calls `GET /api/wishlist/products`, which resolves the saved IDs into full product details (title, image, price, variant ID) through the Shopify Admin API, and renders product cards.

## API reference

Base path: `/api/wishlist`

| Method | Path | Input | Response |
|--------|------|-------|----------|
| `GET` | `/` | `?customerId=` | `{ wishlist: [...ids] }` |
| `POST` | `/add` | `{ customerId, productId }` | `{ success: true, wishlist: [...ids] }` |
| `DELETE` | `/remove` | `{ customerId, productId }` | `{ success: true, wishlist: [...ids] }` |
| `GET` | `/products` | `?customerId=` | `{ products: [{ id, title, handle, image, price, variantId }] }` |

All endpoints validate their inputs and return `{ error: "message" }` with the appropriate HTTP status on failure.

## Local development

```bash
npm install
cp .env.example .env   # fill in your store domain and access token
npm run dev            # starts on http://localhost:3000
```

Test the health check:
```bash
curl http://localhost:3000/
```

Test with a real customer:
```bash
curl "http://localhost:3000/api/wishlist?customerId=YOUR_CUSTOMER_ID"
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `SHOPIFY_STORE_DOMAIN` | Your store's `.myshopify.com` domain, no `https://` |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | Admin API access token (`shpat_…`) from a custom app |
| `PORT` | Local port (default `3000`, ignored on Netlify) |

### Creating the Admin API token

1. Shopify Admin → **Settings → Apps and sales channels → Develop apps**
2. Create an app → **Configure Admin API scopes** → enable `read_customers`, `write_customers`, `read_products` → Save
3. **API credentials** tab → Install app → copy the `shpat_…` token

## Deploy to Netlify

### Option A — Netlify CLI

```bash
npm install -g netlify-cli
netlify login
netlify init       # connect to your GitHub repo
netlify deploy --prod
```

### Option B — Netlify dashboard

1. Push this repo to GitHub.
2. [app.netlify.com](https://app.netlify.com) → **Add new site → Import from Git** → select the repo.
3. Netlify auto-detects `netlify.toml`. Click **Deploy**.
4. After deploy: **Site settings → Environment variables** → add `SHOPIFY_STORE_DOMAIN` and `SHOPIFY_ADMIN_ACCESS_TOKEN`.

Your API will be live at `https://your-site-name.netlify.app/api/wishlist`.

## Connecting the Shopify theme

1. Open `shopify-theme/assets/wishlist.js` and set `BACKEND_URL` to your Netlify URL.
2. Upload the theme files (`snippets/`, `sections/`, `templates/`, `assets/`) via **Online Store → Themes → Edit code**.
3. In your product template add:
   ```liquid
   {% render 'wishlist-button', product: product %}
   <script src="{{ 'wishlist.js' | asset_url }}" defer></script>
   ```
4. In Shopify Admin → **Online Store → Pages**, create a page with handle `wishlist` and set its template to `wishlist`.

## Notes

- Only **logged-in** customers can use the wishlist (keyed to a customer ID). Guests see a "Log in to save" prompt.
- The `auth` middleware currently validates that a `customerId` is present but does not verify the caller is that customer. Add Shopify session token verification before going to production.
- CORS is open for development. For production, restrict it to your store domain in `server.js`.
