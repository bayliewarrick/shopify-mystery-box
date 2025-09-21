# How to Sync from Your Live Shopify Store

## 🚀 Quick Setup Guide

Your mystery box app now supports syncing from live Shopify stores! Here's how to set it up:

## Option 1: Full Production Setup (Recommended)

### Step 1: Create Shopify App
1. Go to [Shopify Partners](https://partners.shopify.com/)
2. Create a new app
3. Configure these settings:
   - **App URL**: `https://your-domain.com`
   - **Allowed redirection URL**: `https://your-domain.com/auth/callback`
   - **Scopes**: `read_products,write_products,read_inventory,write_inventory,read_orders,write_orders`

### Step 2: Deploy Your App
Deploy to platforms like:
- **Heroku**: `git push heroku main`
- **Railway**: Connect your GitHub repo
- **Vercel**: Deploy with serverless functions
- **DigitalOcean**: Use App Platform

### Step 3: Environment Variables
Set these on your deployment platform:
```env
SHOPIFY_API_KEY=your_api_key_from_step_1
SHOPIFY_API_SECRET=your_api_secret_from_step_1
HOST=https://your-deployed-domain.com
DATABASE_URL=your_database_connection_string
```

### Step 4: Install on Your Store
1. Visit: `https://your-deployed-domain.com/auth/install?shop=your-store.myshopify.com`
2. Authorize the app
3. Products will sync automatically!

## Option 2: Development Testing

### For Testing with ngrok (Temporary)
1. Install ngrok: `npm install -g ngrok`
2. Expose your local server: `ngrok http 3000`
3. Use the ngrok URL in Shopify app settings
4. Test the connection with your development store

## Current Features Available

### ✅ **Demo Mode** (Current)
- 5 sample products from "Pack Peddlers Demo Store"
- Test mystery box generation
- All features work locally

### 🔄 **Live Store Integration** (Ready to Deploy)
- Real-time product sync from your Shopify store
- Automatic inventory management
- OAuth authentication
- Webhook support for real-time updates

## How the Sync Works

### Initial Sync
1. App fetches ALL products from your Shopify store
2. Stores them in local database for fast access
3. Includes: titles, prices, inventory, tags, variants

### Real-time Updates
1. Webhooks notify app of inventory changes
2. Mystery box generation uses current stock levels
3. Automatic product updates when you add/remove items

### Mystery Box Generation
1. Algorithm selects products based on your criteria
2. Considers current inventory levels
3. Creates optimized product bundles
4. Can create Shopify products for the mystery boxes

## Test the Live Sync Feature

### In Your Current App:
1. Go to **Inventory Management** page
2. Click **"Sync from Live Store"** button
3. Currently shows error (expected - no live connection yet)
4. Once deployed and connected, this will sync your real products

### Demo the Algorithm:
1. Go to **Mystery Box List**
2. Click **"Generate"** on any mystery box
3. See how the algorithm automatically selects products
4. This same algorithm will work with your live inventory

## Next Steps

1. **Deploy the app** to a public URL
2. **Create Shopify app** in Partners dashboard
3. **Configure environment variables**
4. **Install on your store**
5. **Start creating mystery boxes with your real products!**

## Benefits of Live Integration

- **Automated Inventory Management**: No manual product entry
- **Real-time Stock Levels**: Always current inventory
- **Smart Product Selection**: Algorithm optimizes bundles
- **Customer Experience**: Professional mystery box products
- **Sales Insights**: Track performance and preferences

Ready to deploy? Let me know if you need help with any of these steps!