import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useRideStore } from '../store/rideStore';
import { C } from '../theme/colors';

const STATUS_COLOR = {
  completed: C.green,
  accepted: C.blue,
  pending: C.orange,
  declined: C.red,
};

function RideItem({ item, isLast }) {
  const color = STATUS_COLOR[item.status] ?? C.muted;
  const date = item.created_at
    ? new Date(item.created_at).toLocaleDateString('fil-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  return (
    <View style={[s.card, isLast && { marginBottom: 0 }]}>
      <View style={s.cardTop}>
        <Text style={s.cardDate}>{date}</Text>
        <View style={[s.badge, { backgroundColor: color + '20' }]}>
          <Text style={[s.badgeText, { color }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={s.cardLoc}>
        📍 {item.pickup_lat?.toFixed(5) ?? '—'}, {item.pickup_lng?.toFixed(5) ?? '—'}
      </Text>
      {item.rating != null && (
        <Text style={s.cardRating}>{'⭐'.repeat(item.rating)} ({item.rating}/5)</Text>
      )}
    </View>
  );
}

export default function HistoryScreen() {
  const mountedRef = useRef(true);
  const { session, profile } = useAuthStore();
  const { rideHistory, fetchHistory } = useRideStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!session?.user?.id || !profile?.role) {
      setLoading(false);
      return;
    }
    load();
  }, [session?.user?.id, profile?.role]);

  const load = async () => {
    try {
      await fetchHistory(session.user.id, profile.role);
    } catch (_) {}
    if (mountedRef.current) {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

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
          <Text style={s.emptyIcon}>🛺</Text>
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
  root: { flex: 1, backgroundColor: C.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  title: { fontSize: 20, fontWeight: '800', color: C.text, margin: 16, marginBottom: 8 },

  card: {
    backgroundColor: C.surface, borderRadius: 14,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: C.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardDate: { fontSize: 13, color: C.muted },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardLoc: { fontSize: 13, color: C.muted2, marginBottom: 4 },
  cardRating: { fontSize: 13, color: C.orange },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  emptyText: { fontSize: 13, color: C.muted, marginTop: 6 },
});
