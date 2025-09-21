const express = require('express');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const shopifyService = require('../services/shopifyService');

const router = express.Router();
const prisma = new PrismaClient();

// Middleware to verify webhook authenticity
const verifyWebhook = (req, res, next) => {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
  const topic = req.get('X-Shopify-Topic');
  const shop = req.get('X-Shopify-Shop-Domain');

  if (!hmacHeader || !topic || !shop) {
    return res.status(401).json({ error: 'Missing required headers' });
  }

  const body = JSON.stringify(req.body);
  const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('SHOPIFY_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  const hash = crypto
    .createHmac('sha256', webhookSecret)
    .update(body, 'utf8')
    .digest('base64');

  if (hash !== hmacHeader) {
    console.error('Webhook verification failed');
    return res.status(401).json({ error: 'Webhook verification failed' });
  }

  req.shopifyTopic = topic;
  req.shopifyShop = shop;
  next();
};

// App uninstall webhook
router.post('/app/uninstalled', verifyWebhook, async (req, res) => {
  try {
    const shop = req.shopifyShop;

    console.log(`App uninstalled for shop: ${shop}`);

    // Remove shop and all associated data
    await prisma.shop.delete({
      where: { shopDomain: shop }
    });

    console.log(`Cleaned up data for uninstalled shop: ${shop}`);

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error handling app uninstall webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Product create webhook
router.post('/products/create', verifyWebhook, async (req, res) => {
  try {
    const shop = req.shopifyShop;
    const product = req.body;

    console.log(`Product created in shop ${shop}: ${product.title} (ID: ${product.id})`);

    // Find the shop
    const shopData = await prisma.shop.findUnique({
      where: { shopDomain: shop }
    });

    if (!shopData) {
      console.error(`Shop not found: ${shop}`);
      return res.status(404).json({ error: 'Shop not found' });
    }

    // Add product to cache
    await shopifyService.cacheProduct(shopData.id, product);

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error handling product create webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Product update webhook
router.post('/products/update', verifyWebhook, async (req, res) => {
  try {
    const shop = req.shopifyShop;
    const product = req.body;

    console.log(`Product updated in shop ${shop}: ${product.title} (ID: ${product.id})`);

    // Find the shop
    const shopData = await prisma.shop.findUnique({
      where: { shopDomain: shop }
    });

    if (!shopData) {
      console.error(`Shop not found: ${shop}`);
      return res.status(404).json({ error: 'Shop not found' });
    }

    // Update product in cache
    await shopifyService.updateCachedProduct(shopData.id, product);

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error handling product update webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Product delete webhook
router.post('/products/delete', verifyWebhook, async (req, res) => {
  try {
    const shop = req.shopifyShop;
    const product = req.body;

    console.log(`Product deleted in shop ${shop}: ID ${product.id}`);

    // Find the shop
    const shopData = await prisma.shop.findUnique({
      where: { shopDomain: shop }
    });

    if (!shopData) {
      console.error(`Shop not found: ${shop}`);
      return res.status(404).json({ error: 'Shop not found' });
    }

    // Remove product from cache
    await prisma.productCache.deleteMany({
      where: {
        shopId: shopData.id,
        shopifyProductId: product.id.toString()
      }
    });

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error handling product delete webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Inventory level update webhook
router.post('/inventory_levels/update', verifyWebhook, async (req, res) => {
  try {
    const shop = req.shopifyShop;
    const inventoryLevel = req.body;

    console.log(`Inventory updated in shop ${shop}: ${inventoryLevel.inventory_item_id} = ${inventoryLevel.available}`);

    // Find the shop
    const shopData = await prisma.shop.findUnique({
      where: { shopDomain: shop }
    });

    if (!shopData) {
      console.error(`Shop not found: ${shop}`);
      return res.status(404).json({ error: 'Shop not found' });
    }

    // Update inventory in product cache
    // Note: This would require mapping inventory_item_id to product variants
    // For now, we'll trigger a sync of affected products
    await shopifyService.syncInventoryLevels(shop, shopData.accessToken);

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error handling inventory update webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Order create webhook (for tracking mystery box sales)
router.post('/orders/create', verifyWebhook, async (req, res) => {
  try {
    const shop = req.shopifyShop;
    const order = req.body;

    console.log(`Order created in shop ${shop}: ${order.name} (ID: ${order.id})`);

    // Check if order contains any mystery box products
    // This would require tracking which Shopify products are mystery boxes
    // For now, just log the order
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error handling order create webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Generic webhook handler for testing
router.post('/test', verifyWebhook, async (req, res) => {
  try {
    const shop = req.shopifyShop;
    const topic = req.shopifyTopic;

    console.log(`Test webhook received from shop ${shop}: ${topic}`);
    console.log('Payload:', JSON.stringify(req.body, null, 2));

    res.status(200).json({ 
      received: true,
      shop,
      topic,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error handling test webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Webhook registration helper endpoint
router.post('/register', async (req, res) => {
  try {
    const { shop } = req.query;
    const { webhookUrl } = req.body;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    if (!webhookUrl) {
      return res.status(400).json({ error: 'Webhook URL is required' });
    }

    // Find the shop
    const shopData = await prisma.shop.findUnique({
      where: { shopDomain: shop }
    });

    if (!shopData) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    // Register webhooks with Shopify
    const webhooks = await shopifyService.registerWebhooks(shop, shopData.accessToken, webhookUrl);

    res.json({
      message: 'Webhooks registered successfully',
      webhooks
    });
  } catch (error) {
    console.error('Error registering webhooks:', error);
    res.status(500).json({ error: 'Failed to register webhooks' });
  }
});

// List registered webhooks
router.get('/list', async (req, res) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    // Find the shop
    const shopData = await prisma.shop.findUnique({
      where: { shopDomain: shop }
    });

    if (!shopData) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    // Get registered webhooks from Shopify
    const webhooks = await shopifyService.getWebhooks(shop, shopData.accessToken);

    res.json({ webhooks });
  } catch (error) {
    console.error('Error listing webhooks:', error);
    res.status(500).json({ error: 'Failed to list webhooks' });
  }
});

module.exports = router;