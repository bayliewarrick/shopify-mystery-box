import React, { useState, useEffect } from 'react';
import { Page, Card, Text, DataTable, Spinner, Banner, Badge, EmptyState } from '@shopify/polaris';
import { useApi } from '../contexts/ApiContext';

interface Product {
  id: number;
  title: string;
  vendor: string;
  productType: string;
  price: number;
  compareAtPrice: number;
  inventoryQuantity: number;
  status: string;
  tags: string[];
}

export default function Inventory() {
  const api = useApi();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [liveSyncing, setLiveSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; content: string } | null>(null);
  const [currentShop, setCurrentShop] = useState<string>('');

  useEffect(() => {
    const updateShop = async () => {
      try {
        const shop = await api.getCurrentShop();
        setCurrentShop(shop);
      } catch (error) {
        console.error('Error getting current shop:', error);
        setCurrentShop('pack-peddlers-demo.myshopify.com');
      }
    };
    updateShop();
  }, [api]);

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    
    try {
      const apiBaseUrl = window.location.origin;
      const response = await fetch(`${apiBaseUrl}/api/inventory/sync-demo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setMessage({
        type: 'success',
        content: `Successfully synced ${data.totalProducts} products! (${data.created} created, ${data.updated} updated)`
      });
      
      // Refresh the products list
      await loadProducts();
    } catch (error) {
      console.error('Sync error:', error);
      setMessage({
        type: 'error',
        content: 'Failed to sync products. Make sure the server is running.'
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleLiveSync = async () => {
    setLiveSyncing(true);
    setMessage(null);
    
    try {
      const result = await api.syncFromLiveStore();
      setMessage({
        type: 'success',
        content: `Successfully synced ${result.syncedCount} products from your live Shopify store!`
      });
      
      // Refresh the products list
      await loadProducts();
    } catch (error) {
      console.error('Live sync error:', error);
      setMessage({
        type: 'error',
        content: 'Failed to sync from live store. Make sure your store is connected and authenticated.'
      });
    } finally {
      setLiveSyncing(false);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const apiBaseUrl = window.location.origin;
      const response = await fetch(`${apiBaseUrl}/api/inventory/products?shop=pack-peddlers-demo.myshopify.com&limit=50`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Load products error:', error);
      setMessage({
        type: 'error',
        content: 'Failed to load products.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const tableRows = products.map((product) => [
    product.title,
    product.vendor,
    product.productType,
    `$${product.price.toFixed(2)}`,
    product.compareAtPrice > 0 ? `$${product.compareAtPrice.toFixed(2)}` : '—',
    product.inventoryQuantity.toString(),
    <Badge tone={product.status === 'active' ? 'success' : 'critical'} key={product.id}>
      {product.status}
    </Badge>,
    product.tags.slice(0, 3).join(', ') + (product.tags.length > 3 ? '...' : '')
  ]);

  return (
    <Page 
      title={`Inventory Management - ${currentShop}`}
      subtitle={`Connected to: ${currentShop}`}
      primaryAction={{
        content: syncing ? 'Syncing Demo...' : 'Sync Demo Data',
        onAction: handleSync,
        loading: syncing,
        disabled: syncing || liveSyncing
      }}
      secondaryActions={[
        {
          content: liveSyncing ? 'Syncing Live...' : 'Sync from Live Store',
          onAction: handleLiveSync,
          loading: liveSyncing,
          disabled: syncing || liveSyncing
        }
      ]}
    >
      {message && (
        <Banner
          tone={message.type === 'success' ? 'success' : 'critical'}
          onDismiss={() => setMessage(null)}
        >
          {message.content}
        </Banner>
      )}

      <Card>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <Spinner size="large" />
            <Text variant="bodyMd" as="p">Loading products...</Text>
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            heading="No products found"
            action={{
              content: 'Sync from Shopify',
              onAction: handleSync,
            }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>Sync your products from Shopify to start creating mystery boxes.</p>
          </EmptyState>
        ) : (
          <DataTable
            columnContentTypes={[
              'text',
              'text', 
              'text',
              'numeric',
              'numeric',
              'numeric',
              'text',
              'text'
            ]}
            headings={[
              'Product Name',
              'Vendor',
              'Type',
              'Price',
              'Compare At',
              'Inventory',
              'Status',
              'Tags'
            ]}
            rows={tableRows}
          />
        )}
      </Card>
      
      {products.length > 0 && (
        <Card>
          <div style={{ padding: '1rem' }}>
            <Text variant="headingMd" as="h3">Quick Stats</Text>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <Text variant="bodyMd" as="p" tone="subdued">Total Products</Text>
                <Text variant="headingLg" as="p">{products.length}</Text>
              </div>
              <div>
                <Text variant="bodyMd" as="p" tone="subdued">Active Products</Text>
                <Text variant="headingLg" as="p">{products.filter(p => p.status === 'active').length}</Text>
              </div>
              <div>
                <Text variant="bodyMd" as="p" tone="subdued">Total Inventory</Text>
                <Text variant="headingLg" as="p">{products.reduce((sum, p) => sum + p.inventoryQuantity, 0)}</Text>
              </div>
              <div>
                <Text variant="bodyMd" as="p" tone="subdued">Avg Price</Text>
                <Text variant="headingLg" as="p">
                  ${products.length > 0 ? (products.reduce((sum, p) => sum + p.price, 0) / products.length).toFixed(2) : '0.00'}
                </Text>
              </div>
            </div>
          </div>
        </Card>
      )}
    </Page>
  );
}