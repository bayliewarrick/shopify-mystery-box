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

// Test database connection and setup schema
async function setupDatabase() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // In production with PostgreSQL, run a simple schema sync
    if (process.env.DATABASE_URL?.includes('postgres')) {
      console.log('🔧 Ensuring database schema is up to date...');
      
      // Try to run a simple query to check if tables exist
      try {
        await prisma.shop.findFirst();
        console.log('✅ Database schema looks good');
      } catch (error) {
        console.log('📦 Database tables not found, creating them...');
        console.log('Error details:', error.message);
        
        const { execSync } = require('child_process');
        
        try {
          // Run db push to create tables
          console.log('Running: npx prisma db push --accept-data-loss');
          execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
          console.log('✅ Database schema created successfully');
          
          // Test again
          await prisma.shop.findFirst();
          console.log('✅ Database schema verified');
        } catch (pushError) {
          console.error('❌ Database schema setup failed:', pushError.message);
          console.log('You can manually trigger setup by calling POST /setup-database');
        }
      }
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
  }
}

setupDatabase();

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

// Body parsing middleware with error handling
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      console.error('Invalid JSON in request body:', e.message);
      res.status(400).json({ error: 'Invalid JSON in request body' });
      return;
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Request body:', JSON.stringify(req.body, null, 2));
  }
  if (req.query && Object.keys(req.query).length > 0) {
    console.log('Query params:', req.query);
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Database setup endpoint
app.post('/setup-database', async (req, res) => {
  try {
    console.log('🔧 Manual database setup triggered...');
    
    // Create tables using raw SQL
    const createTables = `
      -- Create shops table
      CREATE TABLE IF NOT EXISTS shops (
        id SERIAL PRIMARY KEY,
        "shopDomain" TEXT UNIQUE NOT NULL,
        "accessToken" TEXT NOT NULL,
        "shopName" TEXT,
        email TEXT,
        currency TEXT,
        timezone TEXT,
        "isActive" BOOLEAN DEFAULT true NOT NULL,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      -- Create mystery_boxes table
      CREATE TABLE IF NOT EXISTS mystery_boxes (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        "minValue" DOUBLE PRECISION NOT NULL,
        "maxValue" DOUBLE PRECISION NOT NULL,
        "minItems" INTEGER DEFAULT 1 NOT NULL,
        "maxItems" INTEGER NOT NULL,
        "includeTags" TEXT NOT NULL,
        "excludeTags" TEXT NOT NULL,
        "includeProductTypes" TEXT NOT NULL,
        "excludeProductTypes" TEXT NOT NULL,
        "isActive" BOOLEAN DEFAULT true NOT NULL,
        "isAutomatic" BOOLEAN DEFAULT false NOT NULL,
        "shopId" INTEGER NOT NULL,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY ("shopId") REFERENCES shops(id) ON DELETE CASCADE
      );

      -- Create box_instances table
      CREATE TABLE IF NOT EXISTS box_instances (
        id SERIAL PRIMARY KEY,
        "mysteryBoxId" INTEGER NOT NULL,
        "totalValue" DOUBLE PRECISION NOT NULL,
        "itemCount" INTEGER NOT NULL,
        "selectedProducts" TEXT NOT NULL,
        status TEXT DEFAULT 'DRAFT' NOT NULL,
        "generatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "publishedAt" TIMESTAMP(3),
        "soldAt" TIMESTAMP(3),
        "shopifyProductId" TEXT,
        "shopifyVariantId" TEXT,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY ("mysteryBoxId") REFERENCES mystery_boxes(id) ON DELETE CASCADE
      );

      -- Create product_cache table
      CREATE TABLE IF NOT EXISTS product_cache (
        id SERIAL PRIMARY KEY,
        "shopId" INTEGER NOT NULL,
        "shopifyProductId" TEXT NOT NULL,
        title TEXT NOT NULL,
        handle TEXT NOT NULL,
        description TEXT,
        vendor TEXT,
        "productType" TEXT,
        tags TEXT NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        "compareAtPrice" DOUBLE PRECISION,
        "costPerItem" DOUBLE PRECISION,
        inventory INTEGER DEFAULT 0 NOT NULL,
        available BOOLEAN DEFAULT true NOT NULL,
        "imageUrl" TEXT,
        "isActive" BOOLEAN DEFAULT true NOT NULL,
        "lastSynced" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY ("shopId") REFERENCES shops(id) ON DELETE CASCADE,
        UNIQUE("shopId", "shopifyProductId")
      );
    `;
    
    await prisma.$executeRawUnsafe(createTables);
    
    // Test the connection by creating a demo shop
    const demoShop = await prisma.shop.upsert({
      where: { shopDomain: 'pack-peddlers-demo.myshopify.com' },
      update: {},
      create: {
        shopDomain: 'pack-peddlers-demo.myshopify.com',
        accessToken: 'demo-token',
        shopName: 'Pack Peddlers Demo Store',
        email: 'demo@packpeddlers.com',
        currency: 'USD',
        timezone: 'America/New_York',
        isActive: true
      }
    });
    
    res.json({ 
      success: true, 
      message: 'Database setup completed successfully',
      demoShop: demoShop,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Manual database setup failed:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
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
