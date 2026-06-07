// netlify/functions/api.js
// Wraps the Express app as a Netlify serverless function.
// The redirect rule in netlify.toml forwards every /api/* request here.

const serverless = require('serverless-http');
const app        = require('../../server');

module.exports.handler = serverless(app);
