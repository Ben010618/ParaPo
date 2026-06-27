import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';

const TRAYSIKEL_IMAGE = require('../../assets/traysikel.png');
import * as Location from 'expo-location';
import { useAuthStore } from '../store/authStore';
import { useRideStore } from '../store/rideStore';
import { C } from '../theme/colors';

const STATUS_COLOR = {
  completed: C.green,
  accepted:  C.blue,
  pending:   C.orange,
  declined:  C.red,
};

const STATUS_LABEL = {
  completed: '✅ Completed',
  accepted:  '🚗 Accepted',
  pending:   '⏳ Pending',
  declined:  '❌ Declined',
};

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
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      })
    : '—';

  return (
    <View style={[s.card, isLast && { marginBottom: 0 }]}>
      <View style={s.cardTop}>
        <Text style={s.cardDate}>{date}</Text>
        <View style={[s.badge, { backgroundColor: color + '20' }]}>
          <Text style={[s.badgeText, { color }]}>{STATUS_LABEL[item.status] ?? item.status}</Text>
        </View>
      </View>

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

      {item.rating != null && (
        <View style={s.ratingRow}>
          <Text style={s.ratingStars}>{'⭐'.repeat(item.rating)}</Text>
          <Text style={s.ratingVal}>{item.rating} / 5</Text>
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

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <Text style={s.title}>Kasaysayan ng Biyahe</Text>
      {rideHistory.length === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyTrikeWrap}>
            <Image source={TRAYSIKEL_IMAGE} style={s.emptyTrikeImg} resizeMode="contain" />
          </View>
          <Text style={s.emptyTitle}>Wala pang biyahe</Text>
          <Text style={s.emptyText}>Your ride history will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={rideHistory}
          keyExtractor={(item) => item.id ?? String(Math.random())}
          renderItem={({ item, index }) => (
            <RideItem item={item} isLast={index === rideHistory.length - 1} />
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
  root:     { flex: 1, backgroundColor: C.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  title:    { fontSize: 20, fontWeight: '800', color: C.text, margin: 16, marginBottom: 8 },

  card: {
    backgroundColor: C.surface, borderRadius: 16,
    padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: C.border,
  },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14,
  },
  cardDate:  { fontSize: 13, color: C.muted, fontWeight: '500' },
  badge:     { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  routeRow:   { flexDirection: 'row', gap: 12 },
  routeDots:  { alignItems: 'center', paddingTop: 4 },
  rdot:       { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff' },
  rline:      { width: 2, flex: 1, backgroundColor: C.border, marginVertical: 4 },
  routeLabel: { fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  routePlace: { fontSize: 14, fontWeight: '600', color: C.text, lineHeight: 20 },

  ratingRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  ratingStars: { fontSize: 14 },
  ratingVal:   { fontSize: 12, color: C.muted },

  empty:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon:     { fontSize: 52, marginBottom: 12 },
  emptyTrikeWrap: {
    width: 110, height: 88, borderRadius: 22,
    backgroundColor: C.accentDim,
    borderWidth: 1.5, borderColor: C.accent + '55',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    marginBottom: 12,
  },
  emptyTrikeImg: { width: 98, height: 78 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  emptyText:  { fontSize: 13, color: C.muted, marginTop: 6 },
});
