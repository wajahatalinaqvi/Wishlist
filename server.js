// server.js
// Entry point for the Shopify Customer Wishlist API.
// Configures Express, wires up middleware and routes, then either starts
// a local HTTP server (direct run) or exports the app for serverless use.

require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const wishlistRoutes = require('./routes/wishlist');

const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// Allow the Shopify storefront (different origin) to call this API.
app.use(cors());

// Accept JSON request bodies.
app.use(express.json());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Health-check — useful for verifying the deployment is alive.
app.get('/', (_req, res) => {
  res.json({
    status    : 'ok',
    service   : 'shopify-customer-wishlist-api',
    timestamp : new Date().toISOString(),
  });
});

// All wishlist endpoints live under /api/wishlist.
app.use('/api/wishlist', wishlistRoutes);

// ---------------------------------------------------------------------------
// Start server (local dev only)
// When running as a Netlify Function the file is imported, not executed
// directly, so the listen call is skipped.
// ---------------------------------------------------------------------------


module.exports = app;
