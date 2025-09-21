import React, { createContext, useContext, useRef } from 'react';
import { ApiService } from '../services/api';

interface ApiContextType {
  api: ApiService;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

interface ApiProviderProps {
  children: React.ReactNode;
}

export function ApiProvider({ children }: ApiProviderProps) {
  const apiRef = useRef(new ApiService());

  return (
    <ApiContext.Provider value={{ api: apiRef.current }}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApi() {
  const context = useContext(ApiContext);
  if (context === undefined) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context.api;
}