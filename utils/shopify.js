// utils/shopify.js
// -----------------------------------------------------------------------------
// Helpers for reading and writing a customer's wishlist using Shopify customer
// metafields via the Shopify Admin REST API.
//
// Wishlist data is stored on the customer record in a single metafield:
//   namespace: "wishlist"
//   key:       "products"
//   type:      "json"           (the value is a JSON-encoded array of product IDs)
//
// All requests use the built-in global `fetch` (Node 18+) with the store domain
// and Admin API access token read from environment variables (.env).
// -----------------------------------------------------------------------------

// The Admin API version to target. Pinning this keeps behavior stable across
// deployments; bump it deliberately when you want newer API features.
const API_VERSION = '2026-04';

// The metafield coordinates we use for wishlist storage.
const WISHLIST_NAMESPACE = 'wishlist';
const WISHLIST_KEY = 'products';

// ---- Internal helpers -------------------------------------------------------

// Resolve and validate the Shopify credentials from the environment. Throwing
// here gives a clear, early error instead of a confusing 401 from Shopify.
function getConfig() {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!storeDomain || !accessToken) {
    throw new Error(
      'Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN in environment'
    );
  }

  
  // Base URL for all Admin REST calls, e.g.
  // https://my-store.myshopify.com/admin/api/2026-04
  const baseUrl = `https://${storeDomain}/admin/api/${API_VERSION}`;

  return { baseUrl, accessToken };
}

// Thin wrapper around fetch that adds the required Shopify auth + JSON headers
// and turns non-2xx responses into thrown errors with useful messages.
async function shopifyFetch(path, options = {}) {
  const { baseUrl, accessToken } = getConfig();

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
      ...(options.headers || {}),
    },
  });

  // Read the body once. Shopify returns JSON for both success and error cases.
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    // Surface Shopify's own error payload when available.
    const detail =
      data && data.errors ? JSON.stringify(data.errors) : response.statusText;
    const err = new Error(`Shopify API error (${response.status}): ${detail}`);
    err.status = response.status;
    throw err;
  }

  return data;
}

// Safely parse a metafield value into an array. A malformed or non-array value
// degrades to an empty array rather than throwing.
function parseWishlistValue(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ---- Public API -------------------------------------------------------------

/**
 * Fetch the raw wishlist metafield object for a customer.
 *
 * Looks up the customer's metafields filtered to our wishlist namespace and
 * returns the single "products" metafield (or null if it doesn't exist yet).
 *
 * @param {string|number} customerId - The Shopify customer ID.
 * @returns {Promise<object|null>} The metafield object ({ id, value, ... }) or
 *   null when the customer has no wishlist metafield yet.
 */
async function getWishlistMetafield(customerId) {
  // Ask Shopify only for metafields in our namespace to keep the payload small.
  const path =
    `/customers/${encodeURIComponent(customerId)}/metafields.json` +
    `?namespace=${WISHLIST_NAMESPACE}`;

  const data = await shopifyFetch(path, { method: 'GET' });
  const metafields = Array.isArray(data.metafields) ? data.metafields : [];

  // Find the specific "products" metafield within the wishlist namespace.
  const metafield = metafields.find((m) => m.key === WISHLIST_KEY) || null;
  return metafield;
}

/**
 * Persist a wishlist array back to the customer's metafield.
 *
 * Creates the metafield on first save and updates it on subsequent saves. The
 * array is JSON-encoded and stored with type "json".
 *
 * @param {string|number} customerId - The Shopify customer ID.
 * @param {Array} wishlistArray - The full array of product IDs to store.
 * @returns {Promise<Array>} The wishlist array that was saved.
 */
async function saveWishlistMetafield(customerId, wishlistArray) {
  // Look up an existing metafield so we know whether to create or update.
  const existing = await getWishlistMetafield(customerId);

  // The value Shopify stores is always a JSON string.
  const value = JSON.stringify(wishlistArray);

  if (existing) {
    // Update in place by metafield ID (PUT /metafields/{id}.json).
    await shopifyFetch(`/metafields/${existing.id}.json`, {
      method: 'PUT',
      body: JSON.stringify({
        metafield: {
          id: existing.id,
          value,
          type: 'json',
        },
      }),
    });
  } else {
    // Create a new metafield on the customer record.
    await shopifyFetch(
      `/customers/${encodeURIComponent(customerId)}/metafields.json`,
      {
        method: 'POST',
        body: JSON.stringify({
          metafield: {
            namespace: WISHLIST_NAMESPACE,
            key: WISHLIST_KEY,
            value,
            type: 'json',
          },
        }),
      }
    );
  }

  return wishlistArray;
}

/**
 * Fetch a single product's storefront-relevant details by numeric product ID.
 *
 * Used to turn the bare product IDs stored in the wishlist into renderable
 * cards (image, title, price) plus the first variant ID needed for add-to-cart.
 * Requires the app to have the read_products scope.
 *
 * @param {string|number} productId - The Shopify product ID.
 * @returns {Promise<object|null>} A simplified product object
 *   ({ id, title, handle, image, price, variantId }) or null if the product
 *   has no usable data.
 */
async function getProduct(productId) {
  const data = await shopifyFetch(
    `/products/${encodeURIComponent(productId)}.json`,
    { method: 'GET' }
  );

  const product = data.product;
  if (!product) {
    return null;
  }

  // The first variant is used for the storefront "Add to Cart" action.
  const variant =
    Array.isArray(product.variants) && product.variants[0]
      ? product.variants[0]
      : null;

  // Prefer the featured image, fall back to the first image in the list.
  const image =
    (product.image && product.image.src) ||
    (Array.isArray(product.images) && product.images[0] && product.images[0].src) ||
    '';

  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    image,
    price: variant ? variant.price : null, // shop-currency amount, e.g. "19.99"
    variantId: variant ? variant.id : null,
  };
}

module.exports = {
  getWishlistMetafield,
  saveWishlistMetafield,
  getProduct,
  // Exported for callers/routes that want the parsed array directly.
  parseWishlistValue,
};
