import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Image, StatusBar,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../store/authStore';
import { C, SHADOW, R } from '../theme/colors';

const ICON  = require('../../assets/icon.png');
const TRIKE = require('../../assets/traysikel.png');

// ── Step progress bar ─────────────────────────────────────────
function StepBar({ step, total }) {
  return (
    <View style={sb.row}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={sb.track}>
          <View style={[
            sb.fill,
            i < step - 1 && sb.fillDone,
            i === step - 1 && sb.fillActive,
          ]} />
        </View>
      ))}
    </View>
  );
}
const sb = StyleSheet.create({
  row:        { flexDirection: 'row', gap: 6, marginBottom: 24 },
  track:      { flex: 1, height: 6, borderRadius: 999, backgroundColor: C.surface3, overflow: 'hidden' },
  fill:       { height: '100%', borderRadius: 999, width: '0%' },
  fillDone:   { width: '100%', backgroundColor: C.green },
  fillActive: {
    width: '100%', backgroundColor: C.accent,
    shadowColor: '#FFC107', shadowOpacity: 0.7, shadowRadius: 6, elevation: 4,
  },
});

// ── Password strength indicator ───────────────────────────────
function PasswordStrength({ password }) {
  if (!password) return null;
  const len     = password.length;
  const hasUpper = /[A-Z]/.test(password);
  const hasNum   = /[0-9]/.test(password);
  const hasSpec  = /[^A-Za-z0-9]/.test(password);
  const score = (len >= 8 ? 1 : 0) + (len >= 12 ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNum ? 1 : 0) + (hasSpec ? 1 : 0);

  const levels = [
    { label: 'Too short', color: C.red,     minScore: 0 },
    { label: 'Weak',      color: C.warning,  minScore: 1 },
    { label: 'Fair',      color: C.orange,   minScore: 2 },
    { label: 'Good',      color: C.blue,     minScore: 3 },
    { label: 'Strong',    color: C.green,    minScore: 4 },
  ];
  const level = [...levels].reverse().find((l) => score >= l.minScore) ?? levels[0];
  const bars  = Math.max(1, Math.min(4, score));

  return (
    <View style={ps.wrap}>
      <View style={ps.bars}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={[ps.bar, i <= bars && { backgroundColor: level.color }]} />
        ))}
      </View>
      <Text style={[ps.label, { color: level.color }]}>{level.label}</Text>
    </View>
  );
}
const ps = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -6, marginBottom: 10 },
  bars:  { flexDirection: 'row', gap: 4, flex: 1 },
  bar:   { flex: 1, height: 4, borderRadius: 999, backgroundColor: C.surface3 },
  label: { fontSize: 11, fontWeight: '700', minWidth: 56, textAlign: 'right' },
});

// ── Labeled field ─────────────────────────────────────────────
function Field({ label, value, onChangeText, placeholder, keyboardType, maxLength, secureTextEntry }) {
  return (
    <View style={f.wrap}>
      <Text style={f.label}>{label}</Text>
      <TextInput
        style={f.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={C.muted2}
        keyboardType={keyboardType ?? 'default'}
        maxLength={maxLength}
        secureTextEntry={secureTextEntry}
        autoCorrect={false}
      />
    </View>
  );
}
const f = StyleSheet.create({
  wrap:  { marginBottom: 10 },
  label: { fontSize: 10, color: C.muted, marginBottom: 7, fontWeight: '800', letterSpacing: 1.8, textTransform: 'uppercase' },
  input: {
    backgroundColor: C.surface3,
    borderRadius: R.md, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 14, color: C.text,
  },
});

// ── Photo upload box ──────────────────────────────────────────
function PhotoBox({ label, asset, onPick, disabled }) {
  return (
    <TouchableOpacity
      style={[ph.box, asset && ph.boxFilled]}
      onPress={onPick}
      disabled={disabled}
      activeOpacity={0.8}
    >
      {asset ? (
        <>
          <Image source={{ uri: asset.uri }} style={ph.img} resizeMode="cover" />
          <View style={ph.tick}><Text style={ph.tickTxt}>✓</Text></View>
        </>
      ) : (
        <View style={ph.placeholder}>
          <View style={ph.iconCircle}>
            <Text style={ph.iconEmoji}>📷</Text>
          </View>
          <Text style={ph.placeholderTxt}>{label}</Text>
          <Text style={ph.tapTxt}>Tap to upload</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
const ph = StyleSheet.create({
  box: {
    height: 140, borderRadius: R.lg,
    borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed',
    backgroundColor: C.surface2, marginBottom: 12,
    overflow: 'hidden', justifyContent: 'center', alignItems: 'center',
  },
  boxFilled:      { borderColor: C.green, borderStyle: 'solid', borderWidth: 1.5 },
  img:            { width: '100%', height: '100%' },
  placeholder:    { alignItems: 'center', gap: 8 },
  iconCircle:     { width: 52, height: 52, borderRadius: 26, backgroundColor: C.surface3, alignItems: 'center', justifyContent: 'center' },
  iconEmoji:      { fontSize: 24 },
  placeholderTxt: { fontSize: 13, color: C.muted, fontWeight: '700' },
  tapTxt:         { fontSize: 11, color: C.muted2 },
  tick: {
    position: 'absolute', top: 10, right: 10,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.green, alignItems: 'center', justifyContent: 'center',
  },
  tickTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },
});

// ── Main screen ───────────────────────────────────────────────
export default function SignUpScreen({ navigation }) {
  const [step, setStep] = useState(1);

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState('passenger');

  const [surname,          setSurname]          = useState('');
  const [givenName,        setGivenName]        = useState('');
  const [middleInitial,    setMiddleInitial]     = useState('');
  const [houseNo,          setHouseNo]          = useState('');
  const [street,           setStreet]           = useState('');
  const [brgyPurok,        setBrgyPurok]        = useState('');
  const [cityMunicipality, setCityMunicipality] = useState('');
  const [province,         setProvince]         = useState('');
  const [zipCode,          setZipCode]          = useState('');

  const [idPhoto,      setIdPhoto]      = useState(null);
  const [licensePhoto, setLicensePhoto] = useState(null);
  const [plateNumber,  setPlateNumber]  = useState('');
  const [todaLocation, setTodaLocation] = useState('');
  const [platePhoto,   setPlatePhoto]   = useState(null);

  const [loading,  setLoading]  = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef(null);
  const { signUp } = useAuthStore();

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  const startCooldown = (secs) => {
    let s = secs;
    setCooldown(s);
    cooldownRef.current = setInterval(() => {
      s -= 1; setCooldown(s);
      if (s <= 0) { clearInterval(cooldownRef.current); cooldownRef.current = null; }
    }, 1000);
  };

  const pickPhoto = async (setter) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow photo library access.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.75,
    });
    if (!res.canceled && res.assets?.[0]) setter(res.assets[0]);
  };

  const validateStep1 = () => {
    const e = email.trim().toLowerCase();
    if (!e || !password)               return 'Punan ang email at password.';
    if (!/\S+@\S+\.\S+/.test(e))      return 'Invalid email address.';
    if (password.length < 6)           return 'Password must be at least 6 characters.';
    return null;
  };

  const validateStep2 = () => {
    if (!surname.trim())          return 'Ilagay ang iyong Surname.';
    if (!givenName.trim())        return 'Ilagay ang iyong Given Name.';
    if (!street.trim())           return 'Ilagay ang Street.';
    if (!brgyPurok.trim())        return 'Ilagay ang Brgy / Purok.';
    if (!cityMunicipality.trim()) return 'Ilagay ang City / Municipality.';
    if (!province.trim())         return 'Ilagay ang Province.';
    return null;
  };

  const validateStep3 = () => {
    if (role === 'passenger' && !idPhoto)            return 'Please upload a Valid ID photo.';
    if (role === 'driver'    && !licensePhoto)        return "Please upload your Driver's License.";
    if (role === 'driver'    && !plateNumber.trim())  return 'Please enter your plate number.';
    if (role === 'driver'    && !todaLocation.trim()) return 'Please enter your TODA location.';
    if (role === 'driver'    && !platePhoto)          return 'Please upload your tricycle plate photo.';
    return null;
  };

  const nextStep = () => {
    const err = step === 1 ? validateStep1() : validateStep2();
    if (err) { Alert.alert('Kulang', err); return; }
    setStep((s) => s + 1);
  };

  const handleSignUp = async () => {
    if (loading || cooldown > 0) return;
    const err = validateStep3();
    if (err) { Alert.alert('Kulang', err); return; }
    setLoading(true);
    try {
      await signUp(
        email.trim().toLowerCase(), password,
        {
          surname: surname.trim(), given_name: givenName.trim(),
          middle_initial: middleInitial.trim(), role,
          house_no: houseNo.trim(), street: street.trim(),
          brgy_purok: brgyPurok.trim(), city_municipality: cityMunicipality.trim(),
          province: province.trim(), zip_code: zipCode.trim(),
          plate_number: plateNumber.trim() || null,
          toda_location: todaLocation.trim() || null,
        },
        { idPhoto, licensePhoto, platePhoto },
      );
      Alert.alert(
        'Matagumpay!',
        'Account created! You can now log in.',
        [{ text: 'Mag-login', onPress: () => navigation.navigate('Login') }],
      );
    } catch (e) {
      const msg = e?.message ?? '';
      const match = msg.match(/after (\d+) seconds/i);
      if (match) startCooldown(parseInt(match[1], 10));
      Alert.alert('Sign up failed', msg || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = loading || cooldown > 0;
  const stepTitles = ['Account Setup', 'Personal Info', 'Verification'];

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView
        contentContainerStyle={s.inner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header ── */}
        <View style={s.header}>
          {step === 1 && (
            <TouchableOpacity
              style={s.backLink}
              onPress={() => navigation.navigate('Login')}
              disabled={isDisabled}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={s.backLinkTxt}>← Login</Text>
            </TouchableOpacity>
          )}
          {step > 1 && (
            <TouchableOpacity
              style={s.backLink}
              onPress={() => setStep((s) => s - 1)}
              disabled={isDisabled}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={s.backLinkTxt}>← Back</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Logo ── */}
        <View style={s.logoRow}>
          <View style={s.logoRing}>
            <Image source={ICON} style={s.logo} resizeMode="cover" />
          </View>
          <View>
            <Text style={s.brand}>Para Po!</Text>
            <Text style={s.brandSub}>Bagong Account</Text>
          </View>
        </View>

        {/* ── Step label + bar ── */}
        <Text style={s.stepLabel}>STEP {step} OF 3 · {stepTitles[step - 1].toUpperCase()}</Text>
        <StepBar step={step} total={3} />

        {/* ── STEP 1: Account ── */}
        {step === 1 && (
          <View style={s.section}>
            <Field label="Email Address" value={email} onChangeText={setEmail} placeholder="you@email.com" keyboardType="email-address" />
            <Field label="Password (min 6 chars)" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
            <PasswordStrength password={password} />

            <Text style={s.sectionLabel}>Ikaw ay isang:</Text>
            <View style={s.roleRow}>
              {/* Passenger card */}
              <TouchableOpacity
                style={[s.roleCard, role === 'passenger' && s.roleCardActive]}
                onPress={() => setRole('passenger')}
                disabled={isDisabled}
                activeOpacity={0.8}
              >
                <View style={[s.roleIconCircle, role === 'passenger' && { backgroundColor: C.accentDim, borderColor: C.accent }]}>
                  <Text style={{ fontSize: 28 }}>🤚</Text>
                </View>
                <Text style={[s.roleCardTitle, role === 'passenger' && { color: C.accent }]}>Pasahero</Text>
                <Text style={s.roleCardDesc}>I need a ride</Text>
                {role === 'passenger' && <View style={s.roleCheck}><Text style={s.roleCheckTxt}>✓</Text></View>}
              </TouchableOpacity>

              {/* Driver card — shows traysikel.png prominently */}
              <TouchableOpacity
                style={[s.roleCard, role === 'driver' && s.roleCardActive]}
                onPress={() => setRole('driver')}
                disabled={isDisabled}
                activeOpacity={0.8}
              >
                <View style={[s.roleIconCircle, s.roleTrikeCircle, role === 'driver' && { backgroundColor: C.accentDim, borderColor: C.accent }]}>
                  <Image source={TRIKE} style={s.roleTrikeImg} resizeMode="contain" />
                </View>
                <Text style={[s.roleCardTitle, role === 'driver' && { color: C.accent }]}>Drayber</Text>
                <Text style={s.roleCardDesc}>I offer rides</Text>
                {role === 'driver' && <View style={s.roleCheck}><Text style={s.roleCheckTxt}>✓</Text></View>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── STEP 2: Personal Info ── */}
        {step === 2 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Full Name</Text>
            <View style={s.nameRow}>
              <View style={{ flex: 2 }}>
                <Field label="Surname *"    value={surname}       onChangeText={setSurname}       placeholder="Last name" />
              </View>
              <View style={{ flex: 2 }}>
                <Field label="Given Name *" value={givenName}     onChangeText={setGivenName}     placeholder="First name" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="M.I."         value={middleInitial} onChangeText={setMiddleInitial} placeholder="M.I." maxLength={2} />
              </View>
            </View>

            <Text style={s.sectionLabel}>Home Address</Text>
            <Field label="House No."             value={houseNo}          onChangeText={setHouseNo}          placeholder="Blk/Lot/House" />
            <Field label="Street *"              value={street}           onChangeText={setStreet}           placeholder="Street name" />
            <Field label="Brgy / Purok *"        value={brgyPurok}        onChangeText={setBrgyPurok}        placeholder="Barangay or Purok" />
            <Field label="City / Municipality *" value={cityMunicipality} onChangeText={setCityMunicipality} placeholder="City or Municipality" />
            <Field label="Province *"            value={province}         onChangeText={setProvince}         placeholder="Province" />
            <Field label="Zip Code"              value={zipCode}          onChangeText={setZipCode}          placeholder="Zip code" keyboardType="numeric" maxLength={4} />
          </View>
        )}

        {/* ── STEP 3: Verification ── */}
        {step === 3 && (
          <View style={s.section}>
            {/* Notice banner */}
            <View style={s.noticeBanner}>
              <Text style={s.noticeBannerTxt}>
                All photos below are{' '}
                <Text style={{ fontWeight: '900', color: C.accent }}>required</Text>
                {' '}before creating your account.
              </Text>
            </View>

            {role === 'passenger' && (
              <>
                <Text style={s.sectionLabel}>Valid Government ID <Text style={{ color: C.red }}>*</Text></Text>
                <Text style={s.hint}>Upload a clear government-issued ID (front face visible).</Text>
                <PhotoBox label="Valid ID Photo" asset={idPhoto} onPick={() => pickPhoto(setIdPhoto)} disabled={isDisabled} />
              </>
            )}

            {role === 'driver' && (
              <>
                {/* Traysikel.png callout for driver */}
                <View style={s.driverCallout}>
                  <View style={s.driverCalloutTrike}>
                    <Image source={TRIKE} style={s.driverCalloutTrikeImg} resizeMode="contain" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.driverCalloutTitle}>Driver Verification</Text>
                    <Text style={s.driverCalloutSub}>Complete all fields to start accepting rides in Calauan.</Text>
                  </View>
                </View>

                <Text style={s.sectionLabel}>Driver's License <Text style={{ color: C.red }}>*</Text></Text>
                <Text style={s.hint}>Front side, clearly readable.</Text>
                <PhotoBox label="Driver's License" asset={licensePhoto} onPick={() => pickPhoto(setLicensePhoto)} disabled={isDisabled} />

                <Text style={s.sectionLabel}>Vehicle Information <Text style={{ color: C.red }}>*</Text></Text>
                <Field label="Plate Number *"         value={plateNumber}  onChangeText={setPlateNumber}  placeholder="e.g. ABC-1234" />
                <Field label="TODA Member Location *" value={todaLocation} onChangeText={setTodaLocation} placeholder="e.g. Brgy. San Jose TODA" />

                <Text style={s.hint}>Upload a clear photo of your tricycle's plate.</Text>
                <PhotoBox label="Tricycle Plate Photo" asset={platePhoto} onPick={() => pickPhoto(setPlatePhoto)} disabled={isDisabled} />
              </>
            )}

            <View style={s.privacyNote}>
              <Text style={s.privacyNoteTxt}>
                🛡  Your information is private and used only for safety verification within Para Po!.
              </Text>
            </View>
          </View>
        )}

        {/* ── Action buttons ── */}
        <View style={s.btnRow}>
          {step < 3 ? (
            <TouchableOpacity
              style={[s.btnPrimary, isDisabled && { opacity: 0.5 }]}
              onPress={nextStep}
              disabled={isDisabled}
              activeOpacity={0.85}
            >
              <Text style={s.btnPrimaryTxt}>NEXT STEP →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.btnPrimary, isDisabled && { opacity: 0.5 }]}
              onPress={handleSignUp}
              disabled={isDisabled}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#000" />
                : <Text style={s.btnPrimaryTxt}>
                    {cooldown > 0 ? `Wait ${cooldown}s` : 'CREATE ACCOUNT'}
                  </Text>}
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={isDisabled} style={s.loginRow}>
          <Text style={s.loginTxt}>
            May account na?{'  '}
            <Text style={s.loginAccent}>Mag-login →</Text>
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: C.bg },
  inner: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 52, paddingBottom: 48 },

  // Header
  header:      { marginBottom: 12 },
  backLink:    { alignSelf: 'flex-start' },
  backLinkTxt: { color: C.accent, fontSize: 14, fontWeight: '700' },

  // Logo row
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  logoRing: {
    width: 56, height: 56, borderRadius: 16,
    borderWidth: 1.5, borderColor: 'rgba(255,193,7,0.5)',
    overflow: 'hidden', backgroundColor: C.accentDim,
  },
  logo:     { width: 56, height: 56 },
  brand:    { fontSize: 24, fontWeight: '900', color: C.accent, letterSpacing: -0.3 },
  brandSub: { fontSize: 11, color: C.muted, fontWeight: '600', letterSpacing: 0.5 },

  // Step
  stepLabel: { fontSize: 10, color: C.muted, fontWeight: '800', letterSpacing: 2, marginBottom: 10 },

  section: { marginBottom: 8 },
  sectionLabel: {
    fontSize: 10, fontWeight: '800', color: C.muted,
    letterSpacing: 1.8, textTransform: 'uppercase',
    marginTop: 14, marginBottom: 10,
  },
  hint: { fontSize: 12, color: C.muted2, marginBottom: 10, lineHeight: 18 },
  nameRow: { flexDirection: 'row', gap: 8 },

  // Role cards
  roleRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  roleCard: {
    flex: 1, padding: 16, borderRadius: R.lg,
    borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.surface2, alignItems: 'center', gap: 8,
    overflow: 'hidden',
  },
  roleCardActive: {
    borderColor: C.accent,
    backgroundColor: C.accentDim,
    ...SHADOW.glow,
  },
  roleIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.surface3,
    borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  roleTrikeCircle: { backgroundColor: C.accentDim },
  roleTrikeImg:    { width: 58, height: 46 },
  roleCardTitle:   { fontSize: 15, fontWeight: '800', color: C.text },
  roleCardDesc:    { fontSize: 11, color: C.muted, fontWeight: '500' },
  roleCheck: {
    position: 'absolute', top: 8, right: 8,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
  },
  roleCheckTxt: { color: '#000', fontSize: 12, fontWeight: '900' },

  // Driver verification callout
  driverCallout: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.accentDim, borderRadius: R.lg,
    borderWidth: 1, borderColor: 'rgba(255,193,7,0.3)',
    padding: 14, marginBottom: 16,
  },
  driverCalloutTrike:    { width: 60, height: 44, backgroundColor: C.accent, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  driverCalloutTrikeImg: { width: 54, height: 40 },
  driverCalloutTitle:    { fontSize: 14, fontWeight: '800', color: C.accent },
  driverCalloutSub:      { fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 18 },

  // Banners
  noticeBanner: {
    backgroundColor: C.accentDim, borderRadius: R.md,
    borderWidth: 1, borderColor: 'rgba(255,193,7,0.28)',
    padding: 14, marginBottom: 18,
  },
  noticeBannerTxt: { fontSize: 13, color: C.text, lineHeight: 20 },
  privacyNote: {
    backgroundColor: C.surface2, borderRadius: R.md,
    borderWidth: 1, borderColor: C.border,
    padding: 14, marginTop: 8,
  },
  privacyNoteTxt: { fontSize: 12, color: C.muted, lineHeight: 18 },

  // Buttons
  btnRow: { marginTop: 24, marginBottom: 16 },
  btnPrimary: {
    backgroundColor: C.accent, borderRadius: 999,
    paddingVertical: 17, alignItems: 'center',
    ...SHADOW.glow,
  },
  btnPrimaryTxt: { color: '#07080F', fontWeight: '900', fontSize: 15, letterSpacing: 1.5 },

  loginRow:   { alignItems: 'center' },
  loginTxt:   { fontSize: 14, color: C.muted },
  loginAccent:{ color: C.accent, fontWeight: '700' },
});
