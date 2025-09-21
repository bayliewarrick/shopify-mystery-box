# Shopify Mystery Box App - Setup Guide

## Overview
This application allows Pack Peddlers to create mystery boxes from existing Shopify inventory with value parameters, item quantity limits, and tag-based filtering for automated bundling.

## Prerequisites
- Node.js (>=16.0.0)
- npm (>=8.0.0)
- Shopify Partner Account
- ngrok (for local development)

## Project Structure
```
shopify-mystery-box/
├── client/           # React frontend with Shopify Polaris UI
├── server/           # Express.js backend API
├── prisma/           # Database schema and migrations
├── package.json      # Root dependencies and scripts
└── .env             # Environment configuration
```

## 1. Initial Setup

### Clone and Install Dependencies
```bash
cd shopify-mystery-box
npm install
cd client && npm install
```

### Database Setup
```bash
# Generate Prisma client
npx prisma generate

# Initialize database
npx prisma db push

# (Optional) Open Prisma Studio to view data
npx prisma studio
```

## 2. Shopify Partner Setup

### Create Shopify Partner Account
1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Sign up for a Partner account
3. Complete the verification process

### Create a New App
1. In Partner Dashboard, click "Apps" → "Create app"
2. Choose "Public app" (for production) or "Custom app" (for development)
3. Fill in app details:
   - **App name**: "Pack Peddlers Mystery Box"
   - **App URL**: `https://your-domain.com` (or ngrok URL for dev)
   - **Allowed redirection URL(s)**: `https://your-domain.com/api/auth/shopify/callback`

### App Configuration
1. Navigate to "App setup" in your app dashboard
2. Note down your **API key** and **API secret key**
3. Set the following scopes in "App setup" → "App configuration":
   ```
   read_products
   write_products
   read_inventory
   write_inventory
   read_orders
   write_orders
   ```

## 3. Environment Configuration

### Update .env File
```env
# Shopify App Credentials (from Partner Dashboard)
SHOPIFY_API_KEY=your_shopify_api_key_here
SHOPIFY_API_SECRET=your_shopify_api_secret_here
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret_here

# App URLs
APP_URL=https://your-ngrok-url.ngrok.io  # For development
FRONTEND_URL=http://localhost:3001

# Database
DATABASE_URL="file:./dev.db"

# Server Configuration
PORT=3000
NODE_ENV=development
```

### For Local Development with ngrok:
1. Install ngrok: [ngrok.com/download](https://ngrok.com/download)
2. Start your server: `npm run server`
3. In another terminal: `ngrok http 3000`
4. Copy the HTTPS ngrok URL (e.g., `https://abc123.ngrok.io`)
5. Update `APP_URL` in `.env` with your ngrok URL
6. Update your Shopify app's "App URL" and "Allowed redirection URL(s)" with the ngrok URL

## 4. Running the Application

### Development Mode
```bash
# Start both server and client concurrently
npm run dev

# Or start them separately:
# Terminal 1 - Backend server
npm run server

# Terminal 2 - Frontend client
npm run client
```

### Production Mode
```bash
# Build the client
npm run build

# Start the server
npm start
```

## 5. App Installation Process

### Install App on Development Store
1. Create a development store in your Partner Dashboard
2. Navigate to: `https://your-ngrok-url.ngrok.io/api/auth/shopify/install?shop=your-dev-store.myshopify.com`
3. Complete the OAuth flow
4. The app should redirect to the frontend with success confirmation

### App Flow
1. **Installation**: Shop owner installs app via App URL
2. **OAuth**: Shopify redirects to your callback URL with authorization code
3. **Token Exchange**: Your app exchanges code for access token
4. **Shop Setup**: App stores shop data and access token in database
5. **Product Sync**: App syncs shop's products to local cache
6. **Mystery Box Creation**: Shop owner can create mystery box configurations
7. **Box Generation**: App generates mystery boxes based on inventory and criteria

## 6. Core Features

### Mystery Box Configuration
- **Value Range**: Set minimum and maximum value (e.g., $10-$50)
- **Item Count**: Set minimum and maximum items (e.g., 3-8 items)
- **Tag Filtering**: Include/exclude products by tags
- **Product Type Filtering**: Include/exclude by product type
- **Vendor Filtering**: Include/exclude by vendor

### Product Sync
- Automatic webhook-based updates when products change
- Manual sync option in the app interface
- Cached product data for fast mystery box generation

### Mystery Box Generation Algorithm
- Smart product selection to meet value and quantity requirements
- Randomization for variety
- Inventory awareness (only in-stock products)
- Fallback algorithms for edge cases

## 7. API Endpoints

### Authentication
- `GET /api/auth/shopify/install` - Initiate OAuth flow
- `GET /api/auth/shopify/callback` - OAuth callback
- `GET /api/auth/verify` - Verify shop authentication

### Mystery Boxes
- `GET /api/mystery-boxes` - List all mystery boxes
- `POST /api/mystery-boxes` - Create new mystery box
- `PUT /api/mystery-boxes/:id` - Update mystery box
- `DELETE /api/mystery-boxes/:id` - Delete mystery box
- `POST /api/mystery-boxes/:id/generate` - Generate mystery box instance

### Inventory
- `GET /api/inventory/products` - List cached products
- `POST /api/inventory/sync` - Sync products from Shopify
- `GET /api/inventory/stats` - Get inventory statistics

### Webhooks
- `POST /api/webhooks/products/create` - Product created
- `POST /api/webhooks/products/update` - Product updated
- `POST /api/webhooks/products/delete` - Product deleted
- `POST /api/webhooks/app/uninstalled` - App uninstalled

## 8. Database Schema

### Tables
- **shops**: Shopify store information and access tokens
- **mystery_boxes**: Mystery box configurations
- **box_instances**: Generated mystery box instances
- **product_cache**: Cached Shopify product data

## 9. Troubleshooting

### Common Issues

**Server won't start**
- Check that all dependencies are installed: `npm install`
- Verify Prisma client is generated: `npx prisma generate`
- Check database is created: `npx prisma db push`

**OAuth errors**
- Verify SHOPIFY_API_KEY and SHOPIFY_API_SECRET in .env
- Check that APP_URL matches your ngrok URL exactly
- Ensure redirection URLs are correct in Shopify Partner Dashboard

**Product sync issues**
- Verify shop has products in inventory
- Check that access token has required scopes
- Test with manual sync via `/api/inventory/sync`

**Mystery box generation fails**
- Check that products match the filter criteria
- Verify products have inventory quantity > 0
- Ensure value range is realistic for available products

### Development Tips

1. **Use ngrok for testing**: It provides stable HTTPS URLs for Shopify webhooks
2. **Monitor logs**: Check both server console and browser network tab
3. **Test with real data**: Create products in your development store
4. **Webhook testing**: Use ngrok's web interface to inspect webhook payloads
5. **Database inspection**: Use `npx prisma studio` to view database content

## 10. Deployment

### Production Deployment
1. Deploy to a hosting service (Heroku, DigitalOcean, AWS, etc.)
2. Set up a production database (PostgreSQL recommended)
3. Update environment variables for production
4. Update Shopify app URLs to production domain
5. Submit app for review if making it public

### Environment Variables for Production
```env
SHOPIFY_API_KEY=your_production_api_key
SHOPIFY_API_SECRET=your_production_api_secret
SHOPIFY_WEBHOOK_SECRET=your_production_webhook_secret
APP_URL=https://your-production-domain.com
FRONTEND_URL=https://your-production-domain.com
DATABASE_URL=postgresql://user:password@host:port/database
PORT=3000
NODE_ENV=production
```

## Support
For issues or questions about this mystery box app, check the logs and refer to the Shopify App development documentation at [shopify.dev](https://shopify.dev).

---

## Quick Start Checklist
- [ ] Shopify Partner account created
- [ ] App created in Partner Dashboard
- [ ] API credentials added to .env
- [ ] Dependencies installed (`npm install`)
- [ ] Database initialized (`npx prisma db push`)
- [ ] ngrok running for local development
- [ ] App URL updated in Shopify Partner Dashboard
- [ ] Server started (`npm run server`)
- [ ] Client started (`npm run client`)
- [ ] App installed on development store
- [ ] Products synced and mystery boxes created