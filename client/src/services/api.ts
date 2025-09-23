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
        'X-Shopify-Shop-Domain': this.getShopDomain(),
      },
    });

    // Request interceptor for debugging
    this.client.interceptors.request.use(
      (config) => {
        console.log('API Request:', config.method?.toUpperCase(), config.url);
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

  private getShopDomain(): string {
    // Get shop from URL parameter first
    const urlShop = new URLSearchParams(window.location.search).get('shop');
    
    if (urlShop) {
      console.log('🔗 Using shop from URL parameter:', urlShop);
      // Save to localStorage for future use
      localStorage.setItem('shopDomain', urlShop);
      return urlShop;
    }
    
    // Fallback to localStorage, then demo shop
    const storedShop = localStorage.getItem('shopDomain');
    const finalShop = storedShop || 'pack-peddlers-demo.myshopify.com';
    
    console.log('🏪 Using shop domain:', finalShop);
    console.log('📱 localStorage shop:', storedShop);
    console.log('🌐 Current URL:', window.location.href);
    
    return finalShop;
  }

  // Mystery Box endpoints
  async getMysteryBoxes(): Promise<MysteryBox[]> {
    const shop = this.getShopDomain();
    const response: AxiosResponse<{ mysteryBoxes: MysteryBox[] }> = await this.client.get(`/mystery-boxes?shop=${shop}`);
    return response.data.mysteryBoxes;
  }

  async getMysteryBox(id: string): Promise<MysteryBox> {
    const shop = this.getShopDomain();
    const response: AxiosResponse<{ mysteryBox: MysteryBox }> = await this.client.get(`/mystery-boxes/${id}?shop=${shop}`);
    return response.data.mysteryBox;
  }

  async createMysteryBox(data: Partial<MysteryBox>): Promise<MysteryBox> {
    const shopDomain = this.getShopDomain();
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
    const shop = this.getShopDomain();
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
    const shop = this.getShopDomain();
    const response = await this.client.post(`/inventory/sync?shop=${shop}`, {});
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