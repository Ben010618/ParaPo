import React, { useState } from 'react';
import {
  View, Text, TextInput, Image, TouchableOpacity, StyleSheet,
  Alert, ScrollView, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../store/authStore';
import { useRideStore } from '../store/rideStore';
import { supabase } from '../lib/supabase';
import { C } from '../theme/colors';

const TRAYSIKEL_IMAGE = require('../../assets/traysikel.png');

const ROLE_CONFIG = {
  passenger: { emoji: '🤚', label: 'Pasahero', color: C.blue,   dim: C.blueDim },
  driver:    { emoji: null,  label: 'Drayber',  color: C.accent, dim: C.accentDim, useImage: true },
  admin:     { emoji: '📊', label: 'Admin',    color: C.purple, dim: 'rgba(168,85,247,0.12)' },
};

const COMMUNITY_RULES = [
  { icon: '✅', text: 'Agree on fare before the ride starts.' },
  { icon: '🚫', text: 'No-shows can result in account suspension.' },
  { icon: '🛡️', text: 'Report unsafe behavior immediately.' },
  { icon: '🤝', text: 'Treat drivers and passengers with respect.' },
  { icon: '📍', text: 'Share trip details with a trusted contact.' },
];

function SectionHeader({ title, onEdit }) {
  return (
    <View style={s.sectionHeaderRow}>
      <Text style={s.sectionHeader}>{title}</Text>
      {onEdit ? (
        <TouchableOpacity onPress={onEdit} style={s.editBtn}>
          <Text style={s.editBtnText}>✏ Edit</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function InfoRow({ label, value, last }) {
  return (
    <View style={[s.infoRow, last && { borderBottomWidth: 0 }]}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={2}>{value || '—'}</Text>
    </View>
  );
}

function LabeledInput({ label, value, onChangeText, placeholder, keyboardType }) {
  return (
    <View style={s.modalField}>
      <Text style={s.modalFieldLabel}>{label}</Text>
      <TextInput
        style={s.modalInput}
        value={value ?? ''}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={C.muted2}
        keyboardType={keyboardType ?? 'default'}
        autoCorrect={false}
      />
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
  const { profile, session, signOut, updateProfilePhoto, fetchProfile } = useAuthStore();
  const { rideHistory } = useRideStore();
  const [uploading, setUploading]       = useState({});
  const [editVisible, setEditVisible]   = useState(false);
  const [savingProfile, setSaving]      = useState(false);
  const [editData, setEditData]         = useState({});

  const handleSignOut = () => {
    Alert.alert('Mag-logout', 'Sigurado ka bang mag-logout?', [
      { text: 'Hindi', style: 'cancel' },
      { text: 'Oo, logout', style: 'destructive', onPress: signOut },
    ]);
  };

  const openEditModal = () => {
    setEditData({
      given_name:        profile?.given_name        ?? '',
      surname:           profile?.surname           ?? '',
      middle_initial:    profile?.middle_initial    ?? '',
      house_no:          profile?.house_no          ?? '',
      street:            profile?.street            ?? '',
      brgy_purok:        profile?.brgy_purok        ?? '',
      city_municipality: profile?.city_municipality ?? '',
      province:          profile?.province          ?? '',
      zip_code:          profile?.zip_code          ?? '',
    });
    setEditVisible(true);
  };

  const handleSaveProfile = async () => {
    const userId = session?.user?.id;
    if (!userId) { Alert.alert('Error', 'Session expired. Please log in again.'); return; }
    setSaving(true);
    try {
      const fullName = [
        editData.given_name,
        editData.middle_initial ? `${editData.middle_initial}.` : null,
        editData.surname,
      ].filter(Boolean).join(' ') || profile?.name;

      const { error } = await supabase.from('profiles').update({
        given_name:        editData.given_name        || null,
        surname:           editData.surname           || null,
        middle_initial:    editData.middle_initial    || null,
        house_no:          editData.house_no          || null,
        street:            editData.street            || null,
        brgy_purok:        editData.brgy_purok        || null,
        city_municipality: editData.city_municipality || null,
        province:          editData.province          || null,
        zip_code:          editData.zip_code          || null,
        name: fullName,
      }).eq('id', userId);

      if (error) throw new Error(error.message);
      await fetchProfile(userId);
      setEditVisible(false);
      Alert.alert('Saved ✓', 'Profile updated successfully.');
    } catch (e) {
      Alert.alert('Save failed', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
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

  const set = (key) => (val) => setEditData((d) => ({ ...d, [key]: val }));

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
          <View style={s.cameraBadge}>
            {uploading[isDriver ? 'license' : 'id']
              ? <ActivityIndicator size="small" color="#000" />
              : <Text style={{ fontSize: 12 }}>📷</Text>}
          </View>
        </TouchableOpacity>
        <Text style={s.name}>{fullName}</Text>
        <View style={[s.roleBadge, { backgroundColor: rc.dim, borderColor: rc.color + '44' }]}>
          {rc.useImage ? (
            <View style={s.roleTrikeWrap}>
              <Image source={TRAYSIKEL_IMAGE} style={s.roleTrikeImg} resizeMode="contain" />
            </View>
          ) : (
            <Text style={s.roleEmoji}>{rc.emoji}</Text>
          )}
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
          {isDriver ? (
            <View style={s.statTrikeWrap}>
              <Image source={TRAYSIKEL_IMAGE} style={s.statTrikeImg} resizeMode="contain" />
            </View>
          ) : (
            <Text style={s.statVal}>🤚</Text>
          )}
          <Text style={s.statLbl}>{isDriver ? 'Driver' : 'Passenger'}</Text>
        </View>
      </View>

      {/* ── PERSONAL INFO ── */}
      <SectionHeader title="Personal Information" onEdit={openEditModal} />
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

      {/* ── COMMUNITY RULES ── */}
      <SectionHeader title="Community Rules" />
      <View style={s.rulesCard}>
        {COMMUNITY_RULES.map((rule, i) => (
          <View key={i} style={[s.ruleRow, i === COMMUNITY_RULES.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={s.ruleIcon}>{rule.icon}</Text>
            <Text style={s.ruleText}>{rule.text}</Text>
          </View>
        ))}
      </View>

      {/* ── SAFETY CARD ── */}
      <View style={s.safetyCard}>
        <Text style={s.safetyTitle}>🛡  Safety</Text>
        <Text style={s.safetySub}>
          In case of emergency, call{' '}
          <Text style={{ color: C.red, fontWeight: '700' }}>117</Text>
          {' '}(PNP) or{' '}
          <Text style={{ color: C.red, fontWeight: '700' }}>911</Text>.
        </Text>
        <Text style={[s.safetySub, { marginTop: 6 }]}>
          Violations may result in account warnings or permanent suspension.
        </Text>
      </View>

      {/* ── SIGN OUT ── */}
      <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
        <Text style={s.signOutText}>Mag-logout</Text>
      </TouchableOpacity>

      <Text style={s.footer}>ParaPo v1.0.0 · Para sa komunidad</Text>

      {/* ── EDIT PROFILE MODAL ── */}
      <Modal
        visible={editVisible}
        animationType="slide"
        transparent
        onRequestClose={() => !savingProfile && setEditVisible(false)}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => !savingProfile && setEditVisible(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.modalSectionLabel}>Name</Text>
              <LabeledInput label="Surname"      value={editData.surname}        onChangeText={set('surname')} />
              <LabeledInput label="Given Name"   value={editData.given_name}     onChangeText={set('given_name')} />
              <LabeledInput label="Middle Init." value={editData.middle_initial} onChangeText={set('middle_initial')} />
              <Text style={s.modalSectionLabel}>Address</Text>
              <LabeledInput label="House No."    value={editData.house_no}          onChangeText={set('house_no')} />
              <LabeledInput label="Street"       value={editData.street}            onChangeText={set('street')} />
              <LabeledInput label="Brgy / Purok" value={editData.brgy_purok}        onChangeText={set('brgy_purok')} />
              <LabeledInput label="City / Municipality" value={editData.city_municipality} onChangeText={set('city_municipality')} />
              <LabeledInput label="Province"     value={editData.province}          onChangeText={set('province')} />
              <LabeledInput label="ZIP Code"     value={editData.zip_code}          onChangeText={set('zip_code')} keyboardType="number-pad" />
            </ScrollView>
            <TouchableOpacity
              style={[s.modalSaveBtn, savingProfile && { opacity: 0.6 }]}
              onPress={handleSaveProfile}
              disabled={savingProfile}
              activeOpacity={0.8}
            >
              {savingProfile
                ? <ActivityIndicator color="#000" />
                : <Text style={s.modalSaveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 50 },

  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8, marginTop: 6, marginLeft: 2,
  },
  sectionHeader: {
    fontSize: 11, fontWeight: '700', color: C.muted,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  editBtn:     { backgroundColor: C.accentDim, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.accent + '44' },
  editBtnText: { fontSize: 11, fontWeight: '700', color: C.accent },

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
  roleEmoji:    { fontSize: 15 },
  roleTrikeWrap: {
    width: 26, height: 20, borderRadius: 5,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  roleTrikeImg: { width: 23, height: 18 },
  statTrikeWrap: {
    width: 40, height: 32, borderRadius: 8,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  statTrikeImg: { width: 36, height: 29 },
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

  // ── Community rules ───────────────────────────────────────
  rulesCard: {
    backgroundColor: C.surface, borderRadius: 18,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', marginBottom: 14,
  },
  ruleRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 13, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  ruleIcon: { fontSize: 15, marginTop: 1 },
  ruleText: { fontSize: 13, color: C.muted, flex: 1, lineHeight: 18 },

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

  // ── Edit modal ────────────────────────────────────────────
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36, maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle:  { fontSize: 17, fontWeight: '800', color: C.text },
  modalClose:  { fontSize: 18, color: C.muted, paddingHorizontal: 4 },
  modalSectionLabel: {
    fontSize: 10, fontWeight: '700', color: C.muted,
    textTransform: 'uppercase', letterSpacing: 1,
    marginTop: 12, marginBottom: 4, marginLeft: 2,
  },
  modalField:      { marginBottom: 10 },
  modalFieldLabel: { fontSize: 11, color: C.muted, marginBottom: 3, marginLeft: 2 },
  modalInput: {
    backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    padding: 13, fontSize: 14, color: C.text,
  },
  modalSaveBtn: {
    backgroundColor: C.accent, borderRadius: 14, padding: 16,
    alignItems: 'center', marginTop: 18,
  },
  modalSaveBtnText: { fontSize: 15, fontWeight: '800', color: '#000' },
});
