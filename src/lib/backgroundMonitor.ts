import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import type { Device } from '@/types';
import { api } from './api';

class BackgroundMonitorService {
  private isMonitoring = false;
  private devices: Device[] = [];
  private lastDeviceStates: Map<
    string,
    {
      motorState: string;
      status: string;
      timerActive: boolean;
      timerDuration?: number;
      timerStartTime?: Date;
      ultrasonic?: boolean;
      timerEndCommandSent?: boolean;
    }
  > = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private timerCheckInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly TIMER_CHECK_INTERVAL = 1000; // 1 second for timer checks

  async startMonitoring(devices: Device[]): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.devices = devices;
    this.isMonitoring = true;

    // Initialize device states
    devices.forEach((device) => {
      this.lastDeviceStates.set(device._id, {
        motorState: device.motorState || 'OFF',
        status: device.status || 'OFFLINE',
        timerActive: device.timerActive || false,
        timerDuration: device.timerDuration,
        timerStartTime:
          device.timerActive && device.timerDuration
            ? new Date(Date.now() - device.timerDuration * 1000)
            : undefined,
        ultrasonic: device.ultrasonic ?? true,
        timerEndCommandSent: false
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
      App.getState().then((state) => {
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

    // Start timer monitoring (check every second)
    if (!this.timerCheckInterval) {
      this.timerCheckInterval = setInterval(() => {
        this.checkTimers();
      }, this.TIMER_CHECK_INTERVAL);
    }
  }

  private stopBackgroundCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    if (this.timerCheckInterval) {
      clearInterval(this.timerCheckInterval);
      this.timerCheckInterval = null;
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
      const currentTimerDuration = device.timerDuration;

      // If motor turns OFF while timer is active (especially when ultrasonic is true),
      // clear the timer and set ultrasonic to false
      if (
        lastState?.timerActive &&
        currentMotorState === 'OFF' &&
        lastState.motorState === 'ON'
      ) {
        try {
          // Send command to backend: timer clear + ultrasonic false
          await api.sendDeviceCommand(device._id, {
            timer: 0,
            ultrasonic: false
          });

          // Update local state
          this.lastDeviceStates.set(device._id, {
            ...lastState,
            timerActive: false,
            timerDuration: 0,
            motorState: 'OFF',
            ultrasonic: false,
            timerStartTime: undefined
          });

          // Update device in array
          const deviceIndex = this.devices.findIndex(
            (d) => d._id === device._id
          );
          if (deviceIndex >= 0) {
            this.devices[deviceIndex] = {
              ...this.devices[deviceIndex],
              timerActive: false,
              timerDuration: 0,
              motorState: 'OFF',
              ultrasonic: false
            };
          }
        } catch (error) {
          console.error(
            `Failed to send timer clear command for device ${device._id}:`,
            error
          );
        }
      }

      // Update last state
      this.lastDeviceStates.set(device._id, {
        motorState: currentMotorState,
        status: currentStatus,
        timerActive: currentTimerActive,
        timerDuration: currentTimerDuration,
        timerStartTime:
          currentTimerActive &&
          currentTimerDuration &&
          !lastState?.timerStartTime
            ? new Date(Date.now() - currentTimerDuration * 1000)
            : lastState?.timerStartTime,
        ultrasonic: device.ultrasonic ?? true,
        timerEndCommandSent:
          // Reset flag if timer is newly started or timer was cleared
          (!currentTimerActive && lastState?.timerActive) ||
          (currentTimerActive && !lastState?.timerActive)
            ? false
            : lastState?.timerEndCommandSent ?? false
      });
    }
  }

  private async checkTimers(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    for (const device of this.devices) {
      const lastState = this.lastDeviceStates.get(device._id);
      if (
        !lastState?.timerActive ||
        !lastState.timerStartTime ||
        !lastState.timerDuration
      ) {
        continue;
      }

      // Calculate elapsed time
      const elapsed = Math.floor(
        (Date.now() - lastState.timerStartTime.getTime()) / 1000
      );

      // If timer has expired
      if (elapsed >= lastState.timerDuration) {
        // Prevent duplicate commands
        if (lastState.timerEndCommandSent) {
          continue;
        }

        try {
          // Mark as sent before making the call
          this.lastDeviceStates.set(device._id, {
            ...lastState,
            timerEndCommandSent: true
          });

          // Send command to backend: motor OFF + ultrasonic false
          await api.sendDeviceCommand(device._id, {
            motor: 'OFF',
            ultrasonic: false
          });

          // Update local state
          this.lastDeviceStates.set(device._id, {
            ...lastState,
            timerActive: false,
            timerDuration: 0,
            motorState: 'OFF',
            ultrasonic: false,
            timerStartTime: undefined
          });

          // Update device in array
          const deviceIndex = this.devices.findIndex(
            (d) => d._id === device._id
          );
          if (deviceIndex >= 0) {
            this.devices[deviceIndex] = {
              ...this.devices[deviceIndex],
              timerActive: false,
              timerDuration: 0,
              motorState: 'OFF',
              ultrasonic: false
            };
          }
        } catch (error) {
          console.error(
            `Failed to send timer end command for device ${device._id}:`,
            error
          );
        }
      }
    }
  }
}

export const backgroundMonitorService = new BackgroundMonitorService();
