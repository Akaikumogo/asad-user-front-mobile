import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Spinner,
  Chip,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Checkbox,
  CheckboxGroup,
  Input,
  Switch
} from '@heroui/react';
import {
  Droplet,
  MapPin,
  Zap,
  Waves,
  Gauge,
  Activity,
  Calendar,
  Power,
  Clock,
  Settings,
  RefreshCw,
  Mic,
  MicOff
} from 'lucide-react';
import { api } from '@/lib/api';
import { useDeviceStore } from '@/store/deviceStore';
import { useLanguageStore } from '@/store/languageStore';
import { useDevices } from '@/hooks/useDevices';
import { socketManager } from '@/lib/socket';
import { useVoiceCommand } from '@/hooks/useVoiceCommand';
import { motion } from 'framer-motion';
import type { Device, User } from '@/types';

export const DeviceDetail: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedDevice, updateDevice } = useDeviceStore();
  const { refetch } = useDevices();
  const [device, setDevice] = useState<Device | null>(selectedDevice);
  const [loading, setLoading] = useState(!selectedDevice);
  const [error, setError] = useState<string | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Control panel states
  const [isSendingCommand, setIsSendingCommand] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [heightInput, setHeightInput] = useState('');
  const [timerMinutes, setTimerMinutes] = useState('');
  const [timerSeconds, setTimerSeconds] = useState('');
  const [, setIsHeightModalOpen] = useState(false);
  const [, setIsTimerModalOpen] = useState(false);

  // Check if device is offline - disable all actions
  const isDeviceOffline = device?.status === 'OFFLINE';
  const ultrasonicEnabled = device?.ultrasonic ?? true;
  const [isUltrasonicBlinkOn, setIsUltrasonicBlinkOn] = useState(false);

  // Manual mode timer countdown (UI side)
  const [timerRemaining, setTimerRemaining] = useState<number>(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRefetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const timerEndCommandSentRef = useRef<boolean>(false);
  const ultrasonicAtTimerStartRef = useRef<boolean | undefined>(undefined);

  const clearTimerTickers = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (timerRefetchTimeoutRef.current) {
      clearTimeout(timerRefetchTimeoutRef.current);
      timerRefetchTimeoutRef.current = null;
    }
  }, []);

  const formatTimer = useCallback((seconds: number) => {
    const s = Math.max(0, seconds);
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }, []);

  // Countdown sync: decrement each second (works regardless of ultrasonic state)
  useEffect(() => {
    const active = !!device?.timerActive;
    const duration = device?.timerDuration ?? 0;

    if (!active || duration <= 0) {
      clearTimerTickers();
      setTimerRemaining(0);
      // Clear flag when timer is cleared
      if (!active) {
        ultrasonicAtTimerStartRef.current = undefined;
      }
      return;
    }

    setTimerRemaining(duration);
    clearTimerTickers();
    timerIntervalRef.current = setInterval(() => {
      setTimerRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearTimerTickers();
  }, [
    device?.timerActive,
    device?.timerDuration,
    clearTimerTickers
  ]);

  // When countdown ends: turn motor OFF, timer OFF, ultrasonic false, then after 1s ultrasonic true
  useEffect(() => {
    if (!device?.timerActive) {
      timerEndCommandSentRef.current = false;
      return;
    }
    if (timerRemaining > 0) {
      timerEndCommandSentRef.current = false;
      return;
    }
    if (!device || !id) return;
    
    // Prevent duplicate commands
    if (timerEndCommandSentRef.current) return;
    timerEndCommandSentRef.current = true;

    clearTimerTickers();

    // Optimistic update: motor OFF, timer OFF, ultrasonic false
    const optimistic: Device = {
      ...device,
      timerActive: false,
      timerDuration: 0,
      motorState: 'OFF',
      ultrasonic: false
    };
    setDevice(optimistic);
    updateDevice(optimistic);

    // Send command to backend: motor OFF + timer OFF + ultrasonic false
    api.sendDeviceCommand(id, {
      motor: 'OFF',
      timer: 0,
      ultrasonic: false
    }).catch((err) => {
      console.error('Failed to send timer end command:', err);
      timerEndCommandSentRef.current = false; // Reset on error to allow retry
    });

    // Store ultrasonic state at timer end (before sending commands)
    const wasUltrasonicTrueAtTimerEnd = device.ultrasonic === true;

    // After 1 second, re-enable ultrasonic ONLY if it was true when timer ended
    // AND only if motor is OFF and ultrasonic is FALSE after timer ends
    if (wasUltrasonicTrueAtTimerEnd) {
      timerRefetchTimeoutRef.current = setTimeout(async () => {
        try {
          // Refetch to get latest state first
          const latestData = await api.getDevice(id);
          
          // Check if motor is OFF and ultrasonic is FALSE before re-enabling
          if (latestData.motorState === 'OFF' && latestData.ultrasonic === false) {
            // Send command to re-enable ultrasonic
            await api.sendDeviceCommand(id, {
              ultrasonic: true
            });

            // Refetch to get latest state
            const data = await api.getDevice(id);
            setDevice(data);
            updateDevice(data);
            timerEndCommandSentRef.current = false; // Reset after successful refetch
            ultrasonicAtTimerStartRef.current = undefined; // Clear the flag
          } else {
            // Motor is ON or ultrasonic is already true, just refetch
            setDevice(latestData);
            updateDevice(latestData);
            timerEndCommandSentRef.current = false;
            ultrasonicAtTimerStartRef.current = undefined;
          }
        } catch (err) {
          console.error('Failed to re-enable ultrasonic:', err);
          // Still refetch to get latest state
          try {
            const data = await api.getDevice(id);
            setDevice(data);
            updateDevice(data);
          } catch {
            // ignore
          }
          timerEndCommandSentRef.current = false;
          ultrasonicAtTimerStartRef.current = undefined; // Clear the flag
        }
      }, 1000);
    } else {
      // If ultrasonic was false when timer ended, it should NOT become true
      // Clear the flag
      ultrasonicAtTimerStartRef.current = undefined;
      timerEndCommandSentRef.current = false;
    }
  }, [
    timerRemaining,
    device,
    id,
    updateDevice,
    clearTimerTickers
  ]);

  // Control panel functions
  const handleMotorCommand = useCallback(
    async (motorState: 'ON' | 'OFF') => {
      if (!device || !id) return;

      try {
        setIsSendingCommand(true);
        setCommandError(null);

        const updatedDevice = await api.sendDeviceCommand(id, {
          motor: motorState
        });
        setDevice(updatedDevice);
        updateDevice(updatedDevice);
        await refetch();
      } catch (err: any) {
        setCommandError(
          err.response?.data?.message || t('device.commandError')
        );
      } finally {
        setIsSendingCommand(false);
      }
    },
    [device, id, updateDevice, refetch, t]
  );

  const { language } = useLanguageStore();

  // Switch motor function - must be defined before handleVoiceCommand
  const handleSwitchMotor = useCallback(async () => {
    if (!device || !id) return;

    try {
      setIsSendingCommand(true);
      setCommandError(null);

      const newMotorState = !device.activeMotor2;
      const updatedDevice = await api.sendDeviceCommand(id, {
        switchMotor: newMotorState
      });
      setDevice(updatedDevice);
      updateDevice(updatedDevice);
      await refetch();
    } catch (err: any) {
      setCommandError(err.response?.data?.message || t('device.commandError'));
    } finally {
      setIsSendingCommand(false);
    }
  }, [device, id, updateDevice, refetch, t]);

  const handleUltrasonicToggle = useCallback(
    async (enabled: boolean) => {
      if (!device || !id) return;

      try {
        setIsSendingCommand(true);
        setCommandError(null);

        // When switching ultrasonic mode, always turn motor OFF first
        // If switching to false: motor OFF, then set ultrasonic false
        // If switching to true: motor OFF, then set ultrasonic true
        const updatedDevice = await api.sendDeviceCommand(id, {
          motor: 'OFF',
          ultrasonic: enabled
        });
        setDevice(updatedDevice);
        updateDevice(updatedDevice);
        await refetch();
      } catch (err: any) {
        setCommandError(
          err.response?.data?.message || t('device.commandError')
        );
      } finally {
        setIsSendingCommand(false);
      }
    },
    [device, id, updateDevice, refetch, t]
  );

  // Voice command with motor selection
  const handleVoiceCommand = useCallback(
    async (command: {
      action: 'ON' | 'OFF';
      motor?: 'motor1' | 'motor2' | 'motor';
    }) => {
      if (!device || !id) return;

      try {
        setIsSendingCommand(true);
        setCommandError(null);

        // QO'SHISH: Motor switch va command bir vaqtda yuborish
        if (command.motor === 'motor1' && device?.activeMotor2) {
          // Motor switch va command bir vaqtda
          const updatedDevice = await api.sendDeviceCommand(id, {
            switchMotor: false,
            motor: command.action
          });
          setDevice(updatedDevice);
          updateDevice(updatedDevice);
        } else if (command.motor === 'motor2' && !device?.activeMotor2) {
          // Motor switch va command bir vaqtda
          const updatedDevice = await api.sendDeviceCommand(id, {
            switchMotor: true,
            motor: command.action
          });
          setDevice(updatedDevice);
          updateDevice(updatedDevice);
        } else {
          // Faqat command
          await handleMotorCommand(command.action);
        }
      } catch (err: any) {
        setCommandError(
          err.response?.data?.message || t('device.commandError')
        );
      } finally {
        setIsSendingCommand(false);
      }
    },
    [device, id, handleMotorCommand, updateDevice, t]
  );

  const {
    isListening,
    transcript,
    error: voiceError,
    startListening,
    stopListening
  } = useVoiceCommand(handleVoiceCommand, language);

  // Ultrasonic manual mode indicator (blink green when ultrasonic is OFF)
  useEffect(() => {
    if (ultrasonicEnabled) {
      setIsUltrasonicBlinkOn(false);
      return;
    }
    setIsUltrasonicBlinkOn(true);
    const blink = window.setInterval(() => {
      setIsUltrasonicBlinkOn((v) => !v);
    }, 650);
    return () => window.clearInterval(blink);
  }, [ultrasonicEnabled]);

  useEffect(() => {
    const fetchDevice = async () => {
      if (!id) return;

      if (selectedDevice?._id === id) {
        setDevice(selectedDevice);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await api.getDevice(id);
        setDevice(data);
        setSelectedUserIds(data.userIds || []);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load device');
      } finally {
        setLoading(false);
      }
    };

    fetchDevice();
  }, [id, selectedDevice]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!isAssignModalOpen) return;

      try {
        setIsLoadingUsers(true);
        const data = await api.getUsers();
        setUsers(data);
      } catch (err: any) {
        // If 403, user doesn't have permission to view users list
        if (err.response?.status === 403) {
          setAssignError(t('device.assignError'));
        } else {
          setAssignError(err.response?.data?.message || 'Failed to load users');
        }
      } finally {
        setIsLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [isAssignModalOpen, t]);

  const handleAssignUsers = async () => {
    if (!device || !id) return;

    try {
      setIsAssigning(true);
      setAssignError(null);

      const updatedDevice = await api.assignUsers(id, selectedUserIds);
      setDevice(updatedDevice);
      updateDevice(updatedDevice);

      // Refresh devices list
      await refetch();

      setIsAssignModalOpen(false);
    } catch (err: any) {
      setAssignError(err.response?.data?.message || t('device.assignError'));
    } finally {
      setIsAssigning(false);
    }
  };

  const handleSetHeight = async () => {
    if (!device || !id || !heightInput) return;

    const height = parseInt(heightInput);
    if (isNaN(height) || height < 0) {
      setCommandError('Invalid height value');
      return;
    }

    try {
      setIsSendingCommand(true);
      setCommandError(null);

      const updatedDevice = await api.sendDeviceCommand(id, { height });
      setDevice(updatedDevice);
      updateDevice(updatedDevice);
      await refetch();

      setIsHeightModalOpen(false);
      setHeightInput('');
    } catch (err: any) {
      setCommandError(err.response?.data?.message || t('device.commandError'));
    } finally {
      setIsSendingCommand(false);
    }
  };

  const handleSetTimer = async () => {
    if (!device || !id) return;

    // Convert minutes and seconds to total seconds
    // Example: 5 minutes 30 seconds = 330 seconds
    const minutes = parseInt(timerMinutes || '0', 10);
    const seconds = parseInt(timerSeconds || '0', 10);

    if (
      isNaN(minutes) ||
      isNaN(seconds) ||
      minutes < 0 ||
      seconds < 0 ||
      seconds >= 60
    ) {
      setCommandError(
        'Invalid time value. Minutes must be >= 0, seconds must be 0-59'
      );
      return;
    }

    // Convert to seconds: minutes * 60 + seconds
    const timer = minutes * 60 + seconds;

    if (timer <= 0) {
      setCommandError('Timer must be greater than 0');
      return;
    }

    try {
      setIsSendingCommand(true);
      setCommandError(null);

      // Timer requirement:
      // - start countdown immediately (00:05 -> 00:04 ...)
      // - when saved, motor should be ON (if not already)
      // Store ultrasonic state when timer is started
      ultrasonicAtTimerStartRef.current = device.ultrasonic ?? true;
      
      const optimistic: Device = {
        ...device,
        timerActive: true,
        timerDuration: timer,
        motorState: device.motorState === 'ON' ? device.motorState : 'ON'
      };
      setDevice(optimistic);
      updateDevice(optimistic);
      setTimerRemaining(timer);
      timerEndCommandSentRef.current = false; // Reset flag when starting new timer

      const updatedDevice = await api.sendDeviceCommand(id, { timer });
      setDevice(updatedDevice);
      updateDevice(updatedDevice);
      await refetch();

      setIsTimerModalOpen(false);
      setTimerMinutes('');
      setTimerSeconds('');
    } catch (err: any) {
      setCommandError(err.response?.data?.message || t('device.commandError'));
    } finally {
      setIsSendingCommand(false);
    }
  };

  // Real-time updates via WebSocket
  useEffect(() => {
    if (!id) return;
    // Real-time updates work regardless of ultrasonic state

    const setupWebSocket = async () => {
      try {
        const socket = await socketManager.connect();

        if (socket && socket.connected) {
          // Subscribe to device updates
          socket.emit('subscribe:device', id);

          // Listen for device updates - DARHOL yangilash (async yo'q)
          const handleUpdate = (updatedDevice: Device) => {
            if (updatedDevice._id === id) {
              setDevice((prev) => {
                if (!prev) return updatedDevice;
                
                // Real-time motor state updates only apply when ultrasonic is true
                let finalDevice = {
                  ...updatedDevice,
                  motorState:
                    updatedDevice.ultrasonic && updatedDevice.motorState !== undefined
                      ? updatedDevice.motorState
                      : prev.motorState
                };
                
                // If motor turns OFF while timer is active (especially when ultrasonic is true),
                // clear the timer and set ultrasonic to false
                if (prev.timerActive && finalDevice.motorState === 'OFF' && prev.motorState === 'ON') {
                  const wasUltrasonicTrue = prev.ultrasonic === true;
                  
                  finalDevice = {
                    ...finalDevice,
                    timerActive: false,
                    timerDuration: 0,
                    ultrasonic: false
                  };
                  setTimerRemaining(0);
                  clearTimerTickers();
                  ultrasonicAtTimerStartRef.current = undefined; // Clear flag when timer is cleared
                  
                  // Send command to backend: timer clear + ultrasonic false
                  api.sendDeviceCommand(id, {
                    timer: 0,
                    ultrasonic: false
                  }).catch((err) => {
                    console.error('Failed to send timer clear command:', err);
                  });

                  // If ultrasonic was true, re-enable it after 1 second
                  if (wasUltrasonicTrue) {
                    // Clear any existing timeout
                    if (timerRefetchTimeoutRef.current) {
                      clearTimeout(timerRefetchTimeoutRef.current);
                    }
                    
                    timerRefetchTimeoutRef.current = setTimeout(async () => {
                      try {
                        await api.sendDeviceCommand(id, {
                          ultrasonic: true
                        });
                        
                        // Refetch to get latest state
                        const data = await api.getDevice(id);
                        setDevice(data);
                        updateDevice(data);
                      } catch (err) {
                        console.error('Failed to re-enable ultrasonic:', err);
                        // Still refetch to get latest state
                        try {
                          const data = await api.getDevice(id);
                          setDevice(data);
                          updateDevice(data);
                        } catch {
                          // ignore
                        }
                      }
                    }, 1000);
                  }
                }

                // If timer is manually turned off while ultrasonic is true (timer was active, now inactive)
                if (prev.timerActive && !finalDevice.timerActive && prev.ultrasonic === true && finalDevice.motorState === 'OFF') {
                  // Clear any existing timeout
                  if (timerRefetchTimeoutRef.current) {
                    clearTimeout(timerRefetchTimeoutRef.current);
                  }
                  
                  // Clear flag when timer is manually turned off
                  ultrasonicAtTimerStartRef.current = undefined;
                  
                  // If ultrasonic is false, re-enable it after 1 second
                  if (finalDevice.ultrasonic === false) {
                    timerRefetchTimeoutRef.current = setTimeout(async () => {
                      try {
                        await api.sendDeviceCommand(id, {
                          ultrasonic: true
                        });
                        
                        // Refetch to get latest state
                        const data = await api.getDevice(id);
                        setDevice(data);
                        updateDevice(data);
                      } catch (err) {
                        console.error('Failed to re-enable ultrasonic:', err);
                        // Still refetch to get latest state
                        try {
                          const data = await api.getDevice(id);
                          setDevice(data);
                          updateDevice(data);
                        } catch {
                          // ignore
                        }
                      }
                    }, 1000);
                  }
                }
                
                // Store'ni ham darhol yangilash
                updateDevice(finalDevice);
                return finalDevice;
              });
            }
          };

          // Listen for device status changes - DARHOL yangilash
          const handleStatus = (data: {
            deviceId: string;
            status: 'ONLINE' | 'OFFLINE';
            waterDepth?: number;
            totalLitres?: number;
            totalElectricity?: number;
            ultrasonicMode?: boolean;
            activeMotor2?: boolean;
            height?: number;
            motorState?: string;
          }) => {
            if (data.deviceId === id) {
              setDevice((prev) => {
                if (!prev) return prev;

                // Determine the new ultrasonic value (from update or keep previous)
                const newUltrasonic = data.ultrasonicMode !== undefined
                  ? data.ultrasonicMode
                  : prev.ultrasonic;

                const updated = {
                  ...prev,
                  status: data.status,
                  waterDepth:
                    data.waterDepth !== undefined
                      ? data.waterDepth
                      : prev.waterDepth,
                  totalLitres:
                    data.totalLitres !== undefined
                      ? data.totalLitres
                      : prev.totalLitres,
                  totalElectricity:
                    data.totalElectricity !== undefined
                      ? data.totalElectricity
                      : prev.totalElectricity,
                  ultrasonic: newUltrasonic,
                  activeMotor2:
                    data.activeMotor2 !== undefined
                      ? data.activeMotor2
                      : prev.activeMotor2,
                  height: data.height !== undefined ? data.height : prev.height,
                  // Real-time motor state updates only apply when ultrasonic is true
                  motorState:
                    data.motorState !== undefined && newUltrasonic
                      ? data.motorState
                      : prev.motorState
                };
                
                // If motor turns OFF while timer is active (especially when ultrasonic is true),
                // clear the timer and set ultrasonic to false
                if (prev.timerActive && updated.motorState === 'OFF' && prev.motorState === 'ON') {
                  const wasUltrasonicTrue = prev.ultrasonic === true;
                  
                  updated.timerActive = false;
                  updated.timerDuration = 0;
                  updated.ultrasonic = false;
                  setTimerRemaining(0);
                  clearTimerTickers();
                  ultrasonicAtTimerStartRef.current = undefined; // Clear flag when timer is cleared
                  
                  // Send command to backend: timer clear + ultrasonic false
                  api.sendDeviceCommand(id, {
                    timer: 0,
                    ultrasonic: false
                  }).catch((err) => {
                    console.error('Failed to send timer clear command:', err);
                  });

                  // If ultrasonic was true, re-enable it after 1 second
                  if (wasUltrasonicTrue) {
                    // Clear any existing timeout
                    if (timerRefetchTimeoutRef.current) {
                      clearTimeout(timerRefetchTimeoutRef.current);
                    }
                    
                    timerRefetchTimeoutRef.current = setTimeout(async () => {
                      try {
                        await api.sendDeviceCommand(id, {
                          ultrasonic: true
                        });
                        
                        // Refetch to get latest state
                        const data = await api.getDevice(id);
                        setDevice(data);
                        updateDevice(data);
                      } catch (err) {
                        console.error('Failed to re-enable ultrasonic:', err);
                        // Still refetch to get latest state
                        try {
                          const data = await api.getDevice(id);
                          setDevice(data);
                          updateDevice(data);
                        } catch {
                          // ignore
                        }
                      }
                    }, 1000);
                  }
                }

                // Store'ni ham darhol yangilash
                updateDevice(updated);

                return updated;
              });
            }
          };

          socket.on('device:update', handleUpdate);
          socket.on('device:status', handleStatus);

          return () => {
            socket.off('device:update', handleUpdate);
            socket.off('device:status', handleStatus);
            socket.emit('unsubscribe:device', id);
          };
        }
      } catch (error) {
        console.error('Failed to setup WebSocket:', error);
      }
    };

    const cleanup = setupWebSocket();

    // Fallback: Auto-refresh device data every 2 seconds (tezroq real-time)
    const interval = setInterval(async () => {
      try {
        const data = await api.getDevice(id);
        setDevice(data);
        updateDevice(data);
      } catch (err) {
        // Silent fail for auto-refresh
      }
    }, 2000); // 2 seconds fallback (10 soniyadan tezroq)

    return () => {
      clearInterval(interval);
      cleanup.then((cleanupFn) => {
        if (cleanupFn) cleanupFn();
      });
    };
  }, [id, ultrasonicEnabled, updateDevice, t]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="min-h-screen p-4">
        <Card className="premium-card">
          <CardBody>
            <p className="text-danger">{error || 'Device not found'}</p>
            <Button
              onPress={() => navigate('/dashboard')}
              className="mt-4"
              variant="flat"
            >
              {t('common.back')}
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.3 }}
      >
        <Card className="premium-card">
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('device.details')}</h2>
            <Chip
              color={device.status === 'ONLINE' ? 'success' : 'danger'}
              variant="flat"
              size="sm"
            >
              {device.status === 'ONLINE'
                ? t('dashboard.online')
                : t('dashboard.offline')}
            </Chip>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {t('device.location')}
                </p>
                <p className="font-medium">{device.location}</p>
              </div>
            </div>

            <Divider />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-warning" />
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {t('dashboard.powerUsage')}
                  </p>
                  <p className="font-semibold">
                    {(device.powerUsage ?? 0).toFixed(2)} W
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Waves className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {t('dashboard.waterDepth')}
                  </p>
                  <p className="font-semibold">
                    {(device.waterDepth ?? 0).toFixed(2)} cm
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Gauge className="w-5 h-5 text-success" />
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {t('dashboard.height')}
                  </p>
                  <p className="font-semibold">
                    {(device.height ?? 0).toFixed(2)} cm
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Droplet className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {t('dashboard.totalLitres')}
                  </p>
                  <p className="font-semibold">
                    {(device.totalLitres ?? 0).toFixed(2)} L
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {t('dashboard.totalElectricity')}
                  </p>
                  <p className="font-semibold">
                    {(device.totalElectricity ?? 0).toFixed(2)} kWh
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {t('device.lastUpdated')}
                  </p>
                  <p className="font-semibold text-xs">
                    {new Date(device.lastUpdated).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* Control Panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card className="premium-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              <h2 className="text-lg font-semibold">{t('device.control')}</h2>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            {commandError && (
              <div className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800">
                <p className="text-sm text-danger">{commandError}</p>
              </div>
            )}

            {/* Motor Control */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">{t('device.motor')}</p>
                <Button
                  isIconOnly
                  size="sm"
                  variant={isListening ? 'solid' : 'flat'}
                  color={isListening ? 'danger' : 'primary'}
                  onPress={isListening ? stopListening : startListening}
                  aria-label={
                    isListening ? t('device.stopVoice') : t('device.startVoice')
                  }
                  isDisabled={ultrasonicEnabled ? true : isDeviceOffline}
                >
                  {isListening ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {/* Voice Command Instructions */}
              {!isListening && (
                <div className="mb-3 p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
                  <p className="text-xs font-medium text-primary mb-2">
                    {t('device.voiceInstructions')}:
                  </p>
                  <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1 list-disc list-inside">
                    <li>{t('device.voiceOn')}</li>
                    <li>{t('device.voiceOff')}</li>
                  </ul>
                </div>
              )}

              {isListening && (
                <div className="mb-2 p-3 rounded-lg bg-primary/10 border border-primary/20 animate-pulse">
                  <p className="text-xs text-primary font-medium mb-1 flex items-center gap-2">
                    <Mic className="w-3 h-3 animate-pulse" />
                    {t('device.listening')}...
                  </p>
                  {transcript && (
                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                      "{transcript}"
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('device.speakNow')}
                  </p>
                </div>
              )}

              {voiceError && (
                <div className="mb-2 p-2 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800">
                  <p className="text-xs text-danger">{voiceError}</p>
                </div>
              )}

              {isDeviceOffline && (
                <div className="mb-3 p-3 rounded-lg bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800">
                  <p className="text-xs text-warning font-medium">
                    {t('device.offlineWarning')}
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  color={device.motorState === 'ON' ? 'success' : 'default'}
                  variant={device.motorState === 'ON' ? 'solid' : 'flat'}
                  onPress={() => handleMotorCommand('ON')}
                  isDisabled={
                    ultrasonicEnabled
                      ? true
                      : isDeviceOffline || isSendingCommand || isListening
                  }
                  startContent={<Power className="w-4 h-4" />}
                  className={`flex-1 text-white ${
                    device.motorState === 'ON' ? 'bg-green-600' : 'bg-gray-600'
                  }`}
                >
                  {t('device.motorOn')}
                </Button>
                <Button
                  color={device.motorState === 'OFF' ? 'danger' : 'default'}
                  variant={device.motorState === 'OFF' ? 'solid' : 'flat'}
                  onPress={() => handleMotorCommand('OFF')}
                  isDisabled={
                    ultrasonicEnabled
                      ? true
                      : isDeviceOffline || isSendingCommand || isListening
                  }
                  startContent={<Power className="w-4 h-4" />}
                  className={`flex-1 text-white ${
                    device.motorState === 'OFF' ? 'bg-red-600' : 'bg-gray-600'
                  }`}
                >
                  {t('device.motorOff')}
                </Button>
              </div>
              {device.motorFault && (
                <Chip color="danger" variant="flat" size="sm" className="mt-2">
                  {t('device.motorFault')}
                </Chip>
              )}
              {device.activeMotor2 !== undefined && (
                <Chip color="primary" variant="flat" size="sm" className="mt-2">
                  {t('device.activeMotor')}:{' '}
                  {device.activeMotor2
                    ? t('device.motor2')
                    : t('device.motor1')}
                </Chip>
              )}
            </div>

            <Divider />

            {/* Height Control */}
            <div>
              <p className="text-sm font-medium mb-2">
                {t('device.setHeight')}
              </p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder={t('device.height')}
                  value={heightInput}
                  onValueChange={setHeightInput}
                  variant="bordered"
                  className="flex-1"
                  isDisabled={isDeviceOffline}
                />
                <Button
                  color="primary"
                  className="text-white bg-primary"
                  onPress={() => {
                    if (heightInput) {
                      handleSetHeight();
                    } else {
                      setCommandError(t('device.heightRequired'));
                    }
                  }}
                  isDisabled={isDeviceOffline || isSendingCommand}
                >
                  {t('common.save')}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t('device.height')}: {device.height} cm
              </p>
            </div>

            <Divider />

            {/* Timer Control - works in both ultrasonic and manual mode */}
            <div>
              <p className="text-sm font-medium mb-2">
                {t('device.setTimer')}
              </p>
                  <div className="space-y-2">
                    <div className="flex gap-2 items-end">
                      <Input
                        type="number"
                        label={t('device.timerMinutes')}
                        placeholder="0"
                        value={timerMinutes}
                        onValueChange={setTimerMinutes}
                        variant="bordered"
                        className="flex-1"
                        isDisabled={isDeviceOffline}
                        min={0}
                        classNames={{
                          input: 'text-base',
                          inputWrapper: 'h-12'
                        }}
                      />
                      <span className="text-2xl font-bold text-gray-400 pb-2">
                        :
                      </span>
                      <Input
                        type="number"
                        label={t('device.timerSeconds')}
                        placeholder="0"
                        value={timerSeconds}
                        onValueChange={(value) => {
                          // Limit seconds to 0-59
                          const num = parseInt(value || '0', 10);
                          if (isNaN(num) || num < 0) {
                            setTimerSeconds('');
                          } else if (num >= 60) {
                            setTimerSeconds('59');
                          } else {
                            setTimerSeconds(value);
                          }
                        }}
                        variant="bordered"
                        className="flex-1"
                        isDisabled={isDeviceOffline}
                        min={0}
                        max={59}
                        classNames={{
                          input: 'text-base',
                          inputWrapper: 'h-12'
                        }}
                      />
                    </div>
                    <Button
                      color="primary"
                      className="text-white bg-primary w-full"
                      onPress={() => {
                        if (timerMinutes || timerSeconds) {
                          handleSetTimer();
                        } else {
                          setCommandError(t('device.timerRequired'));
                        }
                      }}
                      isDisabled={isDeviceOffline || isSendingCommand}
                      startContent={<Clock className="w-4 h-4 text-white" />}
                    >
                      {t('common.save')}
                    </Button>
                  </div>
                  {device.timerActive && timerRemaining > 0 && (
                    <p className="text-xs text-primary mt-1">
                      {t('device.timerRemaining')}:{' '}
                      {formatTimer(timerRemaining)}
                    </p>
                  )}
                </div>

            <Divider />

            {/* Ultrasonic Mode Switch */}
            <div>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {t('device.ultrasonicMode')}:{' '}
                    {ultrasonicEnabled ? t('device.auto') : t('device.manual')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {device.ultrasonic
                      ? t('device.ultrasonicAutoDesc')
                      : t('device.ultrasonicManualDesc')}
                  </p>
                </div>
                {ultrasonicEnabled && (
                  <div
                    className={`mr-3 h-3 w-3 rounded-full bg-emerald-500 transition-opacity ${
                      isUltrasonicBlinkOn ? 'opacity-100' : 'opacity-15'
                    }`}
                    aria-label="Ultrasonic manual indicator"
                  />
                )}
                <Switch
                  isSelected={device.ultrasonic ?? true}
                  onValueChange={handleUltrasonicToggle}
                  isDisabled={isDeviceOffline || isSendingCommand}
                  color="primary"
                />
              </div>
            </div>

            <Divider />

            {/* Motor Switching */}
            {device.activeMotor2 !== undefined && (
              <div>
                <p className="text-sm font-medium mb-2">
                  {t('device.switchMotor')}
                </p>
                <Button
                  color="secondary"
                  variant="solid"
                  onPress={handleSwitchMotor}
                  isDisabled={
                    ultrasonicEnabled
                      ? true
                      : isDeviceOffline || isSendingCommand || device.motorFault
                  }
                  startContent={<RefreshCw className="w-4 h-4 text-white" />}
                  className="w-full text-white bg-secondary"
                >
                  {device.activeMotor2
                    ? t('device.motor1')
                    : t('device.motor2')}
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </motion.div>

      {/* Assign Users Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => {
          setIsAssignModalOpen(false);
          setAssignError(null);
        }}
        placement="center"
        scrollBehavior="inside"
        size="lg"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            {t('device.assignUsersTitle')}
          </ModalHeader>
          <ModalBody>
            {assignError && (
              <div className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800">
                <p className="text-sm text-danger">{assignError}</p>
              </div>
            )}

            {isLoadingUsers ? (
              <div className="flex justify-center py-8">
                <Spinner size="lg" color="primary" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400">
                  {t('device.noUsers')}
                </p>
              </div>
            ) : (
              <CheckboxGroup
                value={selectedUserIds}
                onValueChange={(values) =>
                  setSelectedUserIds(values as string[])
                }
                label={t('device.selectUsers')}
              >
                {users.map((user) => (
                  <Checkbox key={user._id} value={user._id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.username}</span>
                      <span className="text-xs text-gray-500">{user.role}</span>
                    </div>
                  </Checkbox>
                ))}
              </CheckboxGroup>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={() => {
                setIsAssignModalOpen(false);
                setAssignError(null);
              }}
              isDisabled={isAssigning}
            >
              {t('common.cancel')}
            </Button>
            <Button
              color="primary"
              className="text-white"
              onPress={handleAssignUsers}
              isLoading={isAssigning}
              isDisabled={isLoadingUsers || users.length === 0}
            >
              {t('common.save')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};
