// routes/wishlist.js
// -----------------------------------------------------------------------------
// Wishlist endpoints. Mounted at /api/wishlist in server.js.
//
// Wishlist data lives in a Shopify customer metafield (namespace "wishlist",
// key "products") and is read/written through the helpers in utils/shopify.js.
//
// Routes:
//   POST   /api/wishlist/add      Add a productId to a customer's wishlist
//   GET    /api/wishlist          Read a customer's wishlist
//   DELETE /api/wishlist/remove   Remove a productId from a customer's wishlist
// -----------------------------------------------------------------------------

const express = require('express');

const { validateCustomerId, validateProductId } = require('../middleware/auth');
const {
  getWishlistMetafield,
  saveWishlistMetafield,
  getProduct,
  parseWishlistValue,
} = require('../utils/shopify');

const router = express.Router();

// -----------------------------------------------------------------------------
// POST /api/wishlist/add
// Body: { customerId, productId }
// Adds productId to the wishlist (if not already present) and saves it back.
// -----------------------------------------------------------------------------
router.post('/add', validateCustomerId, validateProductId, async (req, res) => {
  // Both IDs are validated and normalized to trimmed strings by the middleware.
  const { customerId, productId } = req;

  try {
    // Load the current wishlist (empty array if the metafield doesn't exist).
    const metafield = await getWishlistMetafield(customerId);
    const wishlist = metafield ? parseWishlistValue(metafield.value) : [];

    // Add the product only if it isn't already on the list (avoid duplicates).
    // Compare as strings so a stored "123" still matches an incoming 123.
    if (!wishlist.map(String).includes(productId)) {
      wishlist.push(productId);
      await saveWishlistMetafield(customerId, wishlist);
    }

    return res.json({ success: true, wishlist });
  } catch (err) {
    // Bubble up a Shopify status code when we have one, else a generic 500.
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// GET /api/wishlist?customerId=<id>
// Returns the customer's wishlist, or an empty array if none exists yet.
// -----------------------------------------------------------------------------
router.get('/', validateCustomerId, async (req, res) => {
  const { customerId } = req; // normalized by validateCustomerId

  try {
    const metafield = await getWishlistMetafield(customerId);
    const wishlist = metafield ? parseWishlistValue(metafield.value) : [];

    return res.json({ wishlist });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// GET /api/wishlist/products?customerId=<id>
// Helper used by the wishlist PAGE: resolves the stored product IDs into full
// product details (image, title, price, variantId) so the storefront can render
// cards and add items to the cart. Returns: { products: [...] }.
// Products that can't be loaded (e.g. deleted) are silently skipped.
// -----------------------------------------------------------------------------
router.get('/products', validateCustomerId, async (req, res) => {
  const { customerId } = req; // normalized by validateCustomerId

  try {
    // Read the saved product IDs from the customer's metafield.
    const metafield = await getWishlistMetafield(customerId);
    const ids = metafield ? parseWishlistValue(metafield.value) : [];

    // Resolve each ID to product details in parallel; skip any that fail so a
    // single deleted product doesn't break the whole page.
    const resolved = await Promise.all(
      ids.map(async (id) => {
        try {
          return await getProduct(id);
        } catch {
          return null;
        }
      })
    );

    const products = resolved.filter(Boolean);
    return res.json({ products });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// DELETE /api/wishlist/remove
// Body: { customerId, productId }
// Removes productId from the wishlist and saves the updated array back.
// -----------------------------------------------------------------------------
router.delete('/remove', validateCustomerId, validateProductId, async (req, res) => {
  // Both IDs are validated and normalized to trimmed strings by the middleware.
  const { customerId, productId } = req;

  try {
    // Load the current wishlist (empty array if the metafield doesn't exist).
    const metafield = await getWishlistMetafield(customerId);
    const wishlist = metafield ? parseWishlistValue(metafield.value) : [];

    // Filter out the product, comparing as strings so a stored "123" still
    // matches an incoming 123. If it wasn't there, the array is unchanged.
    const updated = wishlist.filter((id) => String(id) !== productId);

    // Only write back when something actually changed.
    if (updated.length !== wishlist.length) {
      await saveWishlistMetafield(customerId, updated);
    }

    return res.json({ success: true, wishlist: updated });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

module.exports = router;
