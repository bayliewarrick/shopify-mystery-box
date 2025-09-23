import axios, { AxiosInstance, AxiosResponse } from 'axios';

export interface MysteryBox {
  id: string;
  name: string;
  description?: string;
  minValue: number;
  maxValue: number;
  minItems: number;
  maxItems: number;
  includeTags: string[];
  excludeTags: string[];
  isActive: boolean;
  isAutomatic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BoxInstance {
  id: string;
  totalValue: number;
  itemCount: number;
  status: 'DRAFT' | 'GENERATED' | 'PUBLISHED' | 'SOLD';
  selectedProducts: any[];
  createdAt: string;
  updatedAt: string;
  mysteryBoxId: string;
}

export interface Product {
  id: string;
  productId: string;
  title: string;
  handle: string;
  tags: string[];
  price: number;
  compareAtPrice?: number;
  inventory: number;
  available: boolean;
  lastSynced: string;
}

export interface InventoryStats {
  totalProducts: number;
  availableProducts: number;
  totalValue: number;
  lastSyncedAt?: string;
  syncStatus: string;
}

export class ApiService {
  private client: AxiosInstance;
  private currentShop: string | null = null;
  private shopPromise: Promise<string> | null = null;

  constructor(baseURL?: string) {
    // Automatically detect API base URL
    if (!baseURL) {
      if (process.env.NODE_ENV === 'production') {
        // In production, API is served from the same domain
        baseURL = window.location.origin + '/api';
      } else {
        // In development, API runs on port 3000
        baseURL = 'http://localhost:3000/api';
      }
    }

    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for debugging and dynamic headers
    this.client.interceptors.request.use(
      async (config) => {
        // Get shop domain for this request
        const currentShop = await this.getShopDomain();
        config.headers['X-Shopify-Shop-Domain'] = currentShop;
        
        console.log('API Request:', config.method?.toUpperCase(), config.url);
        console.log('🏪 Request shop domain:', currentShop);
        return config;
      },
      (error) => {
        console.error('Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  private async getShopDomain(): Promise<string> {
    // If we already have a shop cached, return it
    if (this.currentShop) {
      return this.currentShop;
    }

    // If there's already a request in progress, wait for it
    if (this.shopPromise) {
      return this.shopPromise;
    }

    // Start a new request to get the current shop
    this.shopPromise = this.fetchCurrentShop();
    this.currentShop = await this.shopPromise;
    this.shopPromise = null;

    return this.currentShop;
  }

  private async fetchCurrentShop(): Promise<string> {
    try {
      // First check URL parameter (for OAuth redirects)
      const urlShop = new URLSearchParams(window.location.search).get('shop');
      if (urlShop) {
        console.log('🔗 Using shop from URL parameter:', urlShop);
        return urlShop;
      }

      // Always try server first (authoritative source)
      console.log('🌐 Fetching current shop from server...');
      const serverUrl = this.client.defaults.baseURL + '/auth/current-shop';
      console.log('🔗 Server URL:', serverUrl);
      
      const response = await fetch(serverUrl);
      console.log('📡 Server response status:', response.status);
      
      const data = await response.json();
      console.log('📊 Server response data:', data);

      if (data.authenticated && data.shop) {
        console.log('✅ Got authenticated shop from server:', data.shop);
        // Cache it in localStorage for faster subsequent loads
        localStorage.setItem('shopDomain', data.shop);
        return data.shop;
      }

      // Fallback to localStorage only if server has no authenticated shop
      const storedShop = localStorage.getItem('shopDomain');
      if (storedShop && storedShop !== 'pack-peddlers-demo.myshopify.com') {
        console.log('📱 Using shop from localStorage as fallback:', storedShop);
        return storedShop;
      }

      console.log('⚠️ No authenticated shop found, using demo shop');
      return 'pack-peddlers-demo.myshopify.com';

    } catch (error) {
      console.error('❌ Error fetching current shop:', error);
      // Final fallback to localStorage or demo
      const fallback = localStorage.getItem('shopDomain') || 'pack-peddlers-demo.myshopify.com';
      console.log('🔄 Using fallback shop:', fallback);
      return fallback;
    }
  }

  // Public method to refresh shop domain (useful after OAuth)
  async refreshShopDomain(): Promise<string> {
    this.currentShop = null;
    this.shopPromise = null;
    // Clear localStorage to force server fetch
    localStorage.removeItem('shopDomain');
    return this.getShopDomain();
  }

  // Public method to get current shop (for UI display)
  async getCurrentShop(): Promise<string> {
    return this.getShopDomain();
  }

  // Mystery Box endpoints
  async getMysteryBoxes(): Promise<MysteryBox[]> {
    const shop = await this.getShopDomain();
    const response: AxiosResponse<{ mysteryBoxes: MysteryBox[] }> = await this.client.get(`/mystery-boxes?shop=${shop}`);
    return response.data.mysteryBoxes;
  }

  async getMysteryBox(id: string): Promise<MysteryBox> {
    const shop = await this.getShopDomain();
    const response: AxiosResponse<{ mysteryBox: MysteryBox }> = await this.client.get(`/mystery-boxes/${id}?shop=${shop}`);
    return response.data.mysteryBox;
  }

  async createMysteryBox(data: Partial<MysteryBox>): Promise<MysteryBox> {
    const shopDomain = await this.getShopDomain();
    console.log('Creating mystery box with shop:', shopDomain);
    console.log('Data being sent:', data);
    
    const response: AxiosResponse<{ mysteryBox: MysteryBox }> = await this.client.post(
      `/mystery-boxes?shop=${encodeURIComponent(shopDomain)}`, 
      data
    );
    return response.data.mysteryBox;
  }

  async updateMysteryBox(id: string, data: Partial<MysteryBox>): Promise<MysteryBox> {
    const response: AxiosResponse<{ mysteryBox: MysteryBox }> = await this.client.put(`/mystery-boxes/${id}`, data);
    return response.data.mysteryBox;
  }

  async deleteMysteryBox(id: string): Promise<void> {
    await this.client.delete(`/mystery-boxes/${id}`);
  }

  async generateBoxInstance(mysteryBoxId: string): Promise<BoxInstance> {
    const shop = await this.getShopDomain();
    const response: AxiosResponse<{ instance: BoxInstance }> = await this.client.post(`/mystery-boxes/${mysteryBoxId}/generate?shop=${shop}`);
    return response.data.instance;
  }

  async getBoxInstances(mysteryBoxId: string): Promise<BoxInstance[]> {
    const response: AxiosResponse<{ instances: BoxInstance[] }> = await this.client.get(`/mystery-boxes/${mysteryBoxId}/instances`);
    return response.data.instances;
  }

  // Inventory endpoints
  async getProducts(params?: {
    tags?: string;
    available?: boolean;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ products: Product[]; pagination: any }> {
    const response = await this.client.get('/inventory/products', { params });
    return response.data;
  }

  async syncInventory(): Promise<{ message: string; syncedProducts: number; syncedAt: string }> {
    const response = await this.client.post('/inventory/sync');
    return response.data;
  }

  async syncFromLiveStore(): Promise<{ success: boolean; message: string; syncedCount: number }> {
    const shop = await this.getShopDomain();
    console.log('🔄 syncFromLiveStore called');
    console.log('🏪 Shop from getShopDomain():', shop);
    console.log('📱 Current localStorage:', localStorage.getItem('shopDomain'));
    console.log('🌐 Current URL params:', new URLSearchParams(window.location.search).get('shop'));
    
    const fullUrl = `/inventory/sync?shop=${shop}`;
    console.log('📡 Full sync URL:', fullUrl);
    
    const response = await this.client.post(fullUrl, {});
    return response.data;
  }

  async getInventoryStats(): Promise<InventoryStats> {
    const response: AxiosResponse<{ stats: InventoryStats }> = await this.client.get('/inventory/stats');
    return response.data.stats;
  }

  async getTags(): Promise<string[]> {
    const response: AxiosResponse<{ tags: string[] }> = await this.client.get('/inventory/tags');
    return response.data.tags;
  }

  // Auth endpoints
  async verifyAuth(): Promise<{ authenticated: boolean; shop?: string; installedAt?: string }> {
    const response = await this.client.get('/auth/verify');
    return response.data;
  }
}