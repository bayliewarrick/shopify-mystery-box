# Deployment Guide - Railway

## Step 1: Create Railway Account
1. Go to [Railway.app](https://railway.app)
2. Sign up with GitHub
3. Connect your GitHub account

## Step 2: Prepare Repository
1. Commit all changes to git:
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   ```

2. Push to GitHub:
   ```bash
   git push origin main
   ```

## Step 3: Deploy to Railway

### 3.1 Create New Project
1. Click "New Project" in Railway
2. Choose "Deploy from GitHub repo"
3. Select your repository
4. Railway will automatically detect it's a Node.js app

### 3.2 Add PostgreSQL Database
1. In your Railway project dashboard
2. Click "New Service" → "Database" → "PostgreSQL"
3. Railway will automatically create `DATABASE_URL` environment variable

### 3.3 Configure Environment Variables
Go to your app service → Variables tab and add:

```env
NODE_ENV=production
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
HOST=https://your-app-name.railway.app
```

## Step 4: Create Shopify App

### 4.1 Shopify Partners Setup
1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Create account if needed
3. Click "Apps" → "Create app" → "Public app"

### 4.2 App Configuration
- **App name**: Mystery Box Generator
- **App URL**: `https://your-app-name.railway.app`
- **Allowed redirection URL**: `https://your-app-name.railway.app/auth/callback`

### 4.3 Set Permissions
In App setup → Configuration → Protected customer data access:
- ✅ read_products
- ✅ write_products  
- ✅ read_inventory
- ✅ write_inventory
- ✅ read_orders
- ✅ write_orders

### 4.4 Get API Credentials
1. Go to "App setup" → "App credentials"
2. Copy "Client ID" → This is your `SHOPIFY_API_KEY`
3. Copy "Client secret" → This is your `SHOPIFY_API_SECRET`
4. Add these to Railway environment variables

## Step 5: Deploy and Test

### 5.1 Trigger Deployment
1. Railway auto-deploys when you push to GitHub
2. Or manually trigger in Railway dashboard
3. Wait for build to complete (2-3 minutes)

### 5.2 Run Database Migration
After first deployment:
1. Go to Railway project → App service
2. Click "Deploy Logs" tab
3. Look for any Prisma migration errors
4. If needed, run: `npm run db:migrate` in Railway console

### 5.3 Test Your App
1. Visit your Railway URL: `https://your-app-name.railway.app`
2. You should see your mystery box app
3. Test the demo functionality first

## Step 6: Connect Live Store

### 6.1 Install App on Store
Visit: `https://your-app-name.railway.app/auth/install?shop=your-store.myshopify.com`

### 6.2 Authorize Permissions
1. Shopify will ask for permissions
2. Click "Install app"
3. You'll be redirected back to your app

### 6.3 Sync Products
1. Go to "Inventory Management"
2. Click "Sync from Live Store"
3. Your real products will appear!

## Step 7: Create Mystery Boxes
1. Go to "Mystery Boxes" → "Create Mystery Box"
2. Set your parameters (price range, item count, tags)
3. Click "Generate" to test with your real inventory!

## Troubleshooting

### Common Issues:
1. **Build fails**: Check Railway logs, usually missing dependencies
2. **Database errors**: Make sure `DATABASE_URL` is set
3. **Shopify auth fails**: Check API credentials and redirect URL
4. **CORS errors**: Ensure `HOST` environment variable is correct

### Debug Steps:
1. Check Railway deployment logs
2. Test API endpoints directly
3. Verify environment variables are set
4. Check Shopify app configuration

## Production Checklist
- ✅ App deployed to Railway
- ✅ Database connected and migrated
- ✅ Environment variables configured
- ✅ Shopify app created with correct URLs
- ✅ API credentials added to Railway
- ✅ App installed on your store
- ✅ Products synced successfully
- ✅ Mystery box generation tested

## Next Steps
- Set up custom domain (optional)
- Configure webhooks for real-time inventory updates
- Add monitoring and error tracking
- Submit app to Shopify App Store (optional)