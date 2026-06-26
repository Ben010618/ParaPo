import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// Module-level channel reference so it survives re-renders
let msgChannel = null;

export const useRideStore = create((set, get) => ({
  activeRide:               null,
  rideHistory:              [],
  incomingRequest:          null,
  incomingPassengerProfile: null,
  matchedDriverProfile:     null,
  rideMessages:             [],

  setIncomingRequest: (req) => set({ incomingRequest: req }),

  clearIncomingRequest: () => set({
    incomingRequest: null,
    incomingPassengerProfile: null,
  }),

  // ── Messages ─────────────────────────────────────────────────

  sendMessage: async (rideId, senderId, senderRole, message) => {
    if (!rideId || !senderId || !message) return;
    try {
      await supabase.from('ride_messages').insert({
        ride_id:     rideId,
        sender_id:   senderId,
        sender_role: senderRole,
        message,
      });
    } catch (e) {
      console.warn('sendMessage failed:', e.message);
    }
  },

  subscribeMessages: async (rideId) => {
    if (msgChannel) supabase.removeChannel(msgChannel);
    // Fetch existing messages first so both sides see full history
    try {
      const { data } = await supabase
        .from('ride_messages').select('*')
        .eq('ride_id', rideId).order('created_at', { ascending: true });
      set({ rideMessages: data ?? [] });
    } catch (_) { set({ rideMessages: [] }); }
    msgChannel = supabase.channel(`msgs-${rideId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'ride_messages', filter: `ride_id=eq.${rideId}`,
      }, (payload) => {
        set((s) => ({ rideMessages: [...s.rideMessages, payload.new] }));
      })
      .subscribe();
  },

  unsubscribeMessages: () => {
    if (msgChannel) {
      supabase.removeChannel(msgChannel);
      msgChannel = null;
    }
    set({ rideMessages: [] });
  },

  // ── Profiles ─────────────────────────────────────────────────

  fetchIncomingPassenger: async (passengerId) => {
    if (!passengerId) return;
    try {
      const { data } = await supabase
        .from('profiles').select('*').eq('id', passengerId).single();
      set({ incomingPassengerProfile: data ?? null });
    } catch (_) {}
  },

  // ── Ride lifecycle ───────────────────────────────────────────

  requestRide: async (passengerId, driverId, pickupLat, pickupLng, destinationText = '') => {
    if (!passengerId || !driverId) throw new Error('Missing passenger or driver ID');
    const { data, error } = await supabase
      .from('ride_requests')
      .insert({
        passenger_id:     passengerId,
        driver_id:        driverId,
        status:           'pending',
        pickup_lat:       pickupLat,
        pickup_lng:       pickupLng,
        destination_text: destinationText || null,
      })
      .select().single();
    if (error) throw error;

    // Fetch driver profile so passenger sees who's coming
    let driverProfile = null;
    try {
      const { data: dp } = await supabase
        .from('profiles').select('*').eq('id', driverId).single();
      driverProfile = dp ?? null;
    } catch (_) {}

    set({ activeRide: data, matchedDriverProfile: driverProfile });
    return data;
  },

  cancelRide: async (rideId) => {
    if (!rideId) return;
    try {
      await supabase.from('ride_requests')
        .update({ status: 'declined' }).eq('id', rideId);
    } catch (_) {}
    set({ activeRide: null, matchedDriverProfile: null });
  },

  respondToRide: async (rideId, accept) => {
    if (!rideId) throw new Error('Missing ride ID');
    const { data, error } = await supabase
      .from('ride_requests')
      .update({ status: accept ? 'accepted' : 'declined' })
      .eq('id', rideId).select().single();
    if (error) throw error;
    if (accept) {
      set({ activeRide: data, incomingRequest: null });
    } else {
      set({ incomingRequest: null });
    }
    return data;
  },

  completeRide: async (rideId) => {
    if (!rideId) throw new Error('Missing ride ID');
    const { data, error } = await supabase
      .from('ride_requests')
      .update({ status: 'completed' }).eq('id', rideId).select().single();
    if (error) throw error;
    set({ activeRide: null });
    return data;
  },

  confirmFare: async (rideId, amount) => {
    const fare = parseInt(amount, 10);
    if (!rideId || !fare) return;
    const { error } = await supabase
      .from('ride_requests').update({ agreed_fare: fare }).eq('id', rideId);
    if (error) throw new Error(error.message);
    set((s) => ({
      activeRide: s.activeRide ? { ...s.activeRide, agreed_fare: fare } : s.activeRide,
    }));
  },

  submitRating: async (rideId, rating) => {
    if (!rideId || !rating) return;
    try {
      await supabase.from('ride_requests').update({ rating }).eq('id', rideId);
    } catch (_) {}
  },

  fetchHistory: async (userId, role) => {
    if (!userId || !role) return;
    const column = role === 'driver' ? 'driver_id' : 'passenger_id';
    try {
      const { data } = await supabase
        .from('ride_requests').select('*')
        .eq(column, userId)
        .order('created_at', { ascending: false }).limit(50);
      set({ rideHistory: data ?? [] });
    } catch (_) {
      set({ rideHistory: [] });
    }
  },
}));
