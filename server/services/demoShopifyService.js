const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Demo Shopify products for testing
const demoProducts = [
  {
    id: "7234567890123",
    title: "Mystery Pack T-Shirt",
    body_html: "<p>High-quality cotton t-shirt perfect for mystery boxes</p>",
    vendor: "Pack Peddlers",
    product_type: "Apparel",
    tags: "clothing,t-shirt,cotton,mystery,basic",
    status: "active",
    variants: [
      {
        id: "41234567890123",
        title: "Small",
        price: "19.99",
        compare_at_price: "29.99",
        inventory_quantity: 25,
        sku: "TSHIRT-S-001",
        weight: 200,
        inventory_item_id: "43234567890123"
      },
      {
        id: "41234567890124",
        title: "Medium",
        price: "19.99",
        compare_at_price: "29.99",
        inventory_quantity: 30,
        sku: "TSHIRT-M-001",
        weight: 220,
        inventory_item_id: "43234567890124"
      }
    ],
    images: [
      {
        id: "29234567890123",
        src: "https://via.placeholder.com/300x300/4CAF50/white?text=T-Shirt",
        alt: "Mystery Pack T-Shirt"
      }
    ]
  },
  {
    id: "7234567890124",
    title: "Premium Hoodie",
    body_html: "<p>Cozy premium hoodie for cold weather</p>",
    vendor: "Pack Peddlers",
    product_type: "Apparel",
    tags: "clothing,hoodie,premium,winter,warm",
    status: "active",
    variants: [
      {
        id: "41234567890125",
        title: "Medium",
        price: "49.99",
        compare_at_price: "69.99",
        inventory_quantity: 15,
        sku: "HOODIE-M-001",
        weight: 600,
        inventory_item_id: "43234567890125"
      }
    ],
    images: [
      {
        id: "29234567890124",
        src: "https://via.placeholder.com/300x300/2196F3/white?text=Hoodie",
        alt: "Premium Hoodie"
      }
    ]
  },
  {
    id: "7234567890125",
    title: "Wireless Earbuds",
    body_html: "<p>High-quality wireless earbuds with noise cancellation</p>",
    vendor: "Tech Supplies Co",
    product_type: "Electronics",
    tags: "electronics,audio,wireless,earbuds,tech",
    status: "active",
    variants: [
      {
        id: "41234567890126",
        title: "Black",
        price: "89.99",
        compare_at_price: "129.99",
        inventory_quantity: 20,
        sku: "EARBUDS-BLK-001",
        weight: 50,
        inventory_item_id: "43234567890126"
      }
    ],
    images: [
      {
        id: "29234567890125",
        src: "https://via.placeholder.com/300x300/9C27B0/white?text=Earbuds",
        alt: "Wireless Earbuds"
      }
    ]
  },
  {
    id: "7234567890126",
    title: "Coffee Mug Set",
    body_html: "<p>Set of 2 ceramic coffee mugs with unique designs</p>",
    vendor: "Home Essentials",
    product_type: "Home & Garden",
    tags: "home,kitchen,coffee,mug,ceramic,set",
    status: "active",
    variants: [
      {
        id: "41234567890127",
        title: "Set of 2",
        price: "24.99",
        compare_at_price: "34.99",
        inventory_quantity: 40,
        sku: "MUG-SET-001",
        weight: 800,
        inventory_item_id: "43234567890127"
      }
    ],
    images: [
      {
        id: "29234567890126",
        src: "https://via.placeholder.com/300x300/FF5722/white?text=Mugs",
        alt: "Coffee Mug Set"
      }
    ]
  },
  {
    id: "7234567890127",
    title: "Phone Case",
    body_html: "<p>Protective phone case with shock absorption</p>",
    vendor: "Mobile Accessories",
    product_type: "Electronics",
    tags: "electronics,phone,case,protection,mobile",
    status: "active",
    variants: [
      {
        id: "41234567890128",
        title: "Clear",
        price: "12.99",
        compare_at_price: "19.99",
        inventory_quantity: 60,
        sku: "CASE-CLR-001",
        weight: 30,
        inventory_item_id: "43234567890128"
      }
    ],
    images: [
      {
        id: "29234567890127",
        src: "https://via.placeholder.com/300x300/607D8B/white?text=Case",
        alt: "Phone Case"
      }
    ]
  }
];

class DemoShopifyService {
  // Simulate product sync for demo purposes
  static async syncProducts(shop, accessToken) {
    try {
      console.log(`🔄 Demo: Syncing products for ${shop}...`);
      
      // Find or create demo shop
      let shopData = await prisma.shop.findUnique({
        where: { shopDomain: shop }
      });

      if (!shopData) {
        shopData = await prisma.shop.create({
          data: {
            shopDomain: shop,
            accessToken: accessToken || 'demo_token',
            shopName: 'Pack Peddlers Demo Store',
            email: 'demo@packpeddlers.com',
            currency: 'USD',
            timezone: 'America/New_York'
          }
        });
      }

      let created = 0;
      let updated = 0;

      // Cache demo products
      for (const product of demoProducts) {
        const existingProduct = await prisma.productCache.findFirst({
          where: {
            shopId: shopData.id,
            shopifyProductId: product.id.toString()
          }
        });

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
          shopId: shopData.id
        };

        if (existingProduct) {
          await prisma.productCache.update({
            where: { id: existingProduct.id },
            data: { ...productData, updatedAt: new Date() }
          });
          updated++;
        } else {
          await prisma.productCache.create({
            data: productData
          });
          created++;
        }
      }

      console.log(`✅ Demo sync complete: ${created} created, ${updated} updated`);

      return {
        totalProducts: demoProducts.length,
        created,
        updated,
        pages: 1
      };

    } catch (error) {
      console.error('❌ Demo sync error:', error);
      throw error;
    }
  }

  // Create demo shop for testing
  static async createDemoShop() {
    try {
      const demoShop = await prisma.shop.upsert({
        where: { shopDomain: 'pack-peddlers-demo.myshopify.com' },
        update: {
          shopName: 'Pack Peddlers Demo Store',
          email: 'demo@packpeddlers.com',
          currency: 'USD',
          timezone: 'America/New_York',
          updatedAt: new Date()
        },
        create: {
          shopDomain: 'pack-peddlers-demo.myshopify.com',
          accessToken: 'demo_access_token',
          shopName: 'Pack Peddlers Demo Store',
          email: 'demo@packpeddlers.com',
          currency: 'USD',
          timezone: 'America/New_York'
        }
      });

      console.log('✅ Demo shop created:', demoShop.shopDomain);
      return demoShop;
    } catch (error) {
      console.error('❌ Error creating demo shop:', error);
      throw error;
    }
  }
}

module.exports = DemoShopifyService;