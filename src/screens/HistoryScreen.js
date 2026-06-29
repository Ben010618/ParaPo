import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View, Text, Image, FlatList, StyleSheet,
  RefreshControl, TouchableOpacity, ScrollView,
} from 'react-native';
import { SkeletonCard } from '../components/Skeleton';
import * as Location from 'expo-location';
import { useAuthStore } from '../store/authStore';
import { useRideStore } from '../store/rideStore';
import { C } from '../theme/colors';

const TRAYSIKEL_IMAGE = require('../../assets/traysikel.png');

const STATUS_COLOR = {
  completed: C.green,
  accepted:  C.blue,
  pending:   C.orange,
  declined:  C.red,
};

const STATUS_LABEL = {
  completed: 'Completed',
  accepted:  'Accepted',
  pending:   'Pending',
  declined:  'Declined',
};

const FILTERS = ['All', 'Completed', 'Declined', 'Pending'];

function RideItem({ item, isLast }) {
  const [pickupAddr, setPickupAddr] = useState(null);
  const color = STATUS_COLOR[item.status] ?? C.muted;

  useEffect(() => {
    if (!item.pickup_lat || !item.pickup_lng) return;
    Location.reverseGeocodeAsync({ latitude: item.pickup_lat, longitude: item.pickup_lng })
      .then(([addr]) => {
        if (!addr) return;
        const parts = [addr.street, addr.subregion ?? addr.district, addr.city].filter(Boolean);
        if (parts.length) setPickupAddr(parts.join(', '));
      })
      .catch(() => {});
  }, []);

  const date = item.created_at
    ? new Date(item.created_at).toLocaleDateString('fil-PH', {
        weekday: 'short', month: 'short', day: 'numeric',
      })
    : '—';

  const time = item.created_at
    ? new Date(item.created_at).toLocaleTimeString('en-PH', {
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <View style={[s.card, isLast && { marginBottom: 0 }]}>
      {/* Top row: date/time + status badge */}
      <View style={s.cardTop}>
        <View>
          <Text style={s.cardDate}>{date}</Text>
          {time && <Text style={s.cardTime}>{time}</Text>}
        </View>
        <View style={[s.badge, { backgroundColor: color + '22' }]}>
          <View style={[s.badgeDot, { backgroundColor: color }]} />
          <Text style={[s.badgeText, { color }]}>{STATUS_LABEL[item.status] ?? item.status}</Text>
        </View>
      </View>

      {/* Route */}
      <View style={s.routeRow}>
        <View style={s.routeDots}>
          <View style={[s.rdot, { backgroundColor: C.blue }]} />
          <View style={s.rline} />
          <View style={[s.rdot, { backgroundColor: C.accent }]} />
        </View>
        <View style={{ flex: 1, gap: 10 }}>
          <View>
            <Text style={s.routeLabel}>PICKUP</Text>
            <Text style={s.routePlace} numberOfLines={2}>
              {pickupAddr
                ? pickupAddr
                : `${item.pickup_lat?.toFixed(4) ?? '—'}, ${item.pickup_lng?.toFixed(4) ?? '—'}`}
            </Text>
          </View>
          <View>
            <Text style={s.routeLabel}>DESTINATION</Text>
            <Text
              style={[s.routePlace, !item.destination_text && { color: C.muted2, fontWeight: '400' }]}
              numberOfLines={2}
            >
              {item.destination_text || 'Not specified'}
            </Text>
          </View>
        </View>
      </View>

      {/* Fare + rating footer */}
      {(item.agreed_fare != null || item.rating != null) && (
        <View style={s.cardFooter}>
          {item.agreed_fare != null && (
            <View style={s.fareTag}>
              <Text style={s.fareTagTxt}>💰 ₱{item.agreed_fare}</Text>
            </View>
          )}
          {item.rating != null && (
            <View style={s.ratingRow}>
              <Text style={s.ratingStars}>{'⭐'.repeat(item.rating)}</Text>
              <Text style={s.ratingVal}>{item.rating}/5</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function HistoryScreen() {
  const mountedRef = useRef(true);
  const { session, profile } = useAuthStore();
  const { rideHistory, fetchHistory } = useRideStore();
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState('All');

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!session?.user?.id || !profile?.role) { setLoading(false); return; }
    load();
  }, [session?.user?.id, profile?.role]);

  const load = async () => {
    try { await fetchHistory(session.user.id, profile.role); } catch (_) {}
    if (mountedRef.current) { setLoading(false); setRefreshing(false); }
  };

  const onRefresh = () => { setRefreshing(true); load(); };

  // ── Derived stats ────────────────────────────────────────
  const stats = useMemo(() => {
    const completed = rideHistory.filter((r) => r.status === 'completed');
    const withFare  = completed.filter((r) => r.agreed_fare != null);
    const totalFare = withFare.reduce((sum, r) => sum + (r.agreed_fare ?? 0), 0);
    const rated     = completed.filter((r) => r.rating != null);
    const avgRating = rated.length
      ? (rated.reduce((s, r) => s + r.rating, 0) / rated.length).toFixed(1)
      : null;
    return { total: rideHistory.length, completed: completed.length, totalFare: withFare.length ? totalFare : null, avgRating };
  }, [rideHistory]);

  // ── Filtered list ────────────────────────────────────────
  const filtered = useMemo(() => {
    if (filter === 'All') return rideHistory;
    return rideHistory.filter((r) => r.status === filter.toLowerCase());
  }, [rideHistory, filter]);

  if (loading) {
    return (
      <View style={[s.root, { paddingTop: 24 }]}>
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} style={{ marginHorizontal: 16, marginBottom: 12 }} />
        ))}
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* ── Stats header ── */}
      <View style={s.statsHeader}>
        <View style={s.statItem}>
          <Text style={s.statVal}>{stats.total}</Text>
          <Text style={s.statLbl}>Total Rides</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={[s.statVal, { color: C.green }]}>{stats.completed}</Text>
          <Text style={s.statLbl}>Completed</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          {stats.totalFare != null
            ? <Text style={[s.statVal, { color: C.accent }]}>₱{stats.totalFare}</Text>
            : <Text style={[s.statVal, { color: C.accent }]}>
                {stats.avgRating ? `⭐ ${stats.avgRating}` : '—'}
              </Text>}
          <Text style={s.statLbl}>{stats.totalFare != null ? 'Total Fare' : 'Avg Rating'}</Text>
        </View>
      </View>

      {/* ── Filter tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterRow}
        style={s.filterScroll}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[s.filterTab, filter === f && s.filterTabActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.75}
          >
            <Text style={[s.filterTabTxt, filter === f && s.filterTabTxtActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── List ── */}
      {filtered.length === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyTrikeWrap}>
            <Image source={TRAYSIKEL_IMAGE} style={s.emptyTrikeImg} resizeMode="contain" />
          </View>
          <Text style={s.emptyTitle}>
            {filter === 'All' ? 'Wala pang biyahe' : `No ${filter.toLowerCase()} rides`}
          </Text>
          <Text style={s.emptyText}>
            {filter === 'All'
              ? 'Your ride history will appear here'
              : `No rides with status "${filter}" yet`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id ?? String(Math.random())}
          renderItem={({ item, index }) => (
            <RideItem item={item} isLast={index === filtered.length - 1} />
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // ── Stats header ──────────────────────────────────────────
  statsHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: 20,
    margin: 16, marginBottom: 10,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 10, elevation: 4,
  },
  statItem:    { flex: 1, padding: 16, alignItems: 'center' },
  statDivider: { width: 1, height: 36, backgroundColor: C.border },
  statVal:     { fontSize: 20, fontWeight: '900', color: C.text },
  statLbl:     { fontSize: 10, color: C.muted, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Filter tabs ───────────────────────────────────────────
  filterScroll: { flexGrow: 0 },
  filterRow:    { paddingHorizontal: 16, paddingBottom: 12, gap: 8, flexDirection: 'row' },
  filterTab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
    backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border,
  },
  filterTabActive: {
    backgroundColor: C.accentDim, borderColor: C.accent,
  },
  filterTabTxt:       { fontSize: 13, fontWeight: '600', color: C.muted },
  filterTabTxtActive: { color: C.accent, fontWeight: '800' },

  // ── Ride card ─────────────────────────────────────────────
  card: {
    backgroundColor: C.surface, borderRadius: 20,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 10, elevation: 4,
  },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 14,
  },
  cardDate: { fontSize: 13, color: C.text, fontWeight: '700' },
  cardTime: { fontSize: 11, color: C.muted, marginTop: 2 },

  badge:     { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  badgeDot:  { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },

  routeRow:   { flexDirection: 'row', gap: 12 },
  routeDots:  { alignItems: 'center', paddingTop: 4 },
  rdot:       { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff' },
  rline:      { width: 2, flex: 1, backgroundColor: C.divider, marginVertical: 4 },
  routeLabel: { fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 2 },
  routePlace: { fontSize: 14, fontWeight: '600', color: C.text, lineHeight: 20 },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.divider,
  },
  fareTag: {
    backgroundColor: C.accentDim, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: C.accent + '44',
  },
  fareTagTxt:  { fontSize: 12, fontWeight: '800', color: C.accent },
  ratingRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  ratingStars: { fontSize: 13 },
  ratingVal:   { fontSize: 12, color: C.muted, fontWeight: '600' },

  // ── Empty state ───────────────────────────────────────────
  empty:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTrikeWrap: {
    width: 120, height: 96, borderRadius: 28,
    backgroundColor: C.accentDim,
    borderWidth: 1.5, borderColor: 'rgba(255,193,7,0.45)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#FFC107', shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
  },
  emptyTrikeImg: { width: 106, height: 84 },
  emptyTitle:    { fontSize: 18, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  emptyText:     { fontSize: 13, color: C.muted, marginTop: 6 },
});
