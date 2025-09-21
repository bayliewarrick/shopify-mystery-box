import React from 'react';
import { AppProvider } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';

interface PolarisProviderProps {
  children: React.ReactNode;
}

export function PolarisProvider({ children }: PolarisProviderProps) {
  return (
    <AppProvider
      i18n={enTranslations}
      features={{
        newDesignLanguage: true,
      }}
    >
      {children}
    </AppProvider>
  );
}