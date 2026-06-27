import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Callout } from 'react-native-maps';

const TRAYSIKEL_IMAGE = require('../../assets/traysikel.png');

export default function DriverCallout({ driver, onHail }) {
  return (
    <Callout onPress={() => onHail(driver)} tooltip>
      <View style={styles.callout}>
        <View style={styles.iconWrap}>
          <Image source={TRAYSIKEL_IMAGE} style={styles.icon} resizeMode="contain" />
        </View>
        <Text style={styles.title}>Available Tricycle</Text>
        {driver.rating && (
          <Text style={styles.rating}>⭐ {Number(driver.rating).toFixed(1)}</Text>
        )}
        <TouchableOpacity style={styles.hailBtn} onPress={() => onHail(driver)}>
          <Text style={styles.hailText}>Hailin!</Text>
        </TouchableOpacity>
      </View>
    </Callout>
  );
}

const styles = StyleSheet.create({
  callout: { backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', minWidth: 140, elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6 },
  iconWrap: { width: 52, height: 42, backgroundColor: '#FFC107', borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6, overflow: 'hidden' },
  icon: { width: 46, height: 37 },
  title: { fontWeight: '600', color: '#1E293B', fontSize: 14, marginBottom: 2 },
  rating: { color: '#B45309', fontSize: 13, marginBottom: 8 },
  hailBtn: { backgroundColor: '#1565C0', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 8 },
  hailText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
