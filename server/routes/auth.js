const express = require('express');
const { PrismaClient } = require('@prisma/client');
const shopifyService = require('../services/shopifyService');
const LiveShopifyService = require('../services/liveShopifyService');

const router = express.Router();
const prisma = new PrismaClient();

// Live Shopify OAuth installation route
router.get('/install', async (req, res) => {
  try {
    // Check if Shopify credentials are configured
    if (!process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_API_SECRET || !process.env.HOST) {
      return res.status(400).json({ 
        error: 'Shopify app credentials not configured',
        message: 'Please set SHOPIFY_API_KEY, SHOPIFY_API_SECRET, and HOST environment variables'
      });
    }

    const { shop } = req.query;
    
    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    // Validate shop domain format
    if (!shop.endsWith('.myshopify.com')) {
      return res.status(400).json({ error: 'Invalid shop domain format' });
    }

    const authUrl = LiveShopifyService.getInstallUrl(shop);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error in Shopify install:', error);
    res.status(500).json({ error: 'Failed to generate install URL' });
  }
});

// OAuth callback route
router.get('/callback', async (req, res) => {
  try {
    const { shop, code, state } = req.query;

    if (!shop || !code) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log(`🔐 Processing OAuth callback for shop: ${shop}`);

    // Exchange code for access token
    const accessToken = await LiveShopifyService.exchangeCodeForToken(shop, code);
    
    console.log(`✅ Successfully obtained access token for ${shop}`);

    // Store shop data in database
    const shopRecord = await prisma.shop.upsert({
      where: { shopDomain: shop },
      update: { 
        accessToken,
        isActive: true
      },
      create: {
        shopDomain: shop,
        shopName: shop,
        accessToken,
        isActive: true
      }
    });

    console.log(`💾 Shop record saved for ${shop}`);

    // Start initial product sync
    const liveService = new LiveShopifyService(shop, accessToken);
    
    // Sync products in background
    liveService.syncProducts().then(result => {
      console.log(`📦 Initial sync completed for ${shop}:`, result);
    }).catch(error => {
      console.error(`❌ Initial sync failed for ${shop}:`, error.message);
    });

    // Redirect to app with success
    res.redirect(`${process.env.HOST || 'http://localhost:3002'}?shop=${shop}&installed=true`);

  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    res.status(500).json({ 
      error: 'Authentication failed',
      details: error.message 
    });
  }
});

// Manual sync route
router.post('/sync', async (req, res) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    console.log(`🔄 Manual sync requested for shop: ${shop}`);

    // Get shop record
    const shopRecord = await prisma.shop.findUnique({
      where: { shopDomain: shop }
    });

    if (!shopRecord || !shopRecord.accessToken) {
      return res.status(404).json({ error: 'Shop not found or not authenticated' });
    }

    // Create service instance and sync
    const liveService = new LiveShopifyService(shop, shopRecord.accessToken);
    const result = await liveService.syncProducts();

    res.json({
      success: true,
      message: `Synced ${result.syncedCount} products from ${shop}`,
      ...result
    });

  } catch (error) {
    console.error('❌ Manual sync error:', error);
    res.status(500).json({ 
      error: 'Sync failed',
      details: error.message 
    });
  }
});

// Shopify OAuth installation route (demo/legacy)
router.get('/shopify/install', async (req, res) => {
  try {
    const { shop } = req.query;
    
    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    const authUrl = shopifyService.getAuthUrl(shop);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error in Shopify install:', error);
    res.status(500).json({ error: 'Failed to initiate Shopify OAuth' });
  }
});

// Shopify OAuth callback
router.get('/shopify/callback', async (req, res) => {
  try {
    const { code, shop, state } = req.query;

    if (!code || !shop) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Verify state parameter for security
    if (!shopifyService.verifyState(state)) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }

    // Exchange code for access token
    const accessToken = await shopifyService.getAccessToken(shop, code);

    // Get shop info
    const shopInfo = await shopifyService.getShopInfo(shop, accessToken);

    // Store or update shop in database
    const shopData = await prisma.shop.upsert({
      where: { shopDomain: shop },
      update: {
        accessToken,
        shopName: shopInfo.name,
        email: shopInfo.email,
        currency: shopInfo.currency,
        timezone: shopInfo.timezone,
        updatedAt: new Date()
      },
      create: {
        shopDomain: shop,
        accessToken,
        shopName: shopInfo.name,
        email: shopInfo.email,
        currency: shopInfo.currency,
        timezone: shopInfo.timezone
      }
    });

    // Redirect to app with success
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}?shop=${shop}&installed=true`);
  } catch (error) {
    console.error('Error in Shopify callback:', error);
    res.status(500).json({ error: 'Failed to complete Shopify OAuth' });
  }
});

// Verify shop authentication
router.get('/verify', async (req, res) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    const shopData = await prisma.shop.findUnique({
      where: { shopDomain: shop }
    });

    if (!shopData) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    // Verify token is still valid
    const isValid = await shopifyService.verifyToken(shop, shopData.accessToken);

    if (!isValid) {
      return res.status(401).json({ error: 'Token invalid or expired' });
    }

    res.json({
      authenticated: true,
      shop: {
        domain: shopData.shopDomain,
        name: shopData.shopName,
        email: shopData.email,
        currency: shopData.currency
      }
    });
  } catch (error) {
    console.error('Error verifying shop:', error);
    res.status(500).json({ error: 'Failed to verify authentication' });
  }
});

// Get current shop info
router.get('/shop-info', async (req, res) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    const shopData = await prisma.shop.findUnique({
      where: { shopDomain: shop },
      include: {
        mysteryBoxes: {
          select: {
            id: true,
            name: true,
            isActive: true,
            createdAt: true
          }
        }
      }
    });

    if (!shopData) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    res.json({
      shop: {
        domain: shopData.shopDomain,
        name: shopData.shopName,
        email: shopData.email,
        currency: shopData.currency,
        timezone: shopData.timezone,
        createdAt: shopData.createdAt,
        mysteryBoxCount: shopData.mysteryBoxes.length,
        activeMysteryBoxes: shopData.mysteryBoxes.filter(box => box.isActive).length
      }
    });
  } catch (error) {
    console.error('Error getting shop info:', error);
    res.status(500).json({ error: 'Failed to get shop information' });
  }
});

// Uninstall/disconnect shop
router.delete('/disconnect', async (req, res) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    // Delete shop and all related data
    await prisma.shop.delete({
      where: { shopDomain: shop }
    });

    res.json({ message: 'Shop disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting shop:', error);
    res.status(500).json({ error: 'Failed to disconnect shop' });
  }
});

module.exports = router;