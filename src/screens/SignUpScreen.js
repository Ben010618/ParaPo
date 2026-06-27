import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../store/authStore';
import { C } from '../theme/colors';

const ROLES = [
  { label: '🤚 Pasahero', value: 'passenger', desc: 'I need a ride' },
  { label: 'Drayber',  value: 'driver',    desc: 'I offer rides' },
];

// ── Reusable field ────────────────────────────────────────────
function Field({ label, value, onChangeText, placeholder, keyboardType, maxLength, editable = true }) {
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
        editable={editable}
        autoCorrect={false}
      />
    </View>
  );
}
const f = StyleSheet.create({
  wrap:  { marginBottom: 10 },
  label: { fontSize: 12, color: C.muted, marginBottom: 4, fontWeight: '600', letterSpacing: 0.3 },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: 12,
    padding: 13, fontSize: 14,
    backgroundColor: C.surface, color: C.text,
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
        <Image source={{ uri: asset.uri }} style={ph.img} resizeMode="cover" />
      ) : (
        <View style={ph.placeholder}>
          <Text style={ph.icon}>📷</Text>
          <Text style={ph.placeholderText}>{label}</Text>
          <Text style={ph.tap}>Tap to upload</Text>
        </View>
      )}
      {asset && (
        <View style={ph.tick}>
          <Text style={{ fontSize: 14 }}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
const ph = StyleSheet.create({
  box: {
    height: 130, borderRadius: 14, borderWidth: 1.5,
    borderColor: C.border, borderStyle: 'dashed',
    backgroundColor: C.surface, marginBottom: 12,
    overflow: 'hidden', justifyContent: 'center', alignItems: 'center',
  },
  boxFilled:   { borderColor: C.green, borderStyle: 'solid' },
  img:         { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center', gap: 4 },
  icon:        { fontSize: 28 },
  placeholderText: { fontSize: 13, color: C.muted, fontWeight: '600' },
  tap:         { fontSize: 11, color: C.muted2 },
  tick: {
    position: 'absolute', top: 8, right: 8,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: C.green, alignItems: 'center', justifyContent: 'center',
  },
});

// ── Step indicator ────────────────────────────────────────────
function StepBar({ step, total }) {
  return (
    <View style={sb.row}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[sb.seg, i < step && sb.segDone, i === step - 1 && sb.segActive]} />
      ))}
    </View>
  );
}
const sb = StyleSheet.create({
  row:       { flexDirection: 'row', gap: 6, marginBottom: 20 },
  seg:       { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.surface3 },
  segDone:   { backgroundColor: C.green },
  segActive: { backgroundColor: C.accent },
});

// ── Main screen ───────────────────────────────────────────────
export default function SignUpScreen({ navigation }) {
  const [step, setStep] = useState(1);

  // Step 1
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState('passenger');

  // Step 2 — personal info
  const [surname,          setSurname]          = useState('');
  const [givenName,        setGivenName]        = useState('');
  const [middleInitial,    setMiddleInitial]     = useState('');
  const [houseNo,          setHouseNo]          = useState('');
  const [street,           setStreet]           = useState('');
  const [brgyPurok,        setBrgyPurok]        = useState('');
  const [cityMunicipality, setCityMunicipality] = useState('');
  const [province,         setProvince]         = useState('');
  const [zipCode,          setZipCode]          = useState('');

  // Step 3 — verification
  const [idPhoto,      setIdPhoto]      = useState(null);  // passenger
  const [licensePhoto, setLicensePhoto] = useState(null);  // driver
  const [plateNumber,  setPlateNumber]  = useState('');    // driver
  const [todaLocation, setTodaLocation] = useState('');    // driver
  const [platePhoto,   setPlatePhoto]   = useState(null);  // driver

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

  // ── Pick photo ────────────────────────────────────────────
  const pickPhoto = async (setter) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.75,
    });
    if (!result.canceled && result.assets?.[0]) setter(result.assets[0]);
  };

  // ── Validation ────────────────────────────────────────────
  const validateStep1 = () => {
    const e = email.trim().toLowerCase();
    if (!e || !password) return 'Punan ang email at password.';
    if (!/\S+@\S+\.\S+/.test(e)) return 'Invalid email address.';
    if (password.length < 6)    return 'Password must be at least 6 characters.';
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
    if (role === 'passenger' && !idPhoto)       return 'Please upload a Valid ID photo.';
    if (role === 'driver'    && !licensePhoto)  return "Please upload your Driver's License photo.";
    if (role === 'driver'    && !plateNumber.trim()) return 'Please enter your plate number.';
    if (role === 'driver'    && !todaLocation.trim()) return 'Please enter your TODA location.';
    if (role === 'driver'    && !platePhoto)    return 'Please upload your tricycle plate photo.';
    return null;
  };

  const nextStep = () => {
    const err = step === 1 ? validateStep1() : validateStep2();
    if (err) { Alert.alert('Kulang', err); return; }
    setStep((s) => s + 1);
  };

  // ── Submit ────────────────────────────────────────────────
  const handleSignUp = async () => {
    if (loading || cooldown > 0) return;
    const err = validateStep3();
    if (err) { Alert.alert('Kulang', err); return; }
    setLoading(true);
    try {
      await signUp(
        email.trim().toLowerCase(),
        password,
        {
          surname:          surname.trim(),
          given_name:       givenName.trim(),
          middle_initial:   middleInitial.trim(),
          role,
          house_no:         houseNo.trim(),
          street:           street.trim(),
          brgy_purok:       brgyPurok.trim(),
          city_municipality: cityMunicipality.trim(),
          province:         province.trim(),
          zip_code:         zipCode.trim(),
          plate_number:     plateNumber.trim() || null,
          toda_location:    todaLocation.trim() || null,
        },
        { idPhoto, licensePhoto, platePhoto },
      );
      Alert.alert(
        'Matagumpay! 🎉',
        'Account created! You can now log in.\n\nIf any photos did not upload, you can add them from your Profile screen after logging in.',
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

  // ── Render ────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.inner} keyboardShouldPersistTaps="handled">

        {/* Back to Login — step 1 only */}
        {step === 1 && (
          <TouchableOpacity
            style={s.headerBack}
            onPress={() => navigation.navigate('Login')}
            disabled={isDisabled}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={s.headerBackText}>← Back to Login</Text>
          </TouchableOpacity>
        )}

        {/* Header */}
        <Image source={require('../../assets/icon.png')} style={s.logo} resizeMode="contain" />
        <Text style={s.tagline}>
          {step === 1 ? 'Create your account' : step === 2 ? 'Personal information' : 'Identity verification'}
        </Text>

        <StepBar step={step} total={3} />

        {/* ── STEP 1: Account ── */}
        {step === 1 && (
          <View>
            <TextInput
              style={s.input} placeholder="Email address"
              placeholderTextColor={C.muted2} value={email} onChangeText={setEmail}
              autoCapitalize="none" keyboardType="email-address" editable={!isDisabled}
            />
            <TextInput
              style={s.input} placeholder="Password (minimum 6 characters)"
              placeholderTextColor={C.muted2} value={password} onChangeText={setPassword}
              secureTextEntry editable={!isDisabled}
            />

            <Text style={s.sectionLabel}>Ikaw ay isang:</Text>
            <View style={s.roleRow}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[s.roleBtn, role === r.value && s.roleBtnActive]}
                  onPress={() => setRole(r.value)} disabled={isDisabled} activeOpacity={0.8}
                >
                  <Text style={[s.roleBtnText, role === r.value && s.roleBtnTextActive]}>{r.label}</Text>
                  <Text style={[s.roleDesc,    role === r.value && { color: C.accent }]}>{r.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── STEP 2: Personal Info ── */}
        {step === 2 && (
          <View>
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
            <Field label="House No."            value={houseNo}          onChangeText={setHouseNo}          placeholder="Blk/Lot/House No." />
            <Field label="Street *"             value={street}           onChangeText={setStreet}           placeholder="Street name" />
            <Field label="Brgy / Purok *"       value={brgyPurok}        onChangeText={setBrgyPurok}        placeholder="Barangay or Purok" />
            <Field label="City / Municipality *" value={cityMunicipality} onChangeText={setCityMunicipality} placeholder="City or Municipality" />
            <Field label="Province *"           value={province}         onChangeText={setProvince}         placeholder="Province" />
            <Field label="Zip Code"             value={zipCode}          onChangeText={setZipCode}          placeholder="Zip code" keyboardType="numeric" maxLength={4} />
          </View>
        )}

        {/* ── STEP 3: Verification ── */}
        {step === 3 && (
          <View>
            {/* Required notice */}
            <View style={s.requiredNotice}>
              <Text style={s.requiredNoticeText}>
                📋 All photos below are <Text style={{ fontWeight: '900', color: C.accent }}>required</Text> before you can create your account.
              </Text>
            </View>

            {role === 'passenger' && (
              <>
                <Text style={s.sectionLabel}>Valid ID <Text style={{ color: C.red }}>*</Text></Text>
                <Text style={s.hint}>Upload a clear government-issued ID (front face visible).</Text>
                <PhotoBox
                  label="Valid ID Photo" asset={idPhoto}
                  onPick={() => pickPhoto(setIdPhoto)} disabled={isDisabled}
                />
              </>
            )}

            {role === 'driver' && (
              <>
                <Text style={s.sectionLabel}>Driver's License <Text style={{ color: C.red }}>*</Text></Text>
                <Text style={s.hint}>Upload your professional / non-professional driver's license (front, clearly readable).</Text>
                <PhotoBox
                  label="Driver's License" asset={licensePhoto}
                  onPick={() => pickPhoto(setLicensePhoto)} disabled={isDisabled}
                />

                <Text style={s.sectionLabel}>Vehicle Information <Text style={{ color: C.red }}>*</Text></Text>
                <Field label="Plate Number *"          value={plateNumber}  onChangeText={setPlateNumber}  placeholder="e.g. ABC-1234" />
                <Field label="TODA Member Location *"  value={todaLocation} onChangeText={setTodaLocation} placeholder="e.g. Brgy. San Jose TODA" />

                <Text style={s.hint}>Upload a clear photo of your tricycle's plate number.</Text>
                <PhotoBox
                  label="Plate Number Photo" asset={platePhoto}
                  onPick={() => pickPhoto(setPlatePhoto)} disabled={isDisabled}
                />
              </>
            )}

            <View style={s.notice}>
              <Text style={s.noticeText}>
                🛡  Your information is kept private and used only for safety and identity verification within ParaPo.
              </Text>
            </View>
          </View>
        )}

        {/* ── Navigation buttons ── */}
        <View style={s.btnRow}>
          {step > 1 && (
            <TouchableOpacity style={s.backBtn} onPress={() => setStep((s) => s - 1)} disabled={isDisabled}>
              <Text style={s.backBtnText}>← Back</Text>
            </TouchableOpacity>
          )}

          {step < 3 ? (
            <TouchableOpacity style={[s.nextBtn, step === 1 && { flex: 1 }]} onPress={nextStep} disabled={isDisabled} activeOpacity={0.85}>
              <Text style={s.nextBtnText}>Next →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.nextBtn, isDisabled && s.btnDisabled]}
              onPress={handleSignUp} disabled={isDisabled} activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#000" />
                : <Text style={s.nextBtnText}>{cooldown > 0 ? `Wait ${cooldown}s` : 'Create Account'}</Text>}
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={isDisabled}>
          <Text style={s.link}>May account na? <Text style={s.linkBold}>Mag-login</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: C.bg },
  inner: { flexGrow: 1, padding: 24, paddingTop: 40, paddingBottom: 40 },

  headerBack:     { alignSelf: 'flex-start', marginBottom: 16 },
  headerBackText: { color: C.accent, fontSize: 15, fontWeight: '700' },

  logo:    { width: 160, height: 160, alignSelf: 'center', marginBottom: 14, borderRadius: 32 },
  tagline: { fontSize: 13, textAlign: 'center', color: C.muted, marginBottom: 20, marginTop: 4 },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 6, marginBottom: 10 },
  hint:         { fontSize: 12, color: C.muted2, marginBottom: 10, lineHeight: 17 },

  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: 12,
    padding: 14, fontSize: 14, marginBottom: 10,
    backgroundColor: C.surface, color: C.text,
  },

  nameRow: { flexDirection: 'row', gap: 8 },

  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  roleBtn: {
    flex: 1, padding: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.surface, alignItems: 'center',
  },
  roleBtnActive:    { borderColor: C.accent, backgroundColor: C.accentDim },
  roleBtnText:      { color: C.muted, fontWeight: '600', fontSize: 14 },
  roleBtnTextActive:{ color: C.accent },
  roleDesc:         { fontSize: 11, color: C.muted2, marginTop: 3 },

  notice: {
    backgroundColor: C.surface2, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    padding: 14, marginTop: 8,
  },
  noticeText: { fontSize: 12, color: C.muted, lineHeight: 18 },

  requiredNotice: {
    backgroundColor: C.accentDim, borderRadius: 12,
    borderWidth: 1, borderColor: C.accent + '44',
    padding: 12, marginBottom: 14,
  },
  requiredNoticeText: { fontSize: 13, color: C.text, lineHeight: 19 },

  btnRow:    { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 16 },
  backBtn:   {
    flex: 1, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    padding: 15, alignItems: 'center', backgroundColor: C.surface,
  },
  backBtnText: { color: C.muted, fontWeight: '600' },
  nextBtn:     { flex: 2, backgroundColor: C.accent, borderRadius: 12, padding: 15, alignItems: 'center' },
  nextBtnText: { color: '#000', fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },

  link:     { textAlign: 'center', color: C.muted, fontSize: 13 },
  linkBold: { color: C.accent, fontWeight: '700' },
});
