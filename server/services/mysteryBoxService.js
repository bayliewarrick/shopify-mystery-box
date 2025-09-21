const { PrismaClient } = require('@prisma/client');
const shopifyService = require('./shopifyService');

const prisma = new PrismaClient();

class MysteryBoxService {
  // Generate a mystery box instance
  static async generateMysteryBox(shop, mysteryBoxConfig) {
    try {
      // Get shop data
      const shopData = await prisma.shop.findUnique({
        where: { shopDomain: shop }
      });

      if (!shopData) {
        throw new Error('Shop not found');
      }

      // Parse filter criteria
      const includeTags = JSON.parse(mysteryBoxConfig.includeTags || '[]');
      const excludeTags = JSON.parse(mysteryBoxConfig.excludeTags || '[]');
      const includeProductTypes = JSON.parse(mysteryBoxConfig.includeProductTypes || '[]');
      const excludeProductTypes = JSON.parse(mysteryBoxConfig.excludeProductTypes || '[]');

      // Build product filter criteria
      const whereClause = {
        shopId: shopData.id,
        status: 'active',
        inventoryQuantity: { gt: 0 }, // Only products in stock
        price: {
          gte: 0.01 // Exclude free products
        }
      };

      // Apply product type filters
      if (includeProductTypes.length > 0) {
        whereClause.productType = { in: includeProductTypes };
      }
      if (excludeProductTypes.length > 0) {
        whereClause.productType = { notIn: excludeProductTypes };
      }

      // Get all matching products
      const allProducts = await prisma.productCache.findMany({
        where: whereClause
      });

      // Filter by tags (since we store tags as JSON strings)
      let filteredProducts = allProducts.filter(product => {
        try {
          const productTags = JSON.parse(product.tags || '[]');
          
          // Check include tags
          if (includeTags.length > 0) {
            const hasIncludeTag = includeTags.some(tag => 
              productTags.some(pTag => pTag.toLowerCase().includes(tag.toLowerCase()))
            );
            if (!hasIncludeTag) return false;
          }

          // Check exclude tags
          if (excludeTags.length > 0) {
            const hasExcludeTag = excludeTags.some(tag => 
              productTags.some(pTag => pTag.toLowerCase().includes(tag.toLowerCase()))
            );
            if (hasExcludeTag) return false;
          }

          return true;
        } catch (e) {
          // If tags can't be parsed, include the product
          return true;
        }
      });

      if (filteredProducts.length === 0) {
        throw new Error('No products match the mystery box criteria');
      }

      // Generate mystery box using algorithm
      const selectedProducts = this.selectProducts(
        filteredProducts,
        mysteryBoxConfig.minValue,
        mysteryBoxConfig.maxValue,
        mysteryBoxConfig.minItems,
        mysteryBoxConfig.maxItems
      );

      // Calculate totals
      const totalValue = selectedProducts.reduce((sum, p) => sum + p.price, 0);
      const itemCount = selectedProducts.length;

      // Create box instance
      const boxInstance = await prisma.boxInstance.create({
        data: {
          mysteryBoxId: mysteryBoxConfig.id,
          products: JSON.stringify(selectedProducts.map(p => ({
            shopifyProductId: p.shopifyProductId,
            title: p.title,
            price: p.price,
            compareAtPrice: p.compareAtPrice,
            vendor: p.vendor,
            productType: p.productType,
            images: JSON.parse(p.images || '[]'),
            selectedVariant: this.selectVariant(JSON.parse(p.variants || '[]'))
          }))),
          totalValue,
          itemCount,
          generatedAt: new Date()
        }
      });

      return {
        id: boxInstance.id,
        mysteryBoxId: boxInstance.mysteryBoxId,
        products: JSON.parse(boxInstance.products),
        totalValue: boxInstance.totalValue,
        itemCount: boxInstance.itemCount,
        generatedAt: boxInstance.generatedAt,
        savings: this.calculateSavings(JSON.parse(boxInstance.products), totalValue)
      };

    } catch (error) {
      console.error('Error generating mystery box:', error);
      throw error;
    }
  }

  // Product selection algorithm
  static selectProducts(products, minValue, maxValue, minItems, maxItems) {
    // Sort products by value for better selection
    const sortedProducts = [...products].sort((a, b) => a.price - b.price);
    
    const selected = [];
    let currentValue = 0;
    let attempts = 0;
    const maxAttempts = 1000;

    // Target value range
    const targetValue = minValue + (Math.random() * (maxValue - minValue));
    
    // Target item count
    const targetItems = minItems + Math.floor(Math.random() * (maxItems - minItems + 1));

    while (selected.length < targetItems && attempts < maxAttempts) {
      attempts++;

      // Find products that would fit in remaining value budget
      const remainingValue = targetValue - currentValue;
      const availableProducts = sortedProducts.filter(p => 
        !selected.includes(p) && 
        p.price <= remainingValue &&
        p.price >= 0.01
      );

      if (availableProducts.length === 0) break;

      // Select product based on strategy
      let selectedProduct;
      
      if (selected.length < minItems) {
        // For minimum items, prefer lower-priced products to leave room
        selectedProduct = availableProducts[Math.floor(Math.random() * Math.min(availableProducts.length, 3))];
      } else {
        // For additional items, can select any available product
        selectedProduct = availableProducts[Math.floor(Math.random() * availableProducts.length)];
      }

      selected.push(selectedProduct);
      currentValue += selectedProduct.price;

      // Check if we've hit our value target
      if (currentValue >= minValue && selected.length >= minItems) {
        // We have a valid box, but might want to add more if space allows
        if (currentValue >= targetValue * 0.9 || selected.length >= targetItems) {
          break;
        }
      }
    }

    // Ensure we meet minimum requirements
    if (selected.length < minItems || currentValue < minValue) {
      // Try a different approach - start with higher value items
      return this.selectProductsFallback(products, minValue, maxValue, minItems, maxItems);
    }

    return selected;
  }

  // Fallback selection algorithm
  static selectProductsFallback(products, minValue, maxValue, minItems, maxItems) {
    const selected = [];
    let currentValue = 0;

    // Sort by price descending to start with higher value items
    const sortedProducts = [...products].sort((a, b) => b.price - a.price);
    
    // First, select products to meet minimum value
    for (const product of sortedProducts) {
      if (selected.length >= maxItems) break;
      if (currentValue + product.price > maxValue) continue;
      
      selected.push(product);
      currentValue += product.price;
      
      if (currentValue >= minValue && selected.length >= minItems) {
        break;
      }
    }

    // If we still don't meet requirements, select cheapest products to meet minItems
    if (selected.length < minItems) {
      const cheapestProducts = [...products]
        .filter(p => !selected.includes(p))
        .sort((a, b) => a.price - b.price);

      for (const product of cheapestProducts) {
        if (selected.length >= minItems) break;
        if (currentValue + product.price > maxValue) continue;
        
        selected.push(product);
        currentValue += product.price;
      }
    }

    return selected;
  }

  // Select variant for a product (prefer in-stock variants)
  static selectVariant(variants) {
    if (!variants || variants.length === 0) return null;

    // Prefer variants with inventory
    const inStockVariants = variants.filter(v => (v.inventoryQuantity || 0) > 0);
    
    if (inStockVariants.length > 0) {
      return inStockVariants[Math.floor(Math.random() * inStockVariants.length)];
    }

    // Fallback to any variant
    return variants[0];
  }

  // Calculate savings (compare at price vs selected price)
  static calculateSavings(products, totalValue) {
    const totalCompareAtPrice = products.reduce((sum, p) => {
      return sum + (p.compareAtPrice || p.price);
    }, 0);

    return Math.max(0, totalCompareAtPrice - totalValue);
  }

  // Get product recommendations for mystery box criteria
  static async getProductRecommendations(shop, criteria) {
    try {
      const shopData = await prisma.shop.findUnique({
        where: { shopDomain: shop }
      });

      if (!shopData) {
        throw new Error('Shop not found');
      }

      // Build filter
      const whereClause = {
        shopId: shopData.id,
        status: 'active',
        inventoryQuantity: { gt: 0 }
      };

      if (criteria.minPrice !== undefined) {
        whereClause.price = { ...whereClause.price, gte: criteria.minPrice };
      }
      if (criteria.maxPrice !== undefined) {
        whereClause.price = { ...whereClause.price, lte: criteria.maxPrice };
      }

      if (criteria.productTypes && criteria.productTypes.length > 0) {
        whereClause.productType = { in: criteria.productTypes };
      }

      const products = await prisma.productCache.findMany({
        where: whereClause,
        orderBy: { price: 'asc' },
        take: 50
      });

      // Filter by tags if specified
      let filteredProducts = products;
      if (criteria.tags && criteria.tags.length > 0) {
        filteredProducts = products.filter(product => {
          try {
            const productTags = JSON.parse(product.tags || '[]');
            return criteria.tags.some(tag => 
              productTags.some(pTag => pTag.toLowerCase().includes(tag.toLowerCase()))
            );
          } catch (e) {
            return false;
          }
        });
      }

      return filteredProducts.map(p => ({
        ...p,
        tags: JSON.parse(p.tags || '[]'),
        variants: JSON.parse(p.variants || '[]'),
        images: JSON.parse(p.images || '[]')
      }));

    } catch (error) {
      console.error('Error getting product recommendations:', error);
      throw error;
    }
  }

  // Validate mystery box configuration
  static validateConfiguration(config) {
    const errors = [];

    if (!config.name || config.name.trim().length === 0) {
      errors.push('Name is required');
    }

    if (config.minValue === undefined || config.minValue < 0) {
      errors.push('Minimum value must be 0 or greater');
    }

    if (config.maxValue === undefined || config.maxValue <= 0) {
      errors.push('Maximum value must be greater than 0');
    }

    if (config.minValue !== undefined && config.maxValue !== undefined && config.minValue > config.maxValue) {
      errors.push('Minimum value cannot be greater than maximum value');
    }

    if (config.minItems === undefined || config.minItems < 1) {
      errors.push('Minimum items must be 1 or greater');
    }

    if (config.maxItems === undefined || config.maxItems < 1) {
      errors.push('Maximum items must be 1 or greater');
    }

    if (config.minItems !== undefined && config.maxItems !== undefined && config.minItems > config.maxItems) {
      errors.push('Minimum items cannot be greater than maximum items');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Get mystery box statistics
  static async getStatistics(shop, mysteryBoxId) {
    try {
      const instances = await prisma.boxInstance.findMany({
        where: { 
          mysteryBoxId: parseInt(mysteryBoxId),
          mysteryBox: { shop: { shopDomain: shop } }
        }
      });

      if (instances.length === 0) {
        return {
          totalGenerated: 0,
          averageValue: 0,
          averageItems: 0,
          totalValue: 0,
          valueRange: { min: 0, max: 0 },
          itemRange: { min: 0, max: 0 }
        };
      }

      const totalGenerated = instances.length;
      const totalValue = instances.reduce((sum, i) => sum + i.totalValue, 0);
      const totalItems = instances.reduce((sum, i) => sum + i.itemCount, 0);
      
      const values = instances.map(i => i.totalValue);
      const itemCounts = instances.map(i => i.itemCount);

      return {
        totalGenerated,
        averageValue: totalValue / totalGenerated,
        averageItems: totalItems / totalGenerated,
        totalValue,
        valueRange: {
          min: Math.min(...values),
          max: Math.max(...values)
        },
        itemRange: {
          min: Math.min(...itemCounts),
          max: Math.max(...itemCounts)
        }
      };

    } catch (error) {
      console.error('Error getting mystery box statistics:', error);
      throw error;
    }
  }
}

module.exports = MysteryBoxService;