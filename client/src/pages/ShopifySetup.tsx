import React, { useState } from 'react';
import { Page, Card, FormLayout, TextField, Button, Text, Banner, List } from '@shopify/polaris';

export default function ShopifySetup() {
  const [shop, setShop] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConnect = () => {
    if (!shop) return;

    setLoading(true);
    
    // Clean shop domain - remove protocol, www, and extract just the shop name
    let cleanShop = shop.trim().toLowerCase();
    
    // Remove protocol if present
    cleanShop = cleanShop.replace(/^https?:\/\//, '');
    
    // Remove www if present
    cleanShop = cleanShop.replace(/^www\./, '');
    
    // If it already ends with .myshopify.com, keep as is
    if (cleanShop.endsWith('.myshopify.com')) {
      // Remove any path after the domain
      cleanShop = cleanShop.split('/')[0];
    } else {
      // Extract just the shop name and add .myshopify.com
      cleanShop = cleanShop.split('.')[0] + '.myshopify.com';
    }

    // Use current domain for API calls
    const apiBaseUrl = process.env.NODE_ENV === 'production' 
      ? window.location.origin 
      : 'http://localhost:3000';

    // Redirect to OAuth installation
    window.location.href = `${apiBaseUrl}/api/auth/install?shop=${cleanShop}`;
  };

  return (
    <Page title="Connect to Live Shopify Store">
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <Banner title="Important Setup Information" tone="info">
          <p>To connect to your live Shopify store, you need to:</p>
          <List type="number">
            <List.Item>Create a Shopify app in your Partner account</List.Item>
            <List.Item>Deploy this application to a public URL</List.Item>
            <List.Item>Configure environment variables</List.Item>
            <List.Item>Install the app on your store</List.Item>
          </List>
        </Banner>

        <div style={{ marginTop: '1rem' }}>
          <Card>
            <FormLayout>
              <Text variant="headingMd" as="h2">
                Connect Your Store
              </Text>
              
              <Text variant="bodyMd" as="p">
                Enter your Shopify store domain to begin the connection process.
              </Text>

              <TextField
                label="Store Domain"
                value={shop}
                onChange={setShop}
                placeholder="pack-peddlers-test-store or pack-peddlers-test-store.myshopify.com"
                helpText="Enter your store name or full .myshopify.com domain (URLs will be cleaned automatically)"
                autoComplete="off"
              />

              <Button
                variant="primary"
                loading={loading}
                onClick={handleConnect}
                disabled={!shop}
              >
                Connect to Shopify
              </Button>
            </FormLayout>
          </Card>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <Card>
            <Text variant="headingMd" as="h2">
              Required Setup Steps
            </Text>
            
            <div style={{ marginTop: '1rem' }}>
              <Text variant="headingSm" as="h3">
                1. Create Shopify App
              </Text>
              <List>
                <List.Item>Visit <a href="https://partners.shopify.com" target="_blank" rel="noopener noreferrer">Shopify Partners</a></List.Item>
                <List.Item>Create a new app</List.Item>
                <List.Item>Set App URL to your deployed domain</List.Item>
                <List.Item>Set Redirection URL to: https://your-domain.com/auth/callback</List.Item>
              </List>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <Text variant="headingSm" as="h3">
                2. Configure Environment Variables
              </Text>
              <List>
                <List.Item>SHOPIFY_API_KEY=your_api_key</List.Item>
                <List.Item>SHOPIFY_API_SECRET=your_api_secret</List.Item>
                <List.Item>HOST=https://your-deployed-domain.com</List.Item>
              </List>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <Text variant="headingSm" as="h3">
                3. Required Permissions
              </Text>
              <List>
                <List.Item>read_products</List.Item>
                <List.Item>write_products</List.Item>
                <List.Item>read_inventory</List.Item>
                <List.Item>write_inventory</List.Item>
                <List.Item>read_orders</List.Item>
                <List.Item>write_orders</List.Item>
              </List>
            </div>
          </Card>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <Banner title="Development Mode" tone="warning">
            <p>
              Currently running in development mode with demo data. 
              To connect to live stores, deploy this app and configure the Shopify app settings.
            </p>
          </Banner>
        </div>
      </div>
    </Page>
  );
}