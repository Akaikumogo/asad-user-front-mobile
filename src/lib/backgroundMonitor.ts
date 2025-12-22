import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import type { Device } from '@/types';

class BackgroundMonitorService {
  private isMonitoring = false;
  private devices: Device[] = [];
  private lastDeviceStates: Map<string, {
    motorState: string;
    status: string;
    timerActive: boolean;
    timerEndTime?: Date | string;
  }> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

  async startMonitoring(devices: Device[]): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.devices = devices;
    this.isMonitoring = true;

    // Initialize device states
    devices.forEach(device => {
      this.lastDeviceStates.set(device._id, {
        motorState: device.motorState || 'OFF',
        status: device.status || 'OFFLINE',
        timerActive: device.timerActive || false,
        timerEndTime: (device as any).timerEndTime ? new Date((device as any).timerEndTime) : undefined
      });
    });

    // Listen for app state changes
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', (state) => {
        if (state.isActive) {
          // App is in foreground
          this.stopBackgroundCheck();
        } else {
          // App is in background
          this.startBackgroundCheck();
        }
      });
    }

    // Start checking immediately if app is in background
    if (Capacitor.isNativePlatform()) {
      App.getState().then(state => {
        if (!state.isActive) {
          this.startBackgroundCheck();
        }
      });
    }
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    this.stopBackgroundCheck();
    this.devices = [];
    this.lastDeviceStates.clear();
  }

  updateDevices(devices: Device[]): void {
    this.devices = devices;
  }

  private startBackgroundCheck(): void {
    if (this.checkInterval) {
      return;
    }

    this.checkInterval = setInterval(() => {
      this.checkDeviceStates();
    }, this.CHECK_INTERVAL);
  }

  private stopBackgroundCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async checkDeviceStates(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    for (const device of this.devices) {
      const lastState = this.lastDeviceStates.get(device._id);
      
      const currentMotorState = device.motorState || 'OFF';
      const currentStatus = device.status || 'OFFLINE';
      const currentTimerActive = device.timerActive || false;
      const currentTimerEndTime = (device as any).timerEndTime ? new Date((device as any).timerEndTime) : undefined;

      // Check if timer is 5 minutes or less (300 seconds)
      const timerThreshold = 5 * 60 * 1000; // 5 minutes in milliseconds
      const isTimer5Minutes = currentTimerActive && currentTimerEndTime && 
        (currentTimerEndTime.getTime() - Date.now()) <= timerThreshold &&
        (currentTimerEndTime.getTime() - Date.now()) > 0;

      // Notifications removed

      // Update last state
      this.lastDeviceStates.set(device._id, {
        motorState: currentMotorState,
        status: currentStatus,
        timerActive: currentTimerActive,
        timerEndTime: currentTimerEndTime
      });
    }
  }

}

export const backgroundMonitorService = new BackgroundMonitorService();

