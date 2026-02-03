// src/server.ts
import { buildApp } from './app.js';

const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  try {
    const app = await buildApp();

    await app.listen({ port: PORT, host: HOST });

    console.log(`🚀 Server running at http://${HOST}:${PORT}`);
    console.log(`📖 API Documentation:`);
    console.log(`   - Auth:     POST /api/auth/register, /api/auth/login, GET /api/auth/status`);
    console.log(`   - Requests: POST /api/requests, GET /api/requests, GET /api/requests/:id`);
    console.log(`   - Seller:   GET /api/seller/requests, POST /api/seller/validate/:qrHash`);
    console.log(`   - Tires:    GET /api/tires, GET /api/tires/:id`);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

start();