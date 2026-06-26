import * as TaskManager from 'expo-task-manager';
import { supabase } from '../lib/supabase';

export const BG_LOCATION_TASK = 'parapo-bg-location';

// Set by driverStore.goOnline before starting the background task.
// Since Expo's managed-workflow background tasks run in the same JS thread,
// this module-level variable is accessible from the task callback.
let _activeDriverId = null;
export const setActiveDriverId = (id) => { _activeDriverId = id; };

TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }) => {
  if (error) { console.warn('[ParaPo BG Location]', error.message); return; }
  if (!data?.locations?.[0] || !_activeDriverId) return;
  const { latitude: lat, longitude: lng } = data.locations[0].coords;
  try {
    await supabase.from('driver_locations').upsert(
      { driver_id: _activeDriverId, lat, lng, is_available: true, updated_at: new Date().toISOString() },
      { onConflict: 'driver_id' },
    );
  } catch (_) {}
});
