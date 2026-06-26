import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// Build a lightweight profile from auth user metadata — zero network, instant.
const buildQuickProfile = (user) => {
  const m = user?.user_metadata ?? {};
  const parts = [
    m.given_name,
    m.middle_initial ? `${m.middle_initial}.` : null,
    m.surname,
  ].filter(Boolean);
  return {
    id:                user.id,
    name:              parts.join(' ') || m.name || 'User',
    role:              m.role ?? 'passenger',
    given_name:        m.given_name        ?? null,
    surname:           m.surname           ?? null,
    middle_initial:    m.middle_initial    ?? null,
    house_no:          m.house_no          ?? null,
    street:            m.street            ?? null,
    brgy_purok:        m.brgy_purok        ?? null,
    city_municipality: m.city_municipality ?? null,
    province:          m.province          ?? null,
    zip_code:          m.zip_code          ?? null,
    plate_number:      m.plate_number      ?? null,
    toda_location:     m.toda_location     ?? null,
    average_rating:    null,
    is_verified:       false,
    id_photo_url:      null,
    license_photo_url: null,
    plate_photo_url:   null,
  };
};

// ── Photo upload (React Native–safe) ─────────────────────────────────────────
//
// WHY FormData + direct REST instead of supabase.storage.upload():
//   The JS SDK converts uploads to ArrayBuffer via fetch().arrayBuffer() which
//   triggers a known React Native / Hermes bridge bug on Android — the blob
//   object silently returns 0 bytes and the upload "succeeds" with an empty file.
//
// FormData with { uri, name, type } uses React Native's *native* multipart
// upload (no bridge blob) and works correctly on both iOS and Android.
//
// accessToken: pass data.session.access_token from signUp so we don't need a
//              second network round-trip; falls back to getSession() for the
//              post-signup Profile update flow.
// ─────────────────────────────────────────────────────────────────────────────
const uploadProfilePhoto = async (userId, type, asset, accessToken) => {
  if (!asset?.uri) throw new Error('No photo provided');

  // Strip query-string params ImagePicker sometimes appends to URIs
  const cleanUri = asset.uri.split('?')[0];
  const rawExt   = cleanUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const ext      = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt) ? rawExt : 'jpg';
  const mimeType = asset.mimeType ?? (ext === 'png' ? 'image/png' : 'image/jpeg');
  const path     = `${userId}/${type}.${ext}`;

  // Resolve bearer token — caller may supply one (avoids extra network call)
  let token = accessToken;
  if (!token) {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token;
  }
  if (!token) throw new Error('Not authenticated — please log in again.');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('EXPO_PUBLIC_SUPABASE_URL is not set in .env');

  // Native multipart upload — React Native converts { uri, name, type } to a
  // real file read at the OS level, no JS bridge blob needed.
  const body = new FormData();
  body.append('file', { uri: asset.uri, name: `${type}.${ext}`, type: mimeType });

  const res = await fetch(
    `${supabaseUrl}/storage/v1/object/profile-photos/${path}`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'x-upsert': 'true' },
      body,
    },
  );

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    let msg = `Upload failed (HTTP ${res.status})`;
    try { msg = JSON.parse(raw).message ?? JSON.parse(raw).error ?? msg; } catch (_) {
      if (raw) msg = raw;
    }
    throw new Error(msg);
  }

  return supabase.storage.from('profile-photos').getPublicUrl(path).data.publicUrl;
};

// Non-throwing wrapper for signup — a failed photo upload should not abort
// account creation; the user can fix it from Profile later.
const tryUploadPhoto = async (userId, type, asset, token) => {
  if (!asset) return null;
  try { return await uploadProfilePhoto(userId, type, asset, token); }
  catch (e) { console.warn(`Photo upload skipped (${type}):`, e.message); return null; }
};

// ── Store ─────────────────────────────────────────────────────────────────────
export const useAuthStore = create((set, get) => ({
  session:        null,
  profile:        null,
  loading:        true,
  profileLoading: false,

  setSession: (session) => {
    if (session?.user) {
      const existing = get().profile;
      set({ session, profile: existing ?? buildQuickProfile(session.user) });
    } else {
      set({ session, profile: null });
    }
  },

  loadSession: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({ session, profile: buildQuickProfile(session.user) });
        get().fetchProfile(session.user.id);
      } else {
        set({ session: null });
      }
    } catch (_) {}
    set({ loading: false });
  },

  fetchProfile: async (userId) => {
    if (!userId) return;
    set({ profileLoading: true });
    try {
      const { data, error } = await supabase
        .from('profiles').select('*').eq('id', userId).single();
      if (!error && data) set({ profile: data });
    } catch (_) {}
    set({ profileLoading: false });
  },

  // ── Sign up ────────────────────────────────────────────────────────────────
  // Photos are uploaded after account creation using the fresh session token.
  // If individual uploads fail they are skipped (non-fatal) and the user can
  // retry from ProfileScreen.
  signUp: async (email, password, profileData, photos = {}) => {
    const {
      surname, given_name, middle_initial, role,
      house_no, street, brgy_purok, city_municipality, province, zip_code,
      plate_number, toda_location,
    } = profileData;

    const fullName = [
      given_name,
      middle_initial ? `${middle_initial}.` : null,
      surname,
    ].filter(Boolean).join(' ');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: fullName,
          given_name, surname, middle_initial, role,
          house_no, street, brgy_purok,
          city_municipality, province, zip_code,
          plate_number:  plate_number  ?? null,
          toda_location: toda_location ?? null,
        },
      },
    });
    if (error) throw error;

    // Session is available immediately when "Confirm email" is OFF in Supabase.
    // Pass the fresh access_token so uploads don't need a second getSession() call.
    if (data?.session?.access_token && data?.user) {
      const uid   = data.user.id;
      const token = data.session.access_token;

      const [idPhotoUrl, licensePhotoUrl, platePhotoUrl] = await Promise.all([
        tryUploadPhoto(uid, 'id',      photos.idPhoto,      token),
        tryUploadPhoto(uid, 'license', photos.licensePhoto, token),
        tryUploadPhoto(uid, 'plate',   photos.platePhoto,   token),
      ]);

      try {
        await supabase.from('profiles').upsert({
          id: uid, name: fullName, role,
          surname, given_name, middle_initial,
          house_no, street, brgy_purok,
          city_municipality, province, zip_code,
          ...(role === 'driver' ? { plate_number, toda_location } : {}),
          ...(idPhotoUrl      ? { id_photo_url:      idPhotoUrl      } : {}),
          ...(licensePhotoUrl ? { license_photo_url: licensePhotoUrl } : {}),
          ...(platePhotoUrl   ? { plate_photo_url:   platePhotoUrl   } : {}),
        }, { onConflict: 'id' });
      } catch (_) {}
    }

    return data;
  },

  // ── Update a single photo from ProfileScreen ───────────────────────────────
  // Throws on any failure so the UI can show a meaningful error to the user.
  updateProfilePhoto: async (userId, type, asset) => {
    if (!userId || !asset) throw new Error('Missing user or photo.');
    const fieldMap = {
      id:      'id_photo_url',
      license: 'license_photo_url',
      plate:   'plate_photo_url',
    };
    const field = fieldMap[type];
    if (!field) throw new Error(`Unknown photo type: ${type}`);

    // uploadProfilePhoto throws — error propagates up to the UI
    const url = await uploadProfilePhoto(userId, type, asset);

    const { error } = await supabase.from('profiles').update({ [field]: url }).eq('id', userId);
    if (error) throw new Error(`DB update failed: ${error.message}`);

    set((s) => ({ profile: s.profile ? { ...s.profile, [field]: url } : s.profile }));
    return url;
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  signOut: async () => {
    try { await supabase.auth.signOut(); } catch (_) {}
    set({ session: null, profile: null });
  },
}));
