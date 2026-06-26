import { create } from 'zustand';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

let locationWatcher = null;

export const useDriverStore = create((set, get) => ({
  isOnline: false,
  currentLocation: null,
  nearbyDrivers: [],

  setNearbyDrivers: (drivers) => set({ nearbyDrivers: drivers }),

  goOnline: async (driverId) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') throw new Error('Location permission denied');

    set({ isOnline: true });

    locationWatcher = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 5 },
      async (loc) => {
        const { latitude, longitude } = loc.coords;
        set({ currentLocation: { latitude, longitude } });
        await supabase.from('driver_locations').upsert({
          driver_id: driverId,
          lat: latitude,
          lng: longitude,
          is_available: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'driver_id' });
      }
    );
  },

  goOffline: async (driverId) => {
    if (locationWatcher) {
      locationWatcher.remove();
      locationWatcher = null;
    }
    await supabase.from('driver_locations').delete().eq('driver_id', driverId);
    set({ isOnline: false, currentLocation: null });
  },
}));
