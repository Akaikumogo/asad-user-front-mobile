import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  User,
  Device,
  LoginCredentials,
  RegisterCredentials,
  AuthResponse
} from '@/types';
import { storage } from './storage';

/**
 * Static backend base URL (previously coming from `.env`).
 * IMPORTANT: keep `api/v1` here because all endpoints below are relative to it.
 */
const API_BASE_URL = 'https://asadbek.akaikumogo.uz/api/v1';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config) => {
        const authData = await storage.get<{ token: string }>('auth');
        if (authData?.token) {
          config.headers.Authorization = `Bearer ${authData.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          await storage.remove('auth');
          await storage.remove('user');
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { data } = await this.client.post<AuthResponse>(
      '/auth/login',
      credentials
    );
    return data;
  }

  async register(
    credentials: RegisterCredentials
  ): Promise<{ message: string; userId: string }> {
    const { data } = await this.client.post<{
      message: string;
      userId: string;
    }>('/auth/register-client', credentials);
    return data;
  }

  async getCurrentUser(): Promise<User> {
    const { data } = await this.client.get<User>('/auth/me');
    return data;
  }

  async updatePreferences(language: 'uz' | 'en' | 'ru'): Promise<User> {
    const { data } = await this.client.patch<User>('/auth/preferences', {
      language
    });
    return data;
  }

  // Devices
  async getDevices(): Promise<Device[]> {
    const { data } = await this.client.get<Device[]>('/devices');
    return data;
  }

  async getDevice(id: string): Promise<Device> {
    const { data } = await this.client.get<Device>(`/devices/${id}`);
    return data;
  }

  async getUserDevices(): Promise<Device[]> {
    const user = await storage.get<User>('user');
    if (!user?._id) {
      throw new Error('User not found');
    }
    const { data } = await this.client.get<Device[]>(
      `/devices/user/${user._id}`
    );
    return data;
  }

  async createDevice(deviceData: {
    name: string;
    location?: string;
    status?: 'ONLINE' | 'OFFLINE';
    powerUsage?: number;
    userIds?: string[];
  }): Promise<Device> {
    const { data } = await this.client.post<Device>('/devices', deviceData);
    return data;
  }

  async assignUsers(deviceId: string, userIds: string[]): Promise<Device> {
    const { data } = await this.client.post<Device>(
      `/devices/${deviceId}/assign-users`,
      { userIds }
    );
    return data;
  }

  async getUsers(): Promise<User[]> {
    const { data } = await this.client.get<User[]>('/users');
    return data;
  }

  async sendDeviceCommand(
    deviceId: string,
    command: {
      motor?: 'ON' | 'OFF';
      height?: number;
      timer?: number;
      switchMotor?: boolean;
      ultrasonic?: boolean;
    }
  ): Promise<Device> {
    const { data } = await this.client.post<{ device: Device }>(
      `/devices/${deviceId}/command`,
      command
    );
    return data.device;
  }

  // Reports
  async getDailyReport(date?: string) {
    const params = date ? { date } : {};
    const { data } = await this.client.get('/reports/daily', { params });
    return data;
  }

  async getWeeklyReport(weekStart?: string) {
    const params = weekStart ? { weekStart } : {};
    const { data } = await this.client.get('/reports/weekly', { params });
    return data;
  }

  async getMonthlyReport(month?: string) {
    const params = month ? { month } : {};
    const { data } = await this.client.get('/reports/monthly', { params });
    return data;
  }

  async getYearlyReport(year?: string) {
    const params = year ? { year } : {};
    const { data } = await this.client.get('/reports/yearly', { params });
    return data;
  }
}

export const api = new ApiClient();
