import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Image, TouchableOpacity, StyleSheet,
  Alert, ScrollView, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const [uploading, setUploading]         = useState({});
  const [editVisible, setEditVisible]     = useState(false);
  const [savingProfile, setSaving]        = useState(false);
  const [editData, setEditData]           = useState({});
  const [emergContact, setEmergContact]   = useState({ name: '', phone: '' });
  const [emergModal, setEmergModal]       = useState(false);
  const [emergDraft, setEmergDraft]       = useState({ name: '', phone: '' });

  useEffect(() => {
    AsyncStorage.getItem('parapo_emerg_contact').then((v) => {
      if (v) { try { setEmergContact(JSON.parse(v)); } catch (_) {} }
    });
  }, []);

  const openEmergModal = () => {
    setEmergDraft({ ...emergContact });
    setEmergModal(true);
  };

  const saveEmergContact = async () => {
    if (!emergDraft.name.trim() && !emergDraft.phone.trim()) {
      await AsyncStorage.removeItem('parapo_emerg_contact');
      setEmergContact({ name: '', phone: '' });
    } else {
      const saved = { name: emergDraft.name.trim(), phone: emergDraft.phone.trim() };
      await AsyncStorage.setItem('parapo_emerg_contact', JSON.stringify(saved));
      setEmergContact(saved);
    }
    setEmergModal(false);
  };

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

        {/* Verification status badge */}
        {profile?.is_verified ? (
          <View style={s.verifiedBadge}>
            <Text style={s.verifiedBadgeTxt}>✓ Verified Account</Text>
          </View>
        ) : (
          <View style={s.pendingBadge}>
            <Text style={s.pendingBadgeTxt}>
              {(profile?.id_photo_url || profile?.license_photo_url)
                ? '⏳ Pending Admin Review'
                : '📋 Upload documents to verify'}
            </Text>
          </View>
        )}
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

      {/* ── EMERGENCY CONTACT ── */}
      <SectionHeader title="Emergency Contact" onEdit={openEmergModal} />
      <TouchableOpacity style={s.emergCard} onPress={openEmergModal} activeOpacity={0.85}>
        {emergContact.name || emergContact.phone ? (
          <View style={s.emergContactRow}>
            <View style={s.emergAvatar}>
              <Text style={s.emergAvatarText}>
                {emergContact.name?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.emergName}>{emergContact.name || '—'}</Text>
              <Text style={s.emergPhone}>{emergContact.phone || '—'}</Text>
            </View>
            <View style={s.emergReadyBadge}>
              <Text style={s.emergReadyText}>✓ Set</Text>
            </View>
          </View>
        ) : (
          <View style={s.emergEmpty}>
            <Text style={s.emergEmptyIcon}>🆘</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.emergEmptyTitle}>No emergency contact</Text>
              <Text style={s.emergEmptyHint}>Tap to add someone to notify in an emergency</Text>
            </View>
            <Text style={s.emergAddBtn}>Add →</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ── SAFETY CARD ── */}
      <View style={s.safetyCard}>
        <Text style={s.safetyTitle}>🛡  Safety Hotlines</Text>
        <Text style={s.safetySub}>
          Emergency:{' '}
          <Text style={{ color: C.red, fontWeight: '800' }}>911</Text>
          {'  ·  '}PNP:{' '}
          <Text style={{ color: C.red, fontWeight: '800' }}>117</Text>
          {'  ·  '}BFP:{' '}
          <Text style={{ color: C.red, fontWeight: '800' }}>160</Text>
        </Text>
        <Text style={[s.safetySub, { marginTop: 6, lineHeight: 20 }]}>
          Violations may result in account warnings or permanent suspension.
        </Text>
      </View>

      {/* ── EMERGENCY CONTACT MODAL ── */}
      <Modal
        visible={emergModal}
        animationType="slide"
        transparent
        onRequestClose={() => setEmergModal(false)}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Emergency Contact</Text>
              <TouchableOpacity onPress={() => setEmergModal(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.emergModalHint}>
              This person will be shown when you tap SOS during a ride.
            </Text>
            <View style={s.modalField}>
              <Text style={s.modalFieldLabel}>Full Name</Text>
              <TextInput
                style={s.modalInput}
                value={emergDraft.name}
                onChangeText={(v) => setEmergDraft((d) => ({ ...d, name: v }))}
                placeholder="e.g. Maria Santos"
                placeholderTextColor={C.muted2}
                autoCorrect={false}
              />
            </View>
            <View style={s.modalField}>
              <Text style={s.modalFieldLabel}>Mobile Number</Text>
              <TextInput
                style={s.modalInput}
                value={emergDraft.phone}
                onChangeText={(v) => setEmergDraft((d) => ({ ...d, phone: v }))}
                placeholder="e.g. 09171234567"
                placeholderTextColor={C.muted2}
                keyboardType="phone-pad"
              />
            </View>
            <TouchableOpacity style={s.modalSaveBtn} onPress={saveEmergContact} activeOpacity={0.82}>
              <Text style={s.modalSaveBtnText}>Save Contact</Text>
            </TouchableOpacity>
            {(emergContact.name || emergContact.phone) && (
              <TouchableOpacity
                style={s.emergClearBtn}
                onPress={async () => {
                  await AsyncStorage.removeItem('parapo_emerg_contact');
                  setEmergContact({ name: '', phone: '' });
                  setEmergModal(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={s.emergClearText}>Remove Contact</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
  scroll: { padding: 18, paddingBottom: 56 },

  // ── Section headers ───────────────────────────────────────
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10, marginTop: 8, paddingHorizontal: 2,
  },
  sectionHeader: {
    fontSize: 10, fontWeight: '800', color: C.muted,
    textTransform: 'uppercase', letterSpacing: 2,
  },
  editBtn:     { backgroundColor: C.accentDim, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,193,7,0.35)' },
  editBtnText: { fontSize: 11, fontWeight: '800', color: C.accent, letterSpacing: 0.5 },

  // ── Hero ──────────────────────────────────────────────────
  heroSection: { alignItems: 'center', paddingVertical: 28 },
  avatarRing: {
    width: 116, height: 116, borderRadius: 58,
    borderWidth: 2.5, alignItems: 'center', justifyContent: 'center',
    marginBottom: 14, position: 'relative',
    shadowColor: '#FFC107', shadowOpacity: 0.35, shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },
  avatarImg: { width: 106, height: 106, borderRadius: 53 },
  avatar: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  avatarText: { fontSize: 38, fontWeight: '900', color: '#07080F' },
  cameraBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: C.bg,
    shadowColor: C.accent, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6,
  },
  avatarHint: { fontSize: 11, color: C.muted2, marginTop: 6, letterSpacing: 0.3 },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.greenDim, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 6, marginTop: 10,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.35)',
  },
  verifiedBadgeTxt: { fontSize: 12, fontWeight: '800', color: C.green, letterSpacing: 0.3 },
  pendingBadge: {
    backgroundColor: C.accentDim, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 6, marginTop: 10,
    borderWidth: 1, borderColor: 'rgba(255,193,7,0.35)',
  },
  pendingBadgeTxt: { fontSize: 12, fontWeight: '700', color: C.accent },
  name:       { fontSize: 22, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -0.3 },
  roleBadge:  {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderRadius: 999, paddingHorizontal: 18, paddingVertical: 7,
    borderWidth: 1, marginTop: 12,
  },
  roleEmoji:    { fontSize: 14 },
  roleTrikeWrap: {
    width: 28, height: 22, borderRadius: 6,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  roleTrikeImg: { width: 25, height: 19 },
  statTrikeWrap: {
    width: 44, height: 34, borderRadius: 10,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  statTrikeImg: { width: 38, height: 30 },
  roleLabel: { fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },

  // ── Stats ─────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row', backgroundColor: C.surface,
    borderRadius: 20, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  statBox:     { flex: 1, alignItems: 'center', paddingVertical: 18 },
  statDivider: { width: 1, backgroundColor: C.divider, marginVertical: 12 },
  statVal:     { fontSize: 20, fontWeight: '900', color: C.text },
  statLbl:     { fontSize: 9, color: C.muted, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },

  // ── Info card ─────────────────────────────────────────────
  infoCard: {
    backgroundColor: C.surface, borderRadius: 20,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.divider,
  },
  infoLabel: { fontSize: 12, color: C.muted, paddingTop: 1 },
  infoValue: { fontSize: 14, fontWeight: '600', color: C.text, maxWidth: '62%', textAlign: 'right' },

  // ── Photo card ────────────────────────────────────────────
  photoCard: {
    backgroundColor: C.surface, borderRadius: 20,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
  },
  photoLabelRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  photoLabel:        { fontSize: 10, fontWeight: '800', color: C.muted, textTransform: 'uppercase', letterSpacing: 2 },
  photoChangeBtn:    { backgroundColor: C.accentDim, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,193,7,0.35)' },
  photoChangeBtnText:{ fontSize: 12, color: C.accent, fontWeight: '800' },
  photoImg:          { width: '100%', height: 185, marginTop: 4 },
  photoOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', padding: 10, alignItems: 'center',
  },
  photoOverlayText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  photoEmpty: {
    height: 124, alignItems: 'center', justifyContent: 'center', gap: 8,
    borderTopWidth: 1, borderTopColor: C.divider,
    backgroundColor: C.surface2,
  },
  photoEmptyIcon: { fontSize: 28 },
  photoEmptyText: { fontSize: 13, color: C.muted, fontWeight: '600' },

  // ── Community rules ───────────────────────────────────────
  rulesCard: {
    backgroundColor: C.surface, borderRadius: 20,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', marginBottom: 16,
  },
  ruleRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: C.divider,
  },
  ruleIcon: { fontSize: 14, marginTop: 1 },
  ruleText: { fontSize: 13, color: C.muted, flex: 1, lineHeight: 18 },

  // ── Emergency contact ─────────────────────────────────────
  emergCard: {
    backgroundColor: C.surface, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(244,63,94,0.25)',
    padding: 16, marginBottom: 16,
    shadowColor: C.red, shadowOpacity: 0.12, shadowRadius: 10, elevation: 4,
  },
  emergContactRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emergAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.redDim, borderWidth: 1.5, borderColor: 'rgba(244,63,94,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  emergAvatarText: { fontSize: 18, fontWeight: '900', color: C.red },
  emergName:       { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2 },
  emergPhone:      { fontSize: 13, color: C.muted },
  emergReadyBadge: {
    backgroundColor: 'rgba(16,185,129,0.14)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
  },
  emergReadyText: { fontSize: 11, fontWeight: '800', color: C.green },
  emergEmpty:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emergEmptyIcon: { fontSize: 28 },
  emergEmptyTitle:{ fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  emergEmptyHint: { fontSize: 12, color: C.muted, lineHeight: 18 },
  emergAddBtn:    { fontSize: 13, fontWeight: '800', color: C.accent },
  emergModalHint: {
    fontSize: 12, color: C.muted, lineHeight: 18,
    marginBottom: 16, paddingHorizontal: 2,
  },
  emergClearBtn: {
    alignItems: 'center', marginTop: 12, paddingVertical: 12,
  },
  emergClearText: { fontSize: 13, color: C.red, fontWeight: '700' },

  // ── Safety card ───────────────────────────────────────────
  safetyCard: {
    backgroundColor: C.redDim, borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(244,63,94,0.22)',
    padding: 16, marginBottom: 16,
  },
  safetyTitle: { fontSize: 13, fontWeight: '800', color: C.red, marginBottom: 6 },
  safetySub:   { fontSize: 13, color: C.muted, lineHeight: 20 },

  // ── Sign out ──────────────────────────────────────────────
  signOutBtn: {
    borderRadius: 999, padding: 17, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(244,63,94,0.35)',
    backgroundColor: C.redDim, marginBottom: 28,
  },
  signOutText: { color: C.red, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  footer: { textAlign: 'center', fontSize: 11, color: C.muted2, letterSpacing: 0.5 },

  // ── Edit modal ────────────────────────────────────────────
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: C.border, borderBottomWidth: 0,
    padding: 22, paddingBottom: 40, maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 18,
  },
  modalTitle:  { fontSize: 18, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  modalClose:  { fontSize: 18, color: C.muted, paddingHorizontal: 6, paddingVertical: 2 },
  modalSectionLabel: {
    fontSize: 10, fontWeight: '800', color: C.muted,
    textTransform: 'uppercase', letterSpacing: 2,
    marginTop: 14, marginBottom: 8, marginLeft: 2,
  },
  modalField:      { marginBottom: 10 },
  modalFieldLabel: { fontSize: 10, color: C.muted, marginBottom: 6, marginLeft: 2, fontWeight: '700', letterSpacing: 1 },
  modalInput: {
    backgroundColor: C.surface3, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: C.text,
  },
  modalSaveBtn: {
    backgroundColor: C.accent, borderRadius: 999, paddingVertical: 17,
    alignItems: 'center', marginTop: 20,
    shadowColor: '#FFC107', shadowOpacity: 0.45, shadowRadius: 18,
    shadowOffset: { width: 0, height: 5 }, elevation: 8,
  },
  modalSaveBtnText: { fontSize: 15, fontWeight: '900', color: '#07080F', letterSpacing: 1 },
});
