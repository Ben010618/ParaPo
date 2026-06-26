import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { C } from '../theme/colors';

const ACTIVITY_ICONS = { accepted: '🛺', completed: '✅', pending: '📍', declined: '❌' };

export default function AdminScreen() {
  const mountedRef = useRef(true);
  const [stats, setStats] = useState({ driversOnline: 0, activeRides: 0, ridesToday: 0, completedRides: 0 });
  const [drivers, setDrivers] = useState([]);
  const [recentRides, setRecentRides] = useState([]);
  const [activity, setActivity] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    loadAll();
    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, () => {
        if (mountedRef.current) loadDrivers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_requests' }, (p) => {
        if (!mountedRef.current) return;
        loadRides();
        if (p.new) {
          const icon = ACTIVITY_ICONS[p.new.status] ?? '📋';
          const txt = `Ride #${p.new.id?.slice(0, 6) ?? '?'} → ${p.new.status}`;
          setActivity((prev) => [{ icon, text: txt, time: 'just now', id: Date.now() }, ...prev].slice(0, 8));
        }
      })
      .subscribe();
    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const loadAll = async () => {
    await Promise.allSettled([loadDrivers(), loadRides()]);
  };

  const loadDrivers = async () => {
    try {
      const { data } = await supabase.from('driver_locations').select('*');
      if (!mountedRef.current) return;
      setDrivers(data ?? []);
      setStats((p) => ({ ...p, driversOnline: (data ?? []).length }));
    } catch (_) {}
  };

  const loadRides = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from('ride_requests')
        .select('*, profiles!ride_requests_passenger_id_fkey(name)')
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false })
        .limit(20);
      if (!mountedRef.current) return;
      const rides = data ?? [];
      setRecentRides(rides);
      setStats((p) => ({
        ...p,
        activeRides:    rides.filter((r) => r.status === 'accepted').length,
        ridesToday:     rides.filter((r) => r.status !== 'declined').length,
        completedRides: rides.filter((r) => r.status === 'completed').length,
      }));
    } catch (_) {}
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    if (mountedRef.current) setRefreshing(false);
  };

  const STAT_CARDS = [
    { icon: '🛺', val: stats.driversOnline, lbl: 'Drivers Online', color: C.green },
    { icon: '🚀', val: stats.activeRides, lbl: 'Active Rides', color: C.orange },
    { icon: '✅', val: stats.ridesToday, lbl: 'Rides Today', color: C.blue },
    { icon: '⭐', val: stats.completedRides ?? stats.ridesToday, lbl: 'Completed', color: C.accent },
  ];

  const STATUS_COLOR = { pending: C.orange, accepted: C.blue, declined: C.red, completed: C.green };

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
    >
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Control Center</Text>
          <Text style={s.headerSub}>ParaPo Operations · Real-time</Text>
        </View>
        <View style={s.liveBadge}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Stats Grid */}
      <View style={s.statsGrid}>
        {STAT_CARDS.map((card) => (
          <View key={card.lbl} style={s.statCard}>
            <Text style={s.statIcon}>{card.icon}</Text>
            <Text style={[s.statVal, { color: card.color }]}>{card.val}</Text>
            <Text style={s.statLbl}>{card.lbl}</Text>
          </View>
        ))}
      </View>

      {/* Online Drivers */}
      <View style={s.panel}>
        <View style={s.panelHeader}>
          <Text style={s.panelTitle}>Online Drivers</Text>
          <View style={s.panelBadge}>
            <Text style={s.panelBadgeText}>{drivers.length} active</Text>
          </View>
        </View>
        {drivers.length === 0 ? (
          <Text style={s.emptyText}>No drivers online right now</Text>
        ) : (
          drivers.map((d, i) => (
            <View key={d.driver_id ?? i} style={[s.driverRow, i === drivers.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={s.driverAv}><Text style={{ fontSize: 18 }}>👨</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.driverName}>Driver #{(d.driver_id ?? '?').slice(0, 8)}</Text>
                <Text style={s.driverMeta}>
                  📍 {d.lat?.toFixed(4) ?? '?'}, {d.lng?.toFixed(4) ?? '?'}
                </Text>
              </View>
              <View style={[s.statusDot, { backgroundColor: d.is_available ? C.green : C.orange }]} />
            </View>
          ))
        )}
      </View>

      {/* Live Activity */}
      <View style={s.panel}>
        <View style={s.panelHeader}>
          <Text style={s.panelTitle}>Live Activity</Text>
          <View style={s.panelBadge}>
            <Text style={s.panelBadgeText}>{activity.length} events</Text>
          </View>
        </View>
        {activity.length === 0 ? (
          <Text style={s.emptyText}>Waiting for activity…</Text>
        ) : (
          activity.map((item, i) => (
            <View key={item.id ?? i} style={[s.activityItem, i === activity.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={s.activityIcon}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.activityText}>{item.text}</Text>
                <Text style={s.activityTime}>{item.time}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Recent Rides */}
      <View style={s.panel}>
        <View style={s.panelHeader}>
          <Text style={s.panelTitle}>Recent Rides</Text>
        </View>
        {recentRides.length === 0 ? (
          <Text style={s.emptyText}>No rides today yet</Text>
        ) : (
          recentRides.slice(0, 8).map((ride, i) => {
            const color = STATUS_COLOR[ride.status] ?? C.muted;
            return (
              <View key={ride.id ?? i} style={[s.rideRow, i === Math.min(7, recentRides.length - 1) && { borderBottomWidth: 0 }]}>
                <Text style={s.rideId}>#{(ride.id ?? '?').slice(0, 6)}</Text>
                <Text style={s.rideLoc} numberOfLines={1}>
                  {ride.pickup_lat?.toFixed(3) ?? '?'}, {ride.pickup_lng?.toFixed(3) ?? '?'}
                </Text>
                <View style={[s.rideBadge, { backgroundColor: color + '20' }]}>
                  <Text style={[s.rideBadgeText, { color }]}>{ride.status}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 40 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, marginTop: 4 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: C.text },
  headerSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.greenDim, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)',
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
  liveText: { fontSize: 12, fontWeight: '700', color: C.green },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    width: '47%', backgroundColor: C.surface, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: C.border,
  },
  statIcon: { fontSize: 20, marginBottom: 8 },
  statVal: { fontSize: 26, fontWeight: '900' },
  statLbl: { fontSize: 12, color: C.muted, marginTop: 3 },

  panel: {
    backgroundColor: C.surface, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, marginBottom: 14, overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  panelTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  panelBadge: { backgroundColor: C.surface3, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  panelBadgeText: { fontSize: 12, fontWeight: '600', color: C.muted },

  emptyText: { fontSize: 13, color: C.muted, padding: 16, textAlign: 'center' },

  driverRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  driverAv: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center',
  },
  driverName: { fontSize: 13, fontWeight: '600', color: C.text },
  driverMeta: { fontSize: 11, color: C.muted, marginTop: 2 },
  statusDot: { width: 9, height: 9, borderRadius: 5 },

  activityItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  activityIcon: { fontSize: 16, width: 24, textAlign: 'center' },
  activityText: { fontSize: 13, color: C.muted },
  activityTime: { fontSize: 11, color: C.muted2, marginTop: 3 },

  rideRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  rideId: { fontSize: 12, fontWeight: '700', color: C.text, width: 64 },
  rideLoc: { flex: 1, fontSize: 12, color: C.muted },
  rideBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  rideBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
});
