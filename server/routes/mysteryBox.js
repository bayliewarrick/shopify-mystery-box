const express = require('express');
const { PrismaClient } = require('@prisma/client');
const mysteryBoxService = require('../services/mysteryBoxService');

const router = express.Router();
const prisma = new PrismaClient();

// Get all mystery boxes for a shop
router.get('/', async (req, res) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    const mysteryBoxes = await prisma.mysteryBox.findMany({
      where: { shop: { shopDomain: shop } },
      include: {
        instances: {
          select: {
            id: true,
            generatedAt: true,
            totalValue: true,
            itemCount: true
          },
          orderBy: { generatedAt: 'desc' },
          take: 5 // Get last 5 instances for preview
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ mysteryBoxes });
  } catch (error) {
    console.error('Error fetching mystery boxes:', error);
    res.status(500).json({ error: 'Failed to fetch mystery boxes' });
  }
});

// Get a specific mystery box
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    const mysteryBox = await prisma.mysteryBox.findFirst({
      where: { 
        id: parseInt(id),
        shop: { shopDomain: shop }
      },
      include: {
        instances: {
          orderBy: { generatedAt: 'desc' },
          take: 10
        }
      }
    });

    if (!mysteryBox) {
      return res.status(404).json({ error: 'Mystery box not found' });
    }

    res.json({ mysteryBox });
  } catch (error) {
    console.error('Error fetching mystery box:', error);
    res.status(500).json({ error: 'Failed to fetch mystery box' });
  }
});

// Create a new mystery box
router.post('/', async (req, res) => {
  try {
    console.log('🚀 Creating mystery box...');
    console.log('📍 Request origin:', req.get('origin'));
    console.log('📍 Query params:', req.query);
    console.log('📍 Request body:', JSON.stringify(req.body, null, 2));
    
    const { shop } = req.query;
    const {
      name,
      description,
      minValue,
      maxValue,
      minItems,
      maxItems,
      includeTags,
      excludeTags,
      includeProductTypes,
      excludeProductTypes,
      isActive
    } = req.body;

    if (!shop) {
      console.log('❌ Missing shop parameter');
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    // Validate required fields
    if (!name || minValue === undefined || maxValue === undefined) {
      console.log('❌ Missing required fields:', { name, minValue, maxValue });
      return res.status(400).json({ 
        error: 'Name, minValue, and maxValue are required',
        received: { name, minValue, maxValue }
      });
    }

    console.log('🔍 Looking up shop:', shop);
    // Find the shop
    const shopData = await prisma.shop.findUnique({
      where: { shopDomain: shop }
    });

    if (!shopData) {
      console.log('❌ Shop not found:', shop);
      
      // Let's also check what shops exist
      const allShops = await prisma.shop.findMany({
        select: { shopDomain: true, id: true }
      });
      console.log('📋 Available shops:', allShops);
      
      return res.status(404).json({ 
        error: 'Shop not found',
        shop: shop,
        availableShops: allShops.map(s => s.shopDomain)
      });
    }

    console.log('✅ Shop found:', shopData);

    // Validate data types and ranges
    const parsedMinValue = parseFloat(minValue);
    const parsedMaxValue = parseFloat(maxValue);
    const parsedMinItems = parseInt(minItems) || 1;
    const parsedMaxItems = parseInt(maxItems) || 10;

    if (isNaN(parsedMinValue) || isNaN(parsedMaxValue)) {
      console.log('❌ Invalid value ranges:', { minValue, maxValue });
      return res.status(400).json({
        error: 'minValue and maxValue must be valid numbers',
        received: { minValue, maxValue }
      });
    }

    if (parsedMinValue > parsedMaxValue) {
      console.log('❌ Invalid value range: min > max');
      return res.status(400).json({
        error: 'minValue cannot be greater than maxValue',
        received: { minValue: parsedMinValue, maxValue: parsedMaxValue }
      });
    }

    const mysteryBoxData = {
      name,
      description: description || '',
      minValue: parsedMinValue,
      maxValue: parsedMaxValue,
      minItems: parsedMinItems,
      maxItems: parsedMaxItems,
      includeTags: JSON.stringify(includeTags || []),
      excludeTags: JSON.stringify(excludeTags || []),
      includeProductTypes: JSON.stringify(includeProductTypes || []),
      excludeProductTypes: JSON.stringify(excludeProductTypes || []),
      isActive: isActive !== undefined ? isActive : true,
      shopId: shopData.id
    };

    console.log('📝 Creating mystery box with data:', mysteryBoxData);

    // Create mystery box
    const mysteryBox = await prisma.mysteryBox.create({
      data: mysteryBoxData
    });

    console.log('✅ Mystery box created successfully:', mysteryBox);
    res.status(201).json({ mysteryBox });
  } catch (error) {
    console.error('🚨 Error creating mystery box:');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack);
    
    // Check for specific Prisma errors
    if (error.code === 'P2002') {
      console.error('❌ Unique constraint violation');
      return res.status(400).json({ 
        error: 'A mystery box with this name already exists for this shop',
        details: error.message
      });
    }
    
    if (error.code === 'P2003') {
      console.error('❌ Foreign key constraint violation');
      return res.status(400).json({ 
        error: 'Invalid shop reference',
        details: error.message
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create mystery box',
      details: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    });
  }
});

// Update a mystery box
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { shop } = req.query;
    const {
      name,
      description,
      minValue,
      maxValue,
      minItems,
      maxItems,
      includeTags,
      excludeTags,
      includeProductTypes,
      excludeProductTypes,
      isActive
    } = req.body;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    // Verify mystery box exists and belongs to shop
    const existingBox = await prisma.mysteryBox.findFirst({
      where: { 
        id: parseInt(id),
        shop: { shopDomain: shop }
      }
    });

    if (!existingBox) {
      return res.status(404).json({ error: 'Mystery box not found' });
    }

    // Update mystery box
    const updatedData = {};
    if (name !== undefined) updatedData.name = name;
    if (description !== undefined) updatedData.description = description;
    if (minValue !== undefined) updatedData.minValue = parseFloat(minValue);
    if (maxValue !== undefined) updatedData.maxValue = parseFloat(maxValue);
    if (minItems !== undefined) updatedData.minItems = parseInt(minItems);
    if (maxItems !== undefined) updatedData.maxItems = parseInt(maxItems);
    if (includeTags !== undefined) updatedData.includeTags = JSON.stringify(includeTags);
    if (excludeTags !== undefined) updatedData.excludeTags = JSON.stringify(excludeTags);
    if (includeProductTypes !== undefined) updatedData.includeProductTypes = JSON.stringify(includeProductTypes);
    if (excludeProductTypes !== undefined) updatedData.excludeProductTypes = JSON.stringify(excludeProductTypes);
    if (isActive !== undefined) updatedData.isActive = isActive;

    const mysteryBox = await prisma.mysteryBox.update({
      where: { id: parseInt(id) },
      data: updatedData
    });

    res.json({ mysteryBox });
  } catch (error) {
    console.error('Error updating mystery box:', error);
    res.status(500).json({ error: 'Failed to update mystery box' });
  }
});

// Delete a mystery box
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    // Verify mystery box exists and belongs to shop
    const existingBox = await prisma.mysteryBox.findFirst({
      where: { 
        id: parseInt(id),
        shop: { shopDomain: shop }
      }
    });

    if (!existingBox) {
      return res.status(404).json({ error: 'Mystery box not found' });
    }

    // Delete mystery box (cascade will handle instances)
    await prisma.mysteryBox.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Mystery box deleted successfully' });
  } catch (error) {
    console.error('Error deleting mystery box:', error);
    res.status(500).json({ error: 'Failed to delete mystery box' });
  }
});

// Generate a mystery box instance
router.post('/:id/generate', async (req, res) => {
  try {
    const { id } = req.params;
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    // Verify mystery box exists and belongs to shop
    const mysteryBox = await prisma.mysteryBox.findFirst({
      where: { 
        id: parseInt(id),
        shop: { shopDomain: shop }
      }
    });

    if (!mysteryBox) {
      return res.status(404).json({ error: 'Mystery box not found' });
    }

    if (!mysteryBox.isActive) {
      return res.status(400).json({ error: 'Mystery box is not active' });
    }

    // Generate mystery box instance
    const instance = await mysteryBoxService.generateMysteryBox(shop, mysteryBox);

    res.json({ instance });
  } catch (error) {
    console.error('Error generating mystery box:', error);
    res.status(500).json({ error: 'Failed to generate mystery box' });
  }
});

// Get mystery box instances
router.get('/:id/instances', async (req, res) => {
  try {
    const { id } = req.params;
    const { shop, page = 1, limit = 20 } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const instances = await prisma.boxInstance.findMany({
      where: { 
        mysteryBoxId: parseInt(id),
        mysteryBox: { shop: { shopDomain: shop } }
      },
      orderBy: { generatedAt: 'desc' },
      skip,
      take: parseInt(limit)
    });

    const total = await prisma.boxInstance.count({
      where: { 
        mysteryBoxId: parseInt(id),
        mysteryBox: { shop: { shopDomain: shop } }
      }
    });

    res.json({ 
      instances,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching mystery box instances:', error);
    res.status(500).json({ error: 'Failed to fetch mystery box instances' });
  }
});

// Get a specific mystery box instance
router.get('/instances/:instanceId', async (req, res) => {
  try {
    const { instanceId } = req.params;
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    const instance = await prisma.boxInstance.findFirst({
      where: { 
        id: parseInt(instanceId),
        mysteryBox: { shop: { shopDomain: shop } }
      },
      include: {
        mysteryBox: {
          select: {
            id: true,
            name: true,
            description: true
          }
        }
      }
    });

    if (!instance) {
      return res.status(404).json({ error: 'Mystery box instance not found' });
    }

    // Parse the products JSON
    const products = JSON.parse(instance.products);

    res.json({ 
      instance: {
        ...instance,
        products
      }
    });
  } catch (error) {
    console.error('Error fetching mystery box instance:', error);
    res.status(500).json({ error: 'Failed to fetch mystery box instance' });
  }
});

module.exports = router;