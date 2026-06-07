// server.js
// -----------------------------------------------------------------------------
// Entry point for the Brainx Wishlist backend.
// Sets up the Express app, global middleware, routes, and starts the HTTP server.
// -----------------------------------------------------------------------------

// Load environment variables from a local .env file into process.env.
// This must run before any code that relies on those variables.
require('dotenv').config();

const express = require('express');
const cors = require('cors');

// Import the wishlist router which holds all /api/wishlist endpoints.
const wishlistRoutes = require('./routes/wishlist');

// Create the Express application instance.
const app = express();

// ---- Global middleware ------------------------------------------------------

// Enable Cross-Origin Resource Sharing so the Shopify storefront (a different
// origin) is allowed to call this API from the browser.
app.use(cors());

// Parse incoming request bodies with a JSON payload and expose them on req.body.
app.use(express.json());

// ---- Routes -----------------------------------------------------------------

// Simple health check so uptime monitors (and humans) can verify the server is
// alive without touching any business logic.
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'brainx-wishlist-backend',
    timestamp: new Date().toISOString(),
  });
});

// Mount the wishlist router. Every route defined inside routes/wishlist.js is
// prefixed with /api/wishlist (e.g. GET /api/wishlist, POST /api/wishlist).
app.use('/api/wishlist', wishlistRoutes);

// ---- Start the server -------------------------------------------------------

// Use the port from the environment, falling back to 3000 for local dev.
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Brainx Wishlist backend listening on port ${PORT}`);
});
