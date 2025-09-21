# Live Shopify Store Integration Setup

## Step 1: Create Shopify App

### 1.1 Go to Shopify Partners
- Visit: https://partners.shopify.com/
- Create account or log in
- Click "Apps" → "Create app"

### 1.2 App Configuration
- **App name**: "Mystery Box Generator"
- **App URL**: `https://your-domain.com` (you'll need to deploy this)
- **Allowed redirection URL(s)**: `https://your-domain.com/auth/callback`

### 1.3 Get API Credentials
After creating the app, you'll get:
- **API Key** (Client ID)
- **API Secret** (Client Secret)
- **Scopes** (permissions needed)

## Step 2: Required Scopes (Permissions)

Add these scopes in your app settings:
```
read_products
write_products
read_inventory
write_inventory
read_orders
write_orders
read_product_listings
write_product_listings
```

## Step 3: Environment Setup

Create a `.env` file in your project root:
```env
# Shopify App Credentials
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
SHOPIFY_SCOPES=read_products,write_products,read_inventory,write_inventory,read_orders,write_orders

# App Configuration
HOST=https://your-deployed-app.com
PORT=3000
DATABASE_URL=your_database_url

# Development
NODE_ENV=development
```

## Step 4: Install Your App

Once deployed, install on your live store:
1. Go to your Shopify admin
2. Navigate to Apps → "Develop apps for your store" 
3. "Allow custom app development"
4. Install your app
5. Grant the requested permissions

## Step 5: Test the Connection

After installation, your app will:
1. Sync all products from your live store
2. Update inventory levels in real-time
3. Allow you to create mystery boxes with your actual products