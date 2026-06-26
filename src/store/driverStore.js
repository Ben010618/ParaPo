import { create } from 'zustand';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { BG_LOCATION_TASK, setActiveDriverId } from '../tasks/locationTask';

let foregroundWatcher = null;

const upsertLocation = (driverId, lat, lng) =>
  supabase.from('driver_locations').upsert(
    { driver_id: driverId, lat, lng, is_available: true, updated_at: new Date().toISOString() },
    { onConflict: 'driver_id' },
  ).catch(() => {});

export const useDriverStore = create((set) => ({
  isOnline:        false,
  currentLocation: null,
  nearbyDrivers:   [],

  setNearbyDrivers: (drivers) => set({ nearbyDrivers: drivers }),

  goOnline: async (driverId) => {
    // Always request foreground first
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== 'granted') throw new Error('Location permission denied. Please enable it in Settings.');

    setActiveDriverId(driverId);
    set({ isOnline: true });

    // Try background location (requires device permission + native build)
    const { status: bg } = await Location.requestBackgroundPermissionsAsync().catch(() => ({ status: 'denied' }));

    if (bg === 'granted') {
      try {
        const running = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => false);
        if (!running) {
          await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
            accuracy:          Location.Accuracy.Balanced,
            timeInterval:      5000,   // ms
            distanceInterval:  10,     // metres
            showsBackgroundLocationIndicator: true,
            foregroundService: {
              notificationTitle: 'ParaPo — Online',
              notificationBody:  'Sharing location with passengers.',
              notificationColor: '#FFC107',
            },
          });
        }
        return; // background task handles all updates — no foreground watcher needed
      } catch (_) {
        // Fall through to foreground watcher below
      }
    }

    // Fallback: foreground-only watcher (location stops when app is backgrounded)
    foregroundWatcher = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
      ({ coords: { latitude: lat, longitude: lng } }) => {
        set({ currentLocation: { latitude: lat, longitude: lng } });
        upsertLocation(driverId, lat, lng);
      },
    );
  },

  goOffline: async (driverId) => {
    setActiveDriverId(null);

    // Stop background task
    try {
      const running = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => false);
      if (running) await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK);
    } catch (_) {}

    // Stop foreground watcher
    if (foregroundWatcher) { foregroundWatcher.remove(); foregroundWatcher = null; }

    await supabase.from('driver_locations').delete().eq('driver_id', driverId).catch(() => {});
    set({ isOnline: false, currentLocation: null });
  },
}));
