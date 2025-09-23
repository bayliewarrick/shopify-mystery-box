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

    console.log(`🔍 Fetching products from Shopify store: ${this.shop}`);

    while (hasNextPage) {
      try {
        const params = {
          limit: 250
          // Remove status filter to get ALL products (active, draft, archived)
        };

        if (pageInfo) {
          params.page_info = pageInfo;
        }

        console.log(`📡 Making API request to /products.json with params:`, params);
        const response = await this.makeRequest('GET', '/products.json', null, params);
        
        console.log(`📦 Received ${response.products?.length || 0} products in this batch`);
        console.log(`🔍 Sample product titles:`, response.products?.slice(0, 3).map(p => p.title) || []);
        
        allProducts = allProducts.concat(response.products || []);

        // Check for pagination
        const linkHeader = response.headers?.link;
        hasNextPage = linkHeader && linkHeader.includes('rel="next"');
        
        if (hasNextPage) {
          // Extract page_info from link header
          const nextMatch = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)/);
          pageInfo = nextMatch ? nextMatch[1] : null;
          hasNextPage = !!pageInfo;
          console.log(`➡️ Has next page, page_info: ${pageInfo}`);
        }

      } catch (error) {
        console.error('❌ Error in pagination:', error.response?.data || error.message);
        break;
      }
    }

    console.log(`✅ Total products fetched: ${allProducts.length}`);
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
        console.log(`🔍 Processing product: ${product.title} (ID: ${product.id}, Status: ${product.status})`);
        console.log(`📝 Product has ${product.variants?.length || 0} variants`);
        
        try {
          // Skip products without variants
          if (!product.variants || product.variants.length === 0) {
            console.log(`⚠️ Skipping product ${product.title} - no variants`);
            continue;
          }

          // Check if product has variants
          if (!product.variants || product.variants.length === 0) {
            console.log(`⚠️  Skipping product ${product.id} (${product.title}): No variants`);
            continue;
          }

          // Get primary variant for price (usually the first one)
          const primaryVariant = product.variants[0];
          
          // Calculate total inventory across all variants
          const totalInventory = product.variants.reduce((total, v) => total + (v.inventory_quantity || 0), 0);
          
          const productData = {
            shopId: shopRecord.id,
            shopifyProductId: product.id.toString(),
            title: product.title || 'Untitled Product',
            description: product.body_html || '',
            vendor: product.vendor || '',
            productType: product.product_type || '',
            tags: JSON.stringify(product.tags ? product.tags.split(',').map(t => t.trim()) : []),
            price: parseFloat(primaryVariant.price || 0),
            compareAtPrice: primaryVariant.compare_at_price ? parseFloat(primaryVariant.compare_at_price) : 0,
            inventoryQuantity: totalInventory,
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
            status: product.status || 'active'
          };

          // Validate required fields
          if (!productData.shopId) {
            throw new Error('Missing required field: shopId');
          }
          if (!productData.shopifyProductId) {
            throw new Error('Missing required field: shopifyProductId');  
          }
          if (!productData.title) {
            throw new Error('Missing required field: title');
          }
          if (isNaN(productData.price)) {
            throw new Error('Invalid price value');
          }

          console.log(`   💾 Saving product data for ${product.title}`);
          console.log(`   📊 Product data:`, JSON.stringify(productData, null, 2));
          
          try {
            await prisma.productCache.upsert({
              where: {
                shopId_shopifyProductId: {
                  shopId: shopRecord.id,
                  shopifyProductId: product.id.toString()
                }
              },
              update: productData,
              create: productData
            });

            console.log(`   ✅ Successfully saved product ${product.id} (${product.title})`);
            syncedCount++;
          } catch (dbError) {
            console.error(`   ❌ Database error for product ${product.id}:`, dbError.message);
            console.error(`   ❌ Full database error:`, dbError);
            throw dbError; // Re-throw to be caught by outer try-catch
          }
        } catch (error) {
          console.error(`❌ Error syncing product ${product.id} (${product.title}):`, error.message);
          console.error(`❌ Error details:`, {
            message: error.message,
            code: error.code,
            meta: error.meta,
            cause: error.cause,
            prismaStack: error.stack
          });
          console.error(`❌ Product data that failed:`, {
            shopId: shopRecord.id,
            shopifyProductId: product.id.toString(),
            title: product.title,
            price: parseFloat(primaryVariant?.price || 0),
            hasVariants: !!product.variants,
            variantCount: product.variants?.length || 0
          });
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

      console.log(`🚀 Making Shopify API request: ${method} ${this.baseURL}${endpoint}`);
      console.log(`🔑 Using access token: ${this.accessToken?.substring(0, 10)}...`);
      
      const response = await axios(config);
      
      console.log(`✅ Shopify API response status: ${response.status}`);
      console.log(`📊 Response data keys:`, Object.keys(response.data || {}));
      
      return response.data;
    } catch (error) {
      console.error(`❌ Shopify API Error (${method} ${endpoint}):`);
      console.error(`Status: ${error.response?.status}`);
      console.error(`Error data:`, error.response?.data);
      console.error(`Error message:`, error.message);
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