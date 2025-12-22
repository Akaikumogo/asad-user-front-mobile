import { useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { useDeviceStore } from '@/store/deviceStore';
import { socketManager } from '@/lib/socket';
import type { Device } from '@/types';

export const useDevices = () => {
  const { devices, isLoading, error, setDevices, setLoading, setError } =
    useDeviceStore();

  // Use ref to prevent unnecessary re-renders
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchDevicesRef = useRef<() => Promise<void>>();

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getUserDevices();
      setDevices(data);
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Failed to fetch devices';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [setDevices, setLoading, setError]);

  // Update ref when fetchDevices changes
  useEffect(() => {
    fetchDevicesRef.current = fetchDevices;
  }, [fetchDevices]);

  useEffect(() => {
    // Initial fetch - only once on mount
    fetchDevices();

    // Setup WebSocket real-time updates
    const setupWebSocket = async () => {
      try {
        const socket = await socketManager.connect();

        if (socket && socket.connected) {
          // Listen for device updates
          socket.on('device:update', (updatedDevice: Device) => {
            setDevices((prevDevices) => {
              const index = prevDevices.findIndex(
                (d) => d._id === updatedDevice._id
              );
              if (index >= 0) {
                // Update existing device
                const newDevices = [...prevDevices];
                newDevices[index] = updatedDevice;
                return newDevices;
              } else {
                // Add new device
                return [...prevDevices, updatedDevice];
              }
            });
          });

          // Listen for device status changes
          socket.on(
            'device:status',
            (data: { deviceId: string; status: 'ONLINE' | 'OFFLINE' }) => {
              setDevices((prevDevices) => {
                return prevDevices.map((device) =>
                  device._id === data.deviceId
                    ? { ...device, status: data.status }
                    : device
                );
              });
            }
          );
        }
      } catch (error) {
        console.error('Failed to setup WebSocket:', error);
      }
    };

    setupWebSocket();

    // Setup polling fallback (every 30 seconds)
    intervalRef.current = setInterval(() => {
      if (fetchDevicesRef.current) {
        fetchDevicesRef.current();
      }
    }, 30000); // 30 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Cleanup WebSocket listeners
      const socket = socketManager.getSocket();
      if (socket) {
        socket.off('device:update');
        socket.off('device:status');
      }
    };
  }, [setDevices]); // Include setDevices in dependencies

  return {
    devices,
    loading: isLoading,
    error,
    refetch: fetchDevices
  };
};
