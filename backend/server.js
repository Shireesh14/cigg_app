const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const prometheus = require('prom-client');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection pool
const pool = new Pool({
  user: process.env.DB_USER || 'cigtracker',
  password: process.env.DB_PASSWORD || 'password',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'cigtracker'
});

// Prometheus metrics
const httpRequestCounter = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status']
});

const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestCounter.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode
    });
    httpRequestDuration.observe({
      method: req.method,
      route: req.route?.path || req.path
    }, duration);
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration.toFixed(3)}s`);
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(await prometheus.register.metrics());
});

// API endpoints
// Get all entries
app.get('/api/entries', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, quantity, location, notes, created_at FROM entries ORDER BY created_at DESC LIMIT 100'
    );
    res.json({ entries: result.rows, count: result.rowCount });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

// Get entry by ID
app.get('/api/entries/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM entries WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

// Create new entry
app.post('/api/entries', async (req, res) => {
  const { quantity, location, notes } = req.body;
  
  // Validation
  if (!quantity || !location) {
    return res.status(400).json({ error: 'quantity and location are required' });
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO entries (quantity, location, notes) VALUES ($1, $2, $3) RETURNING *',
      [quantity, location, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

// Get stats
app.get('/api/stats', async (req, res) => {
  try {
    const totalResult = await pool.query(
      'SELECT COUNT(*) as count, SUM(quantity) as total FROM entries'
    );
    
    const todayResult = await pool.query(
      'SELECT COUNT(*) as count, SUM(quantity) as total FROM entries WHERE DATE(created_at) = CURRENT_DATE'
    );
    
    res.json({
      total_entries: parseInt(totalResult.rows[0].count),
      total_quantity: parseInt(totalResult.rows[0].total) || 0,
      today_entries: parseInt(todayResult.rows[0].count),
      today_quantity: parseInt(todayResult.rows[0].total) || 0
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Test database connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Failed to connect to database:', err);
  } else {
    console.log('Database connected successfully');
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Metrics: http://localhost:${PORT}/metrics`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server gracefully...');
  pool.end();
  process.exit(0);
});
