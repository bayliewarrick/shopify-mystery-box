import React, { useState, useEffect, useCallback } from 'react';
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  Button,
  EmptyState,
  Spinner,
  Frame,
  Navigation,
  TopBar
} from '@shopify/polaris';
import {
  HomeIcon,
  ProductIcon,
  InventoryIcon,
  PlusIcon
} from '@shopify/polaris-icons';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../contexts/ApiContext';
import { InventoryStats } from '../services/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const api = useApi();
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileNavigationActive, setMobileNavigationActive] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const inventoryStats = await api.getInventoryStats();
      setStats(inventoryStats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    // Handle OAuth redirect
    const urlParams = new URLSearchParams(window.location.search);
    const shop = urlParams.get('shop');
    const installed = urlParams.get('installed');
    
    if (shop && installed === 'true') {
      console.log('🎉 OAuth completed for shop:', shop);
      // Save shop to localStorage
      localStorage.setItem('shopDomain', shop);
      console.log('💾 Saved shop to localStorage:', shop);
      
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Show success message or redirect to inventory
      console.log('✅ Shop setup complete! Ready to sync products.');
    }
    
    loadStats();
  }, [loadStats]);

  const toggleMobileNavigationActive = () =>
    setMobileNavigationActive((mobileNavigationActive) => !mobileNavigationActive);

  const navigationMarkup = (
    <Navigation location="/">
      <Navigation.Section
        items={[
          {
            url: '/',
            label: 'Dashboard',
            icon: HomeIcon,
            selected: true,
          },
          {
            url: '/mystery-boxes',
            label: 'Mystery Boxes',
            icon: ProductIcon,
          },
          {
            url: '/inventory',
            label: 'Inventory',
            icon: InventoryIcon,
          },
        ]}
        action={{
          icon: PlusIcon,
          accessibilityLabel: 'Create mystery box',
          onClick: () => navigate('/mystery-boxes/new'),
        }}
      />
    </Navigation>
  );

  const topBarMarkup = (
    <TopBar
      showNavigationToggle
      onNavigationToggle={toggleMobileNavigationActive}
    />
  );

  const loadingMarkup = loading ? (
    <Card>
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <Spinner accessibilityLabel="Loading stats" size="large" />
      </div>
    </Card>
  ) : null;

  const statsMarkup = stats && !loading ? (
    <Layout>
      <Layout.Section>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          <Card>
            <div style={{ padding: '1rem' }}>
              <Text variant="headingMd" as="h3">Total Products</Text>
              <Text variant="headingLg" as="p">{stats.totalProducts}</Text>
              <Badge tone={stats.totalProducts > 0 ? 'success' : 'critical'}>
                {stats.totalProducts > 0 ? 'Active' : 'No Products'}
              </Badge>
            </div>
          </Card>

          <Card>
            <div style={{ padding: '1rem' }}>
              <Text variant="headingMd" as="h3">Available Products</Text>
              <Text variant="headingLg" as="p">{stats.availableProducts}</Text>
              <Badge tone={stats.availableProducts > 0 ? 'success' : 'warning'}>
                {stats.availableProducts > 0 ? 'In Stock' : 'Out of Stock'}
              </Badge>
            </div>
          </Card>

          <Card>
            <div style={{ padding: '1rem' }}>
              <Text variant="headingMd" as="h3">Total Inventory Value</Text>
              <Text variant="headingLg" as="p">${stats.totalValue.toFixed(2)}</Text>
              <Badge tone="info">Current Value</Badge>
            </div>
          </Card>

          <Card>
            <div style={{ padding: '1rem' }}>
              <Text variant="headingMd" as="h3">Last Sync</Text>
              <Text variant="bodyMd" as="p">
                {stats.lastSyncedAt 
                  ? new Date(stats.lastSyncedAt).toLocaleString()
                  : 'Never'
                }
              </Text>
              <Badge tone={stats.syncStatus === 'synced' ? 'success' : 'critical'}>
                {stats.syncStatus === 'synced' ? 'Synced' : 'Needs Sync'}
              </Badge>
            </div>
          </Card>
        </div>
      </Layout.Section>

      <Layout.Section>
        <Card>
          <div style={{ padding: '1rem' }}>
            <Text variant="headingMd" as="h3">Quick Actions</Text>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <Button variant="primary" onClick={() => navigate('/mystery-boxes/new')}>
                Create Mystery Box
              </Button>
              <Button onClick={() => navigate('/mystery-boxes')}>
                View All Mystery Boxes
              </Button>
              <Button onClick={() => navigate('/inventory')}>
                Manage Inventory
              </Button>
            </div>
          </div>
        </Card>
      </Layout.Section>
    </Layout>
  ) : null;

  const emptyStateMarkup = !loading && !stats ? (
    <EmptyState
      heading="Failed to load dashboard"
      action={{
        content: 'Retry',
        onAction: loadStats,
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>There was an error loading your dashboard data.</p>
    </EmptyState>
  ) : null;

  return (
    <Frame
      topBar={topBarMarkup}
      navigation={navigationMarkup}
      showMobileNavigation={mobileNavigationActive}
      onNavigationDismiss={toggleMobileNavigationActive}
    >
      <Page 
        title="Pack Peddlers Mystery Box Dashboard"
        subtitle="Manage your mystery boxes and inventory"
      >
        {loadingMarkup}
        {statsMarkup}
        {emptyStateMarkup}
      </Page>
    </Frame>
  );
}