// src/database/db.js
const { Pool } = require('pg');

console.log('--- [Database] Iniciando conexão com PostgreSQL ---');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Eventos do pool
pool.on('connect', () => {
  console.log('✅ [Database] Conectado ao PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ [Database] Erro na conexão:', err.message);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params)
};