# Shopify Integration Guide

## Current State
Your app currently has a **demo mode** with mock Shopify data. To integrate with real Shopify stores, you need to implement several components:

## 1. Shopify App Setup

### Create a Shopify App
1. Go to [Shopify Partners](https://partners.shopify.com/)
2. Create a new app
3. Get your API credentials:
   - `SHOPIFY_API_KEY`
   - `SHOPIFY_API_SECRET`
   - `SHOPIFY_SCOPES` (required permissions)

### Required Scopes
```
read_products,write_products,read_inventory,write_inventory,read_orders,write_orders
```

## 2. Authentication Flow

### OAuth Implementation
```javascript
// Add to server/routes/auth.js
app.get('/auth', (req, res) => {
  const shop = req.query.shop;
  const scopes = 'read_products,write_products,read_inventory,write_inventory,read_orders,write_orders';
  const redirectUri = `${process.env.HOST}/auth/callback`;
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${redirectUri}`;
  
  res.redirect(installUrl);
});

app.get('/auth/callback', async (req, res) => {
  const { shop, code } = req.query;
  
  // Exchange code for access token
  const accessToken = await exchangeCodeForToken(shop, code);
  
  // Store token in database
  await storeShopToken(shop, accessToken);
  
  res.redirect(`/?shop=${shop}`);
});
```

## 3. Real Shopify API Integration

### Update shopifyService.js
```javascript
const axios = require('axios');

class ShopifyService {
  constructor(shop, accessToken) {
    this.shop = shop;
    this.accessToken = accessToken;
    this.baseURL = `https://${shop}/admin/api/2023-10/`;
  }

  async getProducts(limit = 250) {
    const response = await axios.get(`${this.baseURL}products.json`, {
      headers: { 'X-Shopify-Access-Token': this.accessToken },
      params: { limit, status: 'active' }
    });
    return response.data.products;
  }

  async createProduct(productData) {
    const response = await axios.post(`${this.baseURL}products.json`, {
      product: productData
    }, {
      headers: { 'X-Shopify-Access-Token': this.accessToken }
    });
    return response.data.product;
  }

  async updateInventory(variantId, quantity) {
    // Use Inventory API to update stock levels
    const response = await axios.post(`${this.baseURL}inventory_levels/set.json`, {
      location_id: await this.getPrimaryLocationId(),
      inventory_item_id: variantId,
      available: quantity
    }, {
      headers: { 'X-Shopify-Access-Token': this.accessToken }
    });
    return response.data;
  }
}
```

## 4. Automatic Mystery Box Generation

### How It Works
1. **Inventory Sync**: App regularly syncs your Shopify products
2. **Algorithm Selection**: Uses smart algorithm to select products based on:
   - Value range (min/max price)
   - Item count (min/max items)
   - Product tags (include/exclude)
   - Product types (include/exclude)
   - Inventory levels (only in-stock items)

3. **Bundle Creation**: 
   - Creates a new Shopify product for the mystery box
   - Sets appropriate pricing
   - Manages inventory automatically

### Enhanced Algorithm Features
- **Weighted Selection**: Prioritizes slow-moving inventory
- **Seasonal Preferences**: Considers product seasonality
- **Profit Optimization**: Balances customer value with profit margins
- **Inventory Management**: Reduces overstocked items

## 5. Shopify Integration Steps

### Step 1: Environment Setup
```bash
# Add to .env
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_SCOPES=read_products,write_products,read_inventory,write_inventory,read_orders,write_orders
HOST=https://your-app-domain.com
```

### Step 2: Install Dependencies
```bash
npm install @shopify/shopify-api dotenv
```

### Step 3: Create App in Shopify Partner Dashboard
- Set up app URLs
- Configure webhooks for inventory updates

### Step 4: Deploy and Test
- Deploy to production (Heroku, Railway, etc.)
- Install on test store
- Configure mystery box rules

## 6. Production Features

### Automatic Inventory Management
- Real-time inventory tracking
- Automatic stock level updates
- Low-stock alerts

### Customer Experience
- Mystery box product pages
- Preview value ranges
- Surprise reveal experience

### Analytics & Insights
- Sales performance tracking
- Customer satisfaction metrics
- Inventory optimization reports

## 7. Next Steps

1. **Set up Shopify Partner account**
2. **Implement OAuth authentication**
3. **Replace demo service with real Shopify API**
4. **Test with development store**
5. **Deploy to production**
6. **Submit for Shopify App Store review**

Would you like me to help implement any of these components?