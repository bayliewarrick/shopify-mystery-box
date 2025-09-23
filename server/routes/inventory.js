const express = require('express');
const { PrismaClient } = require('@prisma/client');
const shopifyService = require('../services/shopifyService');
const LiveShopifyService = require('../services/liveShopifyService');
const demoShopifyService = require('../services/demoShopifyService');

const router = express.Router();
const prisma = new PrismaClient();

// Ensure demo shop exists
async function ensureDemoShop(shopDomain) {
  if (shopDomain === 'pack-peddlers-demo.myshopify.com') {
    const existingShop = await prisma.shop.findUnique({
      where: { shopDomain }
    });
    
    if (!existingShop) {
      console.log('Creating demo shop:', shopDomain);
      await prisma.shop.create({
        data: {
          shopDomain,
          accessToken: 'demo-token',
          shopName: 'Pack Peddlers Demo Store',
          email: 'demo@packpeddlers.com',
          currency: 'USD',
          timezone: 'America/New_York',
          isActive: true
        }
      });
    }
  }
}

// Get cached products for a shop
router.get('/products', async (req, res) => {
  try {
    const { shop, page = 1, limit = 50, search, tags, productType } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    // Ensure demo shop exists
    await ensureDemoShop(shop);

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build where clause
    const where = {
      shop: { shopDomain: shop }
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { vendor: { contains: search, mode: 'insensitive' } },
        { productType: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      where.tags = {
        contains: tagArray[0] // Simple contains for now, could be enhanced
      };
    }

    if (productType) {
      where.productType = { contains: productType, mode: 'insensitive' };
    }

    const products = await prisma.productCache.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: parseInt(limit)
    });

    const total = await prisma.productCache.count({ where });

    // Parse JSON fields
    const formattedProducts = products.map(product => ({
      ...product,
      tags: JSON.parse(product.tags || '[]'),
      variants: JSON.parse(product.variants || '[]'),
      images: JSON.parse(product.images || '[]')
    }));

    res.json({
      products: formattedProducts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get a specific product
router.get('/products/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    const product = await prisma.productCache.findFirst({
      where: { 
        shopifyProductId: productId,
        shop: { shopDomain: shop }
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Parse JSON fields
    const formattedProduct = {
      ...product,
      tags: JSON.parse(product.tags || '[]'),
      variants: JSON.parse(product.variants || '[]'),
      images: JSON.parse(product.images || '[]')
    };

    res.json({ product: formattedProduct });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Sync products from Shopify
router.post('/sync', async (req, res) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    // Find the shop and get access token
    const shopData = await prisma.shop.findUnique({
      where: { shopDomain: shop }
    });

    if (!shopData) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    console.log(`🔄 Starting manual sync for shop: ${shop}`);
    
    // Use LiveShopifyService for live stores
    const liveService = new LiveShopifyService(shop, shopData.accessToken);
    const syncResult = await liveService.syncProducts();

    console.log(`✅ Manual sync completed for ${shop}:`, syncResult);

    // Make sure we haven't already sent a response
    if (!res.headersSent) {
      res.json({
        message: 'Products synced successfully',
        ...syncResult
      });
    } else {
      console.warn('⚠️ Response already sent, skipping duplicate response');
    }
  } catch (error) {
    console.error('Error syncing products:', error);
    
    // Only send error response if we haven't already sent one
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to sync products',
        details: error.message 
      });
    } else {
      console.warn('⚠️ Error response not sent - headers already sent');
    }
  }
});

// Demo sync - populate with sample products for testing
router.post('/sync-demo', async (req, res) => {
  try {
    console.log('🚀 Starting demo product sync...');
    console.log('📍 Request origin:', req.get('origin'));
    console.log('📍 Request headers:', JSON.stringify(req.headers, null, 2));
    
    // Create demo shop and sync demo products
    const demoShop = await demoShopifyService.createDemoShop();
    console.log('✅ Demo shop created:', demoShop.shopDomain);
    
    const syncResult = await demoShopifyService.syncProducts(demoShop.shopDomain, demoShop.accessToken);
    console.log('✅ Sync result:', syncResult);

    const response = {
      message: 'Demo products synced successfully!',
      shop: demoShop.shopDomain,
      ...syncResult
    };
    
    console.log('📤 Sending response:', response);
    res.json(response);
  } catch (error) {
    console.error('🚨 Error syncing demo products:');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({ 
      error: 'Failed to sync demo products',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get product statistics
router.get('/stats', async (req, res) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    // Get basic product counts
    const totalProducts = await prisma.productCache.count({
      where: { shop: { shopDomain: shop } }
    });

    const availableProducts = await prisma.productCache.count({
      where: { 
        shop: { shopDomain: shop },
        status: 'active'
      }
    });

    // Get product types
    const productTypes = await prisma.productCache.findMany({
      where: { shop: { shopDomain: shop } },
      select: { productType: true },
      distinct: ['productType']
    });

    // Get vendors
    const vendors = await prisma.productCache.findMany({
      where: { shop: { shopDomain: shop } },
      select: { vendor: true },
      distinct: ['vendor']
    });

    // Get price ranges
    const priceStats = await prisma.productCache.aggregate({
      where: { 
        shop: { shopDomain: shop },
        status: 'active'
      },
      _min: { price: true },
      _max: { price: true },
      _avg: { price: true }
    });

    // Get last sync time
    const lastSync = await prisma.productCache.findFirst({
      where: { shop: { shopDomain: shop } },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true }
    });

    res.json({
      totalProducts,
      availableProducts,
      productTypes: productTypes.map(p => p.productType).filter(Boolean),
      vendors: vendors.map(v => v.vendor).filter(Boolean),
      priceRange: {
        min: priceStats._min.price || 0,
        max: priceStats._max.price || 0,
        average: priceStats._avg.price || 0
      },
      lastSync: lastSync?.updatedAt
    });
  } catch (error) {
    console.error('Error fetching inventory stats:', error);
    res.status(500).json({ error: 'Failed to fetch inventory statistics' });
  }
});

// Get all unique tags
router.get('/tags', async (req, res) => {
  try {
    const { shop, search } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    // Get all products with tags
    const products = await prisma.productCache.findMany({
      where: { shop: { shopDomain: shop } },
      select: { tags: true }
    });

    // Extract and flatten all tags
    const allTags = new Set();
    products.forEach(product => {
      try {
        const tags = JSON.parse(product.tags || '[]');
        tags.forEach(tag => {
          if (tag && (!search || tag.toLowerCase().includes(search.toLowerCase()))) {
            allTags.add(tag);
          }
        });
      } catch (e) {
        // Skip invalid JSON
      }
    });

    const sortedTags = Array.from(allTags).sort();

    res.json({ tags: sortedTags });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// Get all unique product types
router.get('/product-types', async (req, res) => {
  try {
    const { shop, search } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    const where = { 
      shop: { shopDomain: shop },
      productType: { not: null }
    };

    if (search) {
      where.productType = { 
        contains: search, 
        mode: 'insensitive' 
      };
    }

    const productTypes = await prisma.productCache.findMany({
      where,
      select: { productType: true },
      distinct: ['productType']
    });

    const types = productTypes
      .map(p => p.productType)
      .filter(Boolean)
      .sort();

    res.json({ productTypes: types });
  } catch (error) {
    console.error('Error fetching product types:', error);
    res.status(500).json({ error: 'Failed to fetch product types' });
  }
});

// Get all unique vendors
router.get('/vendors', async (req, res) => {
  try {
    const { shop, search } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    const where = { 
      shop: { shopDomain: shop },
      vendor: { not: null }
    };

    if (search) {
      where.vendor = { 
        contains: search, 
        mode: 'insensitive' 
      };
    }

    const vendors = await prisma.productCache.findMany({
      where,
      select: { vendor: true },
      distinct: ['vendor']
    });

    const vendorNames = vendors
      .map(v => v.vendor)
      .filter(Boolean)
      .sort();

    res.json({ vendors: vendorNames });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

// Force refresh a specific product from Shopify
router.post('/products/:productId/refresh', async (req, res) => {
  try {
    const { productId } = req.params;
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    // Find the shop and get access token
    const shopData = await prisma.shop.findUnique({
      where: { shopDomain: shop }
    });

    if (!shopData) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    // Refresh specific product
    const product = await shopifyService.refreshProduct(shop, shopData.accessToken, productId);

    res.json({
      message: 'Product refreshed successfully',
      product
    });
  } catch (error) {
    console.error('Error refreshing product:', error);
    res.status(500).json({ error: 'Failed to refresh product' });
  }
});

// Test Shopify API connection
router.get('/test-connection', async (req, res) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    // Find the shop and get access token
    const shopData = await prisma.shop.findUnique({
      where: { shopDomain: shop }
    });

    if (!shopData) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    console.log(`🧪 Testing Shopify API connection for shop: ${shop}`);
    
    // Test with LiveShopifyService
    const liveService = new LiveShopifyService(shop, shopData.accessToken);
    
    // Try to fetch shop info first
    const shopInfo = await liveService.makeRequest('GET', '/shop.json');
    console.log(`🏪 Shop info retrieved:`, shopInfo.shop?.name);
    
    // Try to fetch just first few products
    const productsResponse = await liveService.makeRequest('GET', '/products.json', null, { limit: 5 });
    console.log(`📦 Products test - found ${productsResponse.products?.length || 0} products`);

    res.json({
      message: 'Shopify API connection successful',
      shop: shopInfo.shop?.name,
      productCount: productsResponse.products?.length || 0,
      sampleProducts: productsResponse.products?.map(p => ({ 
        id: p.id, 
        title: p.title, 
        status: p.status 
      })) || []
    });

  } catch (error) {
    console.error('❌ Error testing Shopify connection:', error);
    res.status(500).json({ 
      error: 'Failed to connect to Shopify API',
      details: error.response?.data || error.message
    });
  }
});

module.exports = router;