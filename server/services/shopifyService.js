const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Shopify API configuration
const SHOPIFY_API_VERSION = '2023-10';
const SHOPIFY_APP_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_APP_SECRET = process.env.SHOPIFY_API_SECRET;
const SCOPES = 'read_products,write_products,read_inventory,write_inventory,read_orders';

class ShopifyService {
  // Generate OAuth URL for app installation
  static getAuthUrl(shop) {
    const state = crypto.randomBytes(16).toString('hex');
    const redirectUri = `${process.env.APP_URL}/api/auth/shopify/callback`;
    
    // Store state for verification (in production, use Redis or database)
    this.stateStore = this.stateStore || new Map();
    this.stateStore.set(state, { shop, timestamp: Date.now() });
    
    const params = new URLSearchParams({
      client_id: SHOPIFY_APP_KEY,
      scope: SCOPES,
      redirect_uri: redirectUri,
      state,
      'grant_options[]': 'per-user'
    });

    return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
  }

  // Verify state parameter
  static verifyState(state) {
    if (!this.stateStore || !this.stateStore.has(state)) {
      return false;
    }

    const stateData = this.stateStore.get(state);
    const isValid = Date.now() - stateData.timestamp < 600000; // 10 minutes

    if (isValid) {
      this.stateStore.delete(state);
    }

    return isValid;
  }

  // Exchange authorization code for access token
  static async getAccessToken(shop, code) {
    const tokenUrl = `https://${shop}/admin/oauth/access_token`;
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: SHOPIFY_APP_KEY,
        client_secret: SHOPIFY_APP_SECRET,
        code
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  // Get shop information
  static async getShopInfo(shop, accessToken) {
    const shopUrl = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/shop.json`;
    
    const response = await fetch(shopUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get shop info: ${response.statusText}`);
    }

    const data = await response.json();
    return data.shop;
  }

  // Verify access token is still valid
  static async verifyToken(shop, accessToken) {
    try {
      await this.getShopInfo(shop, accessToken);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Sync products from Shopify to local cache
  static async syncProducts(shop, accessToken) {
    try {
      const shopData = await prisma.shop.findUnique({
        where: { shopDomain: shop }
      });

      if (!shopData) {
        throw new Error('Shop not found');
      }

      let allProducts = [];
      let nextPageInfo = null;
      let pageCount = 0;
      const maxPages = 50; // Prevent infinite loops

      do {
        const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/products.json?limit=250${nextPageInfo ? `&page_info=${nextPageInfo}` : ''}`;
        
        const response = await fetch(url, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch products: ${response.statusText}`);
        }

        const data = await response.json();
        allProducts = allProducts.concat(data.products);

        // Check for pagination
        const linkHeader = response.headers.get('Link');
        nextPageInfo = this.parseNextPageInfo(linkHeader);
        pageCount++;

      } while (nextPageInfo && pageCount < maxPages);

      // Cache products in database
      let created = 0;
      let updated = 0;

      for (const product of allProducts) {
        const cached = await this.cacheProduct(shopData.id, product);
        if (cached.created) {
          created++;
        } else {
          updated++;
        }
      }

      return {
        totalProducts: allProducts.length,
        created,
        updated,
        pages: pageCount
      };

    } catch (error) {
      console.error('Error syncing products:', error);
      throw error;
    }
  }

  // Parse next page info from Link header
  static parseNextPageInfo(linkHeader) {
    if (!linkHeader) return null;

    const links = linkHeader.split(',');
    const nextLink = links.find(link => link.includes('rel="next"'));
    
    if (!nextLink) return null;

    const match = nextLink.match(/page_info=([^&>]+)/);
    return match ? match[1] : null;
  }

  // Cache a single product
  static async cacheProduct(shopId, product) {
    try {
      const productData = {
        shopifyProductId: product.id.toString(),
        title: product.title,
        description: product.body_html || '',
        vendor: product.vendor || '',
        productType: product.product_type || '',
        tags: JSON.stringify(product.tags ? product.tags.split(',').map(t => t.trim()) : []),
        status: product.status,
        price: parseFloat(product.variants[0]?.price || 0),
        compareAtPrice: parseFloat(product.variants[0]?.compare_at_price || 0),
        inventoryQuantity: product.variants.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0),
        variants: JSON.stringify(product.variants.map(v => ({
          id: v.id,
          title: v.title,
          price: v.price,
          compareAtPrice: v.compare_at_price,
          inventoryQuantity: v.inventory_quantity,
          sku: v.sku,
          weight: v.weight,
          inventoryItemId: v.inventory_item_id
        }))),
        images: JSON.stringify(product.images.map(img => ({
          id: img.id,
          src: img.src,
          alt: img.alt
        }))),
        shopId
      };

      const existingProduct = await prisma.productCache.findFirst({
        where: {
          shopId,
          shopifyProductId: product.id.toString()
        }
      });

      if (existingProduct) {
        await prisma.productCache.update({
          where: { id: existingProduct.id },
          data: { ...productData, updatedAt: new Date() }
        });
        return { created: false, product: existingProduct };
      } else {
        const newProduct = await prisma.productCache.create({
          data: productData
        });
        return { created: true, product: newProduct };
      }

    } catch (error) {
      console.error('Error caching product:', error);
      throw error;
    }
  }

  // Update cached product
  static async updateCachedProduct(shopId, product) {
    return this.cacheProduct(shopId, product);
  }

  // Refresh a specific product from Shopify
  static async refreshProduct(shop, accessToken, productId) {
    try {
      const productUrl = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/products/${productId}.json`;
      
      const response = await fetch(productUrl, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch product: ${response.statusText}`);
      }

      const data = await response.json();
      
      const shopData = await prisma.shop.findUnique({
        where: { shopDomain: shop }
      });

      if (!shopData) {
        throw new Error('Shop not found');
      }

      return await this.cacheProduct(shopData.id, data.product);

    } catch (error) {
      console.error('Error refreshing product:', error);
      throw error;
    }
  }

  // Sync inventory levels
  static async syncInventoryLevels(shop, accessToken) {
    try {
      // This would sync inventory levels from Shopify
      // For now, we'll just trigger a product sync
      return await this.syncProducts(shop, accessToken);
    } catch (error) {
      console.error('Error syncing inventory levels:', error);
      throw error;
    }
  }

  // Register webhooks with Shopify
  static async registerWebhooks(shop, accessToken, webhookUrl) {
    const webhookTopics = [
      'app/uninstalled',
      'products/create',
      'products/update',
      'products/delete',
      'inventory_levels/update',
      'orders/create'
    ];

    const registeredWebhooks = [];

    for (const topic of webhookTopics) {
      try {
        const webhook = await this.createWebhook(shop, accessToken, topic, `${webhookUrl}/${topic.replace('/', '/').replace('_', '_')}`);
        registeredWebhooks.push(webhook);
      } catch (error) {
        console.error(`Failed to register webhook for ${topic}:`, error);
      }
    }

    return registeredWebhooks;
  }

  // Create a single webhook
  static async createWebhook(shop, accessToken, topic, address) {
    const webhookUrl = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`;
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        webhook: {
          topic,
          address,
          format: 'json'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create webhook: ${response.statusText}`);
    }

    const data = await response.json();
    return data.webhook;
  }

  // Get registered webhooks
  static async getWebhooks(shop, accessToken) {
    const webhookUrl = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`;
    
    const response = await fetch(webhookUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get webhooks: ${response.statusText}`);
    }

    const data = await response.json();
    return data.webhooks;
  }

  // Create a product in Shopify (for mystery boxes)
  static async createProduct(shop, accessToken, productData) {
    const productUrl = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/products.json`;
    
    const response = await fetch(productUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        product: productData
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create product: ${response.statusText}`);
    }

    const data = await response.json();
    return data.product;
  }

  // Update a product in Shopify
  static async updateProduct(shop, accessToken, productId, productData) {
    const productUrl = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/products/${productId}.json`;
    
    const response = await fetch(productUrl, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        product: productData
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to update product: ${response.statusText}`);
    }

    const data = await response.json();
    return data.product;
  }
}

module.exports = ShopifyService;