import React from 'react';
import { Frame, Navigation } from '@shopify/polaris';
import { useLocation, useNavigate } from 'react-router-dom';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const navigationMarkup = (
    <Navigation location={location.pathname}>
      <Navigation.Section
        items={[
          {
            url: '/dashboard',
            label: 'Dashboard',
            selected: location.pathname === '/' || location.pathname === '/dashboard',
            onClick: () => navigate('/dashboard')
          },
          {
            url: '/mystery-boxes',
            label: 'Mystery Boxes',
            selected: location.pathname.startsWith('/mystery-boxes'),
            onClick: () => navigate('/mystery-boxes')
          },
          {
            url: '/inventory',
            label: 'Inventory',
            selected: location.pathname === '/inventory',
            onClick: () => navigate('/inventory')
          }
        ]}
      />
      <Navigation.Section
        title="Analytics"
        items={[
          {
            url: '/analytics',
            label: 'Reports',
            selected: location.pathname === '/analytics',
            onClick: () => navigate('/analytics')
          }
        ]}
      />
      <Navigation.Section
        title="Settings"
        items={[
          {
            url: '/settings',
            label: 'App Settings',
            selected: location.pathname === '/settings',
            onClick: () => navigate('/settings')
          }
        ]}
      />
    </Navigation>
  );

  return (
    <Frame navigation={navigationMarkup}>
      {children}
    </Frame>
  );
}