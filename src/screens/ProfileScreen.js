import React, { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../store/authStore';
import { useRideStore } from '../store/rideStore';
import { C } from '../theme/colors';

const ROLE_CONFIG = {
  passenger: { emoji: '🤚', label: 'Pasahero', color: C.blue,   dim: C.blueDim },
  driver:    { emoji: '🛺', label: 'Drayber',  color: C.accent, dim: C.accentDim },
  admin:     { emoji: '📊', label: 'Admin',    color: C.purple, dim: 'rgba(168,85,247,0.12)' },
};

function SectionHeader({ title }) {
  return <Text style={s.sectionHeader}>{title}</Text>;
}

function InfoRow({ label, value, last }) {
  return (
    <View style={[s.infoRow, last && { borderBottomWidth: 0 }]}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={2}>{value || '—'}</Text>
    </View>
  );
}

// Tappable photo card with "change" overlay
function PhotoCard({ uri, label, onPress, uploading }) {
  return (
    <View style={s.photoCard}>
      <View style={s.photoLabelRow}>
        <Text style={s.photoLabel}>{label}</Text>
        <TouchableOpacity
          style={s.photoChangeBtn}
          onPress={onPress}
          disabled={uploading}
          activeOpacity={0.8}
        >
          {uploading
            ? <ActivityIndicator size="small" color={C.accent} />
            : <Text style={s.photoChangeBtnText}>📷 Change</Text>}
        </TouchableOpacity>
      </View>
      {uri ? (
        <TouchableOpacity onPress={onPress} disabled={uploading} activeOpacity={0.85}>
          <Image source={{ uri }} style={s.photoImg} resizeMode="cover" />
          <View style={s.photoOverlay}>
            <Text style={s.photoOverlayText}>Tap to update</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={s.photoEmpty} onPress={onPress} disabled={uploading} activeOpacity={0.8}>
          {uploading
            ? <ActivityIndicator color={C.accent} />
            : (
              <>
                <Text style={s.photoEmptyIcon}>📷</Text>
                <Text style={s.photoEmptyText}>Tap to upload {label}</Text>
              </>
            )}
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const { profile, session, signOut, updateProfilePhoto } = useAuthStore();
  const { rideHistory } = useRideStore();
  const [uploading, setUploading] = useState({});

  const handleSignOut = () => {
    Alert.alert('Mag-logout', 'Sigurado ka bang mag-logout?', [
      { text: 'Hindi', style: 'cancel' },
      { text: 'Oo, logout', style: 'destructive', onPress: signOut },
    ]);
  };

  const pickAndUpload = async (type, label) => {
    if (!session?.user?.id) {
      Alert.alert('Session expired', 'Please log in again.');
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow access to your photo library in Settings.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.75,
      });
      if (result.canceled || !result.assets?.[0]) return;

      setUploading((p) => ({ ...p, [type]: true }));
      await updateProfilePhoto(session.user.id, type, result.assets[0]);
      Alert.alert('Updated! ✓', `${label} has been saved.`);
    } catch (e) {
      Alert.alert('Upload failed', e?.message ?? 'Please try again.');
    } finally {
      setUploading((p) => ({ ...p, [type]: false }));
    }
  };

  const role     = profile?.role ?? 'passenger';
  const rc       = ROLE_CONFIG[role] ?? ROLE_CONFIG.passenger;
  const isDriver = role === 'driver';

  const fullName = [
    profile?.given_name,
    profile?.middle_initial ? `${profile.middle_initial}.` : null,
    profile?.surname,
  ].filter(Boolean).join(' ') || profile?.name || '—';

  const initial = fullName?.[0]?.toUpperCase() ?? '?';

  const addressLine = [profile?.house_no, profile?.street, profile?.brgy_purok]
    .filter(Boolean).join(', ');
  const cityLine = [profile?.city_municipality, profile?.province, profile?.zip_code]
    .filter(Boolean).join(', ');

  const completedRides = rideHistory.filter((r) => r.status === 'completed').length;
  const ratedRides     = rideHistory.filter((r) => r.rating != null);
  const avgRating      = ratedRides.length
    ? (ratedRides.reduce((sum, r) => sum + r.rating, 0) / ratedRides.length).toFixed(1)
    : (profile?.average_rating ?? null);

  const avatarUri = isDriver ? profile?.license_photo_url : profile?.id_photo_url;
  const anyUploading = Object.values(uploading).some(Boolean);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

      {/* ── HERO ── */}
      <View style={s.heroSection}>
        <TouchableOpacity
          style={[s.avatarRing, { borderColor: rc.color + '66' }]}
          onPress={() => pickAndUpload(isDriver ? 'license' : 'id', isDriver ? "Driver's License" : 'Valid ID')}
          activeOpacity={0.85}
          disabled={anyUploading}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={s.avatarImg} />
          ) : (
            <View style={[s.avatar, { backgroundColor: rc.color }]}>
              <Text style={s.avatarText}>{initial}</Text>
            </View>
          )}
          {/* Camera badge */}
          <View style={s.cameraBadge}>
            {uploading[isDriver ? 'license' : 'id']
              ? <ActivityIndicator size="small" color="#000" />
              : <Text style={{ fontSize: 12 }}>📷</Text>}
          </View>
        </TouchableOpacity>
        <Text style={s.name}>{fullName}</Text>
        <View style={[s.roleBadge, { backgroundColor: rc.dim, borderColor: rc.color + '44' }]}>
          <Text style={s.roleEmoji}>{rc.emoji}</Text>
          <Text style={[s.roleLabel, { color: rc.color }]}>{rc.label}</Text>
        </View>
        <Text style={s.avatarHint}>Tap photo to update</Text>
      </View>

      {/* ── STATS ROW ── */}
      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={s.statVal}>{completedRides}</Text>
          <Text style={s.statLbl}>Rides</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={s.statVal}>{avgRating ? `⭐ ${avgRating}` : '—'}</Text>
          <Text style={s.statLbl}>Rating</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={s.statVal}>{isDriver ? '🛺' : '🤚'}</Text>
          <Text style={s.statLbl}>{isDriver ? 'Driver' : 'Passenger'}</Text>
        </View>
      </View>

      {/* ── PERSONAL INFO ── */}
      <SectionHeader title="Personal Information" />
      <View style={s.infoCard}>
        <InfoRow label="Surname"    value={profile?.surname} />
        <InfoRow label="Given Name" value={profile?.given_name} />
        <InfoRow label="M.I."       value={profile?.middle_initial} />
        {addressLine ? <InfoRow label="Address"         value={addressLine} /> : null}
        {cityLine    ? <InfoRow label="City / Province" value={cityLine} last={!profile?.zip_code} /> : null}
      </View>

      {/* ── DRIVER VEHICLE INFO ── */}
      {isDriver && (
        <>
          <SectionHeader title="Vehicle Information" />
          <View style={s.infoCard}>
            <InfoRow label="Plate Number"  value={profile?.plate_number} />
            <InfoRow label="TODA Location" value={profile?.toda_location} last />
          </View>
        </>
      )}

      {/* ── UPLOADED PHOTOS (tappable to change) ── */}
      <SectionHeader title="Verification Photos" />

      {!isDriver && (
        <PhotoCard
          uri={profile?.id_photo_url}
          label="Valid ID"
          uploading={!!uploading.id}
          onPress={() => pickAndUpload('id', 'Valid ID')}
        />
      )}

      {isDriver && (
        <>
          <PhotoCard
            uri={profile?.license_photo_url}
            label="Driver's License"
            uploading={!!uploading.license}
            onPress={() => pickAndUpload('license', "Driver's License")}
          />
          <PhotoCard
            uri={profile?.plate_photo_url}
            label="Plate Number Photo"
            uploading={!!uploading.plate}
            onPress={() => pickAndUpload('plate', 'Plate Number Photo')}
          />
        </>
      )}

      {/* ── SAFETY CARD ── */}
      <View style={s.safetyCard}>
        <Text style={s.safetyTitle}>🛡  Safety</Text>
        <Text style={s.safetySub}>
          In case of emergency, call{' '}
          <Text style={{ color: C.red, fontWeight: '700' }}>117</Text>
          {' '}(PNP) or{' '}
          <Text style={{ color: C.red, fontWeight: '700' }}>911</Text>.
        </Text>
      </View>

      {/* ── SIGN OUT ── */}
      <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
        <Text style={s.signOutText}>Mag-logout</Text>
      </TouchableOpacity>

      <Text style={s.footer}>ParaPo v1.0.0 · Para sa komunidad 🛺</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 50 },

  sectionHeader: {
    fontSize: 11, fontWeight: '700', color: C.muted,
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: 8, marginTop: 6, marginLeft: 2,
  },

  // ── Hero ──────────────────────────────────────────────────
  heroSection: { alignItems: 'center', paddingVertical: 24 },
  avatarRing: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 2.5, alignItems: 'center', justifyContent: 'center',
    marginBottom: 14, position: 'relative',
  },
  avatarImg: { width: 100, height: 100, borderRadius: 50 },
  avatar: {
    width: 94, height: 94, borderRadius: 47,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  avatarText: { fontSize: 38, fontWeight: '900', color: '#000' },
  cameraBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: C.bg,
  },
  avatarHint: { fontSize: 11, color: C.muted2, marginTop: 4 },
  name:       { fontSize: 22, fontWeight: '800', color: C.text, textAlign: 'center' },
  roleBadge:  {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6,
    borderWidth: 1, marginTop: 10,
  },
  roleEmoji: { fontSize: 15 },
  roleLabel: { fontWeight: '700', fontSize: 14 },

  // ── Stats ─────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row', backgroundColor: C.surface,
    borderRadius: 18, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', marginBottom: 14,
  },
  statBox:     { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statDivider: { width: 1, backgroundColor: C.border, marginVertical: 10 },
  statVal:     { fontSize: 18, fontWeight: '900', color: C.text },
  statLbl:     { fontSize: 10, color: C.muted, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Info card ─────────────────────────────────────────────
  infoCard: {
    backgroundColor: C.surface, borderRadius: 18,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 15, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  infoLabel: { fontSize: 13, color: C.muted, paddingTop: 1 },
  infoValue: { fontSize: 14, fontWeight: '600', color: C.text, maxWidth: '62%', textAlign: 'right' },

  // ── Photo card ────────────────────────────────────────────
  photoCard: {
    backgroundColor: C.surface, borderRadius: 18,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', marginBottom: 14,
  },
  photoLabelRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, paddingBottom: 10,
  },
  photoLabel:        { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 1 },
  photoChangeBtn:    { backgroundColor: C.accentDim, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: C.accent + '44' },
  photoChangeBtnText:{ fontSize: 12, color: C.accent, fontWeight: '700' },
  photoImg:          { width: '100%', height: 180, marginTop: 4 },
  photoOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', padding: 8, alignItems: 'center',
  },
  photoOverlayText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  photoEmpty: {
    height: 120, alignItems: 'center', justifyContent: 'center', gap: 8,
    borderTopWidth: 1, borderTopColor: C.border,
    backgroundColor: C.surface2, margin: 0,
  },
  photoEmptyIcon: { fontSize: 28 },
  photoEmptyText: { fontSize: 13, color: C.muted, fontWeight: '600' },

  // ── Safety card ───────────────────────────────────────────
  safetyCard: {
    backgroundColor: C.redDim, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    padding: 14, marginBottom: 14,
  },
  safetyTitle: { fontSize: 13, fontWeight: '700', color: C.red, marginBottom: 5 },
  safetySub:   { fontSize: 13, color: C.muted, lineHeight: 19 },

  // ── Sign out ──────────────────────────────────────────────
  signOutBtn: {
    backgroundColor: C.surface, borderRadius: 14,
    padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
    marginBottom: 24,
  },
  signOutText: { color: C.red, fontWeight: '700', fontSize: 15 },

  footer: { textAlign: 'center', fontSize: 12, color: C.muted2 },
});
