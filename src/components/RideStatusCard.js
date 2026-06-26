import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const STATUS_MESSAGES = {
  pending: { text: 'Naghihintay ang drayber...', color: '#B45309', bg: '#FEF9C3' },
  accepted: { text: 'Paparating na ang drayber! 🎉', color: '#15803D', bg: '#DCFCE7' },
  declined: { text: 'Hindi matanggap. Subukang muli.', color: '#B91C1C', bg: '#FEE2E2' },
  completed: { text: 'Natapos ang biyahe. Salamat!', color: '#1565C0', bg: '#EEF4FF' },
};

export default function RideStatusCard({ ride }) {
  const info = STATUS_MESSAGES[ride.status] || STATUS_MESSAGES.pending;
  return (
    <View style={[styles.card, { backgroundColor: info.bg }]}>
      <Text style={[styles.text, { color: info.color }]}>{info.text}</Text>
      <Text style={styles.sub}>Status: {ride.status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', bottom: 32, left: 16, right: 16, borderRadius: 14, padding: 16, elevation: 4 },
  text: { fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  sub: { fontSize: 12, textAlign: 'center', color: '#555', textTransform: 'capitalize' },
});
