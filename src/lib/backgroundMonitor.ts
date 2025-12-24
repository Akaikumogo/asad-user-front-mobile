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
      ultrasonicAtTimerStart?: boolean; // Store ultrasonic state when timer was started
      timerEndCommandSent?: boolean;
      ultrasonicReenableTimeout?: ReturnType<typeof setTimeout>;
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

    // Clear all ultrasonic re-enable timeouts
    this.lastDeviceStates.forEach((state) => {
      if (state.ultrasonicReenableTimeout) {
        clearTimeout(state.ultrasonicReenableTimeout);
      }
    });

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
          // Store if ultrasonic was true before clearing
          const wasUltrasonicTrue = lastState.ultrasonic === true;

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

          // If ultrasonic was true, re-enable it after 1 second
          // BUT only if motor is OFF and ultrasonic is FALSE after timer ends
          if (wasUltrasonicTrue) {
            const ultrasonicTimeout = setTimeout(async () => {
              try {
                // Check current state before re-enabling
                const currentState = this.lastDeviceStates.get(device._id);
                if (
                  currentState &&
                  currentState.motorState === 'OFF' &&
                  currentState.ultrasonic === false
                ) {
                  await api.sendDeviceCommand(device._id, {
                    ultrasonic: true
                  });

                  // Update local state
                  this.lastDeviceStates.set(device._id, {
                    ...currentState,
                    ultrasonic: true,
                    ultrasonicReenableTimeout: undefined
                  });

                  // Update device in array
                  const deviceIdx = this.devices.findIndex(
                    (d) => d._id === device._id
                  );
                  if (deviceIdx >= 0) {
                    this.devices[deviceIdx] = {
                      ...this.devices[deviceIdx],
                      ultrasonic: true
                    };
                  }
                }
              } catch (error) {
                console.error(
                  `Failed to re-enable ultrasonic for device ${device._id}:`,
                  error
                );
              }
            }, 1000);

            // Store timeout reference
            const currentState = this.lastDeviceStates.get(device._id);
            if (currentState) {
              this.lastDeviceStates.set(device._id, {
                ...currentState,
                ultrasonicReenableTimeout: ultrasonicTimeout
              });
            }
          }
        } catch (error) {
          console.error(
            `Failed to send timer clear command for device ${device._id}:`,
            error
          );
        }
      }

      // If timer is manually turned off while ultrasonic is true (timer was active, now inactive, but motor might still be ON)
      if (
        lastState?.timerActive &&
        !currentTimerActive &&
        lastState.ultrasonic === true &&
        !lastState.ultrasonicReenableTimeout
      ) {
        try {
          // Send command to backend: ultrasonic false
          await api.sendDeviceCommand(device._id, {
            ultrasonic: false
          });

          // Update local state
          this.lastDeviceStates.set(device._id, {
            ...lastState,
            timerActive: false,
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
              ultrasonic: false
            };
          }

          // After 1 second, re-enable ultrasonic
          // BUT only if motor is OFF and ultrasonic is FALSE after timer is turned off
          const ultrasonicTimeout = setTimeout(async () => {
            try {
              // Check current state before re-enabling
              const currentState = this.lastDeviceStates.get(device._id);
              if (
                currentState &&
                currentState.motorState === 'OFF' &&
                currentState.ultrasonic === false
              ) {
                await api.sendDeviceCommand(device._id, {
                  ultrasonic: true
                });

                // Update local state
                this.lastDeviceStates.set(device._id, {
                  ...currentState,
                  ultrasonic: true,
                  ultrasonicReenableTimeout: undefined
                });

                // Update device in array
                const deviceIdx = this.devices.findIndex(
                  (d) => d._id === device._id
                );
                if (deviceIdx >= 0) {
                  this.devices[deviceIdx] = {
                    ...this.devices[deviceIdx],
                    ultrasonic: true
                  };
                }
              }
            } catch (error) {
              console.error(
                `Failed to re-enable ultrasonic for device ${device._id}:`,
                error
              );
            }
          }, 1000);

          // Store timeout reference
          const currentState = this.lastDeviceStates.get(device._id);
          if (currentState) {
            this.lastDeviceStates.set(device._id, {
              ...currentState,
              ultrasonicReenableTimeout: ultrasonicTimeout
            });
          }
        } catch (error) {
          console.error(
            `Failed to handle timer off with ultrasonic true for device ${device._id}:`,
            error
          );
        }
      }

      // Clear ultrasonic re-enable timeout if timer is active again or device state changed
      if (lastState?.ultrasonicReenableTimeout) {
        if (currentTimerActive || currentMotorState === 'ON') {
          clearTimeout(lastState.ultrasonicReenableTimeout);
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
        // Store ultrasonic state when timer is newly started
        ultrasonicAtTimerStart:
          // If timer is newly started, store current ultrasonic state
          currentTimerActive && !lastState?.timerActive
            ? device.ultrasonic ?? true
            : // If timer was cleared, clear the flag
            !currentTimerActive && lastState?.timerActive
            ? undefined
            : // Otherwise keep existing value
              lastState?.ultrasonicAtTimerStart,
        timerEndCommandSent:
          // Reset flag if timer is newly started or timer was cleared
          (!currentTimerActive && lastState?.timerActive) ||
          (currentTimerActive && !lastState?.timerActive)
            ? false
            : lastState?.timerEndCommandSent ?? false,
        ultrasonicReenableTimeout:
          // Clear timeout if timer is active again or motor is ON
          currentTimerActive || currentMotorState === 'ON'
            ? undefined
            : lastState?.ultrasonicReenableTimeout
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
          // Store ultrasonic state at timer end (before sending commands)
          const wasUltrasonicTrueAtTimerEnd = lastState.ultrasonic === true;

          // Mark as sent before making the call
          this.lastDeviceStates.set(device._id, {
            ...lastState,
            timerEndCommandSent: true
          });

          // Send command to backend: motor OFF + timer OFF + ultrasonic false
          await api.sendDeviceCommand(device._id, {
            motor: 'OFF',
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
            timerStartTime: undefined,
            timerEndCommandSent: true
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

          // After 1 second, re-enable ultrasonic ONLY if it was true when timer ended
          // AND only if motor is OFF and ultrasonic is FALSE after timer ends
          if (wasUltrasonicTrueAtTimerEnd) {
            const ultrasonicTimeout = setTimeout(async () => {
              try {
                // Check current state before re-enabling
                const currentState = this.lastDeviceStates.get(device._id);
                if (
                  currentState &&
                  currentState.motorState === 'OFF' &&
                  currentState.ultrasonic === false
                ) {
                  await api.sendDeviceCommand(device._id, {
                    ultrasonic: true
                  });

                  // Update local state
                  this.lastDeviceStates.set(device._id, {
                    ...currentState,
                    ultrasonic: true,
                    ultrasonicReenableTimeout: undefined,
                    ultrasonicAtTimerStart: undefined
                  });

                  // Update device in array
                  const deviceIdx = this.devices.findIndex(
                    (d) => d._id === device._id
                  );
                  if (deviceIdx >= 0) {
                    this.devices[deviceIdx] = {
                      ...this.devices[deviceIdx],
                      ultrasonic: true
                    };
                  }
                }
              } catch (error) {
                console.error(
                  `Failed to re-enable ultrasonic for device ${device._id}:`,
                  error
                );
              }
            }, 1000);

            // Store timeout reference
            const currentState = this.lastDeviceStates.get(device._id);
            if (currentState) {
              this.lastDeviceStates.set(device._id, {
                ...currentState,
                ultrasonicReenableTimeout: ultrasonicTimeout
              });
            }
          } else {
            // If ultrasonic was false when timer ended, clear the flag
            // Ultrasonic should NOT become true
            const currentState = this.lastDeviceStates.get(device._id);
            if (currentState) {
              this.lastDeviceStates.set(device._id, {
                ...currentState,
                ultrasonicAtTimerStart: undefined
              });
            }
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
