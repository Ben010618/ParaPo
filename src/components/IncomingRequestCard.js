import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function IncomingRequestCard({ request, onAccept, onDecline }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>🔔 Bagong Pasahero!</Text>
      <Text style={styles.detail}>
        Pickup: {request.pickup_lat?.toFixed(5)}, {request.pickup_lng?.toFixed(5)}
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.declineBtn} onPress={onDecline}>
          <Text style={styles.declineText}>Hindi</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
          <Text style={styles.acceptText}>Tanggapin ✓</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 18, elevation: 4, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#1565C0' },
  title: { fontSize: 17, fontWeight: '700', color: '#1E293B', marginBottom: 6 },
  detail: { fontSize: 13, color: '#64748B', marginBottom: 14 },
  actions: { flexDirection: 'row', gap: 10 },
  acceptBtn: { flex: 1, backgroundColor: '#1565C0', borderRadius: 10, padding: 12, alignItems: 'center' },
  acceptText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  declineBtn: { flex: 1, backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, alignItems: 'center' },
  declineText: { color: '#B91C1C', fontWeight: '700', fontSize: 14 },
});
