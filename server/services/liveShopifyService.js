const axios = require('axios');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class LiveShopifyService {
  constructor(shop, accessToken) {
    this.shop = shop;
    this.accessToken = accessToken;
    this.apiVersion = '2023-10';
    this.baseURL = `https://${shop}/admin/api/${this.apiVersion}`;
  }

  // Static method to create OAuth URL for app installation
  static getInstallUrl(shop) {
    const apiKey = process.env.SHOPIFY_API_KEY;
    const redirectUri = `${process.env.HOST}/api/auth/callback`;
    const scopes = 'read_products,write_products,read_inventory,write_inventory,read_orders,write_orders';
    const state = crypto.randomBytes(16).toString('hex');

    // In production, store state in Redis or database for verification
    const params = new URLSearchParams({
      client_id: apiKey,
      scope: scopes,
      redirect_uri: redirectUri,
      state
    });

    return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
  }

  // Exchange authorization code for access token
  static async exchangeCodeForToken(shop, code) {
    try {
      const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code
      });

      return response.data.access_token;
    } catch (error) {
      console.error('Error exchanging code for token:', error.response?.data || error.message);
      throw new Error('Failed to get access token');
    }
  }

  // Get all products from the store
  async getProducts(params = {}) {
    try {
      const defaultParams = {
        limit: 250,
        status: 'active',
        ...params
      };

      const response = await this.makeRequest('GET', '/products.json', null, defaultParams);
      return response.products;
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  // Get products with pagination
  async getAllProducts() {
    let allProducts = [];
    let hasNextPage = true;
    let pageInfo = null;

    while (hasNextPage) {
      try {
        const params = {
          limit: 250,
          status: 'active'
        };

        if (pageInfo) {
          params.page_info = pageInfo;
        }

        const response = await this.makeRequest('GET', '/products.json', null, params);
        allProducts = allProducts.concat(response.products);

        // Check for pagination
        const linkHeader = response.headers?.link;
        hasNextPage = linkHeader && linkHeader.includes('rel="next"');
        
        if (hasNextPage) {
          // Extract page_info from link header
          const nextMatch = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)/);
          pageInfo = nextMatch ? nextMatch[1] : null;
          hasNextPage = !!pageInfo;
        }

      } catch (error) {
        console.error('Error in pagination:', error);
        break;
      }
    }

    return allProducts;
  }

  // Sync products to local database
  async syncProducts() {
    try {
      console.log(`🔄 Starting product sync for shop: ${this.shop}`);
      
      // Get or create shop record
      const shopRecord = await prisma.shop.upsert({
        where: { shopDomain: this.shop },
        update: { 
          accessToken: this.accessToken,
          isActive: true
        },
        create: {
          shopDomain: this.shop,
          shopName: this.shop,
          accessToken: this.accessToken,
          isActive: true
        }
      });

      // Get all products from Shopify
      const shopifyProducts = await this.getAllProducts();
      console.log(`📦 Found ${shopifyProducts.length} products in Shopify`);

      let syncedCount = 0;
      let errorCount = 0;

      for (const product of shopifyProducts) {
        try {
          // Process each variant
          for (const variant of product.variants || []) {
            const productData = {
              shopId: shopRecord.id,
              shopifyProductId: product.id.toString(),
              shopifyVariantId: variant.id.toString(),
              title: product.title,
              description: product.body_html || '',
              vendor: product.vendor || '',
              productType: product.product_type || '',
              tags: JSON.stringify(product.tags ? product.tags.split(',').map(t => t.trim()) : []),
              price: parseFloat(variant.price || 0),
              compareAtPrice: variant.compare_at_price ? parseFloat(variant.compare_at_price) : null,
              inventoryQuantity: variant.inventory_quantity || 0,
              sku: variant.sku || '',
              barcode: variant.barcode || '',
              weight: variant.weight || 0,
              weightUnit: variant.weight_unit || 'kg',
              images: JSON.stringify(product.images?.map(img => ({
                id: img.id,
                src: img.src,
                alt: img.alt
              })) || []),
              variants: JSON.stringify(product.variants?.map(v => ({
                id: v.id,
                title: v.title,
                price: v.price,
                compareAtPrice: v.compare_at_price,
                inventoryQuantity: v.inventory_quantity,
                sku: v.sku,
                available: v.available
              })) || []),
              status: product.status || 'active',
              available: variant.available !== false,
              lastSynced: new Date()
            };

            await prisma.productCache.upsert({
              where: {
                shopId_shopifyVariantId: {
                  shopId: shopRecord.id,
                  shopifyVariantId: variant.id.toString()
                }
              },
              update: productData,
              create: productData
            });

            syncedCount++;
          }
        } catch (error) {
          console.error(`❌ Error syncing product ${product.id}:`, error.message);
          errorCount++;
        }
      }

      console.log(`✅ Sync completed: ${syncedCount} products synced, ${errorCount} errors`);
      
      return {
        success: true,
        syncedCount,
        errorCount,
        totalProducts: shopifyProducts.length
      };

    } catch (error) {
      console.error('❌ Product sync failed:', error);
      throw error;
    }
  }

  // Create a product in Shopify (for mystery boxes)
  async createProduct(productData) {
    try {
      const response = await this.makeRequest('POST', '/products.json', {
        product: productData
      });

      return response.product;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  // Update inventory levels
  async updateInventoryLevel(inventoryItemId, locationId, available) {
    try {
      const response = await this.makeRequest('POST', '/inventory_levels/set.json', {
        location_id: locationId,
        inventory_item_id: inventoryItemId,
        available
      });

      return response;
    } catch (error) {
      console.error('Error updating inventory:', error);
      throw error;
    }
  }

  // Get primary location ID
  async getPrimaryLocationId() {
    try {
      const response = await this.makeRequest('GET', '/locations.json');
      const primaryLocation = response.locations.find(loc => loc.primary) || response.locations[0];
      return primaryLocation?.id;
    } catch (error) {
      console.error('Error getting location:', error);
      throw error;
    }
  }

  // Make authenticated request to Shopify API
  async makeRequest(method, endpoint, data = null, params = null) {
    try {
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        config.data = data;
      }

      if (params) {
        config.params = params;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`Shopify API Error (${method} ${endpoint}):`, error.response?.data || error.message);
      throw error;
    }
  }

  // Verify webhook (for real-time updates)
  static verifyWebhook(data, hmacHeader) {
    const calculatedHmac = crypto
      .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
      .update(data, 'utf8')
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(calculatedHmac),
      Buffer.from(hmacHeader)
    );
  }
}

module.exports = LiveShopifyService;