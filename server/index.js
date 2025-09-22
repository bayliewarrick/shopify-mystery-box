require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const authRoutes = require('./routes/auth');
const mysteryBoxRoutes = require('./routes/mysteryBox');
const inventoryRoutes = require('./routes/inventory');
const webhookRoutes = require('./routes/webhooks');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Test database connection
async function testDatabaseConnection() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
  }
}

testDatabaseConnection();

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false
}));

// Simplified CORS configuration for development
app.use(cors({
  origin: true, // Allow all origins during development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Allow-Origin',
    'X-Shopify-Shop-Domain'
  ],
  exposedHeaders: ['Content-Length', 'X-Request-ID'],
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}));

// Universal CORS headers middleware - set on every response
app.use((req, res, next) => {
  const origin = req.get('Origin') || req.get('Referer') || '*';
  const timestamp = new Date().toISOString();
  
  // Comprehensive request logging
  console.log('='.repeat(80));
  console.log(`🌐 ${timestamp} - ${req.method} ${req.url}`);
  console.log(`📍 Origin: ${origin}`);
  console.log(`📍 User-Agent: ${req.get('User-Agent') || 'none'}`);
  console.log(`📍 Content-Type: ${req.get('Content-Type') || 'none'}`);
  console.log(`📍 Query Params:`, JSON.stringify(req.query, null, 2));
  
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    console.log(`📍 Request Body:`, JSON.stringify(req.body, null, 2));
  }
  
  console.log(`📍 All Headers:`, JSON.stringify(req.headers, null, 2));
  
  // Set CORS headers on every response
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours

  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling OPTIONS preflight - sending 200');
    console.log('='.repeat(80));
    return res.sendStatus(200);
  }
  
  // Log response when it's sent
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`📤 Response Status: ${res.statusCode}`);
    console.log(`📤 Response Headers:`, JSON.stringify(res.getHeaders(), null, 2));
    if (res.statusCode >= 400) {
      console.log(`❌ Error Response Body:`, data);
    } else {
      console.log(`✅ Success Response Body:`, typeof data === 'string' ? data.substring(0, 200) + '...' : data);
    }
    console.log('='.repeat(80));
    return originalSend.call(this, data);
  };
  
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/mystery-boxes', mysteryBoxRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/webhooks', webhookRoutes);

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  // Catch-all handler: send back React's index.html file for any non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.log('='.repeat(80));
  console.error('🚨 UNHANDLED ERROR OCCURRED:');
  console.error('📍 Timestamp:', new Date().toISOString());
  console.error('📍 Path:', req.url);
  console.error('📍 Method:', req.method);
  console.error('📍 Origin:', req.get('origin') || 'no-origin');
  console.error('📍 User-Agent:', req.get('User-Agent') || 'none');
  console.error('📍 Request Body:', JSON.stringify(req.body, null, 2));
  console.error('📍 Query Params:', JSON.stringify(req.query, null, 2));
  console.error('❌ Error Type:', err.constructor.name);
  console.error('❌ Error Message:', err.message);
  console.error('❌ Error Code:', err.code);
  console.error('❌ Error Stack:', err.stack);
  console.log('='.repeat(80));
  
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    path: req.url,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  console.log('='.repeat(80));
  console.log(`❓ 404 NOT FOUND - ${req.method} ${req.url}`);
  console.log('📍 Origin:', req.get('origin') || 'no-origin');
  console.log('📍 User-Agent:', req.get('User-Agent') || 'none');
  console.log('📍 Available routes: /health, /api/auth, /api/inventory, /api/mystery-boxes, /api/webhooks');
  console.log('='.repeat(80));
  
  res.status(404).json({ 
    error: 'Not found',
    path: req.path,
    method: req.method
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
});

module.exports = app;
