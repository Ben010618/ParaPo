import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, Image, StatusBar, Linking,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { C, SHADOW } from '../theme/colors';

const ICON  = require('../../assets/icon.png');
const TRIKE = require('../../assets/traysikel.png');

// Auth steps
const STEP = { PHONE: 'phone', OTP: 'otp', EMAIL: 'email' };

export default function LoginScreen({ navigation }) {
  const [step,      setStep]      = useState(STEP.PHONE);
  const [phone,     setPhone]     = useState('');
  const [otp,       setOtp]       = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [pwVisible, setPwVisible] = useState(false);

  const passwordRef = useRef(null);

  const { signIn, signInWithPhone, verifyOtp, signInWithGoogle, fetchProfile } = useAuthStore();

  // ── Format phone with +63 prefix ──
  const formatPhone = (raw) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('63')) return `+${digits}`;
    if (digits.startsWith('0'))  return `+63${digits.slice(1)}`;
    return `+63${digits}`;
  };

  // ── Phone OTP: step 1 — send OTP ──
  const handleSendOtp = async () => {
    const formatted = formatPhone(phone);
    if (formatted.length < 12) {
      Alert.alert('Invalid number', 'Enter a valid Philippine mobile number (e.g. 09171234567).');
      return;
    }
    setLoading(true);
    try {
      await signInWithPhone(formatted);
      setStep(STEP.OTP);
    } catch (err) {
      Alert.alert('OTP Error', err?.message ?? 'Could not send OTP. Check the number and try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Phone OTP: step 2 — verify OTP ──
  const handleVerifyOtp = async () => {
    if (otp.length < 6) { Alert.alert('Incomplete', 'Enter the 6-digit code sent to your phone.'); return; }
    setLoading(true);
    try {
      const { session } = await verifyOtp(formatPhone(phone), otp);
      if (session?.user?.id) await fetchProfile(session.user.id);
    } catch (err) {
      Alert.alert('Verification failed', err?.message ?? 'Wrong code or it has expired. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Google OAuth ──
  const handleGoogle = async () => {
    setLoading(true);
    try {
      const url = await signInWithGoogle();
      if (url) await Linking.openURL(url);
    } catch (err) {
      Alert.alert('Google Sign-In', err?.message ?? 'Could not open Google sign-in. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Email/password ──
  const handleEmailLogin = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !password) { Alert.alert('Kulang', 'Ilagay ang email at password.'); return; }
    if (!/\S+@\S+\.\S+/.test(e)) { Alert.alert('Invalid email', 'Please enter a valid email address.'); return; }
    setLoading(true);
    try {
      const { session } = await signIn(e, password);
      if (session?.user?.id) await fetchProfile(session.user.id);
    } catch (err) {
      Alert.alert('Login failed', err?.message ?? 'Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (step === STEP.OTP) { setStep(STEP.PHONE); setOtp(''); }
    else if (step === STEP.EMAIL) { setStep(STEP.PHONE); }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView
        contentContainerStyle={s.inner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── HERO ── */}
        <View style={s.hero}>
          <View style={s.logoRing}>
            <View style={s.logoInner}>
              <Image source={ICON} style={s.logo} resizeMode="cover" />
            </View>
          </View>
          <View style={s.trikeBadge}>
            <Image source={TRIKE} style={s.trikeImg} resizeMode="contain" />
          </View>
          <Text style={s.brand}>Para Po!</Text>
          <Text style={s.tagline}>CALAUAN'S TRICYCLE APP</Text>
          <View style={s.liveRow}>
            <View style={s.liveDot} />
            <Text style={s.liveTxt}>Live · Calauan, Laguna 4012</Text>
          </View>
        </View>

        {/* ── FORM CARD ── */}
        <View style={s.card}>

          {/* ── BACK BUTTON (OTP / Email steps) ── */}
          {step !== STEP.PHONE && (
            <TouchableOpacity style={s.backBtn} onPress={goBack} disabled={loading}>
              <Text style={s.backTxt}>← Back</Text>
            </TouchableOpacity>
          )}

          {/* ══════════════════════════════════
              STEP: PHONE (primary)
          ══════════════════════════════════ */}
          {step === STEP.PHONE && (
            <>
              <Text style={s.cardTitle}>Mag-login</Text>
              <Text style={s.cardSub}>Enter your mobile number to continue</Text>

              {/* Phone input */}
              <Text style={s.label}>MOBILE NUMBER</Text>
              <View style={s.phoneRow}>
                <View style={s.prefixBox}>
                  <Text style={s.prefixFlag}>🇵🇭</Text>
                  <Text style={s.prefixCode}>+63</Text>
                </View>
                <TextInput
                  style={[s.input, s.phoneInput]}
                  placeholder="9171234567"
                  placeholderTextColor={C.muted2}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  onSubmitEditing={handleSendOtp}
                  editable={!loading}
                  maxLength={11}
                />
              </View>

              {/* Send OTP CTA */}
              <TouchableOpacity
                style={[s.btn, loading && s.btnDisabled]}
                onPress={handleSendOtp}
                disabled={loading}
                activeOpacity={0.82}
              >
                {loading
                  ? <ActivityIndicator color="#000" />
                  : <Text style={s.btnTxt}>SEND OTP CODE →</Text>}
              </TouchableOpacity>

              {/* Divider */}
              <View style={s.divRow}>
                <View style={s.divLine} />
                <Text style={s.divTxt}>or continue with</Text>
                <View style={s.divLine} />
              </View>

              {/* Google button */}
              <TouchableOpacity
                style={[s.googleBtn, loading && s.btnDisabled]}
                onPress={handleGoogle}
                disabled={loading}
                activeOpacity={0.88}
              >
                <View style={s.googleIcon}>
                  <Text style={s.googleG}>G</Text>
                </View>
                <Text style={s.googleTxt}>Continue with Google</Text>
              </TouchableOpacity>

              {/* Email fallback */}
              <TouchableOpacity
                style={s.emailLink}
                onPress={() => setStep(STEP.EMAIL)}
                disabled={loading}
              >
                <Text style={s.emailLinkTxt}>
                  Use email instead{' '}
                  <Text style={{ color: C.muted }}>✉️</Text>
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* ══════════════════════════════════
              STEP: OTP VERIFICATION
          ══════════════════════════════════ */}
          {step === STEP.OTP && (
            <>
              <Text style={s.cardTitle}>Enter OTP</Text>
              <Text style={s.cardSub}>
                6-digit code sent to{' '}
                <Text style={{ color: C.accent, fontWeight: '700' }}>{phone}</Text>
              </Text>

              <Text style={s.label}>ONE-TIME PASSWORD</Text>
              <TextInput
                style={[s.input, s.otpInput]}
                placeholder="••••••"
                placeholderTextColor={C.muted2}
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={handleVerifyOtp}
                editable={!loading}
                maxLength={6}
                textAlign="center"
              />

              <TouchableOpacity
                style={[s.btn, (otp.length < 6 || loading) && s.btnDisabled]}
                onPress={handleVerifyOtp}
                disabled={otp.length < 6 || loading}
                activeOpacity={0.82}
              >
                {loading
                  ? <ActivityIndicator color="#000" />
                  : <Text style={s.btnTxt}>VERIFY & LOGIN ✓</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={s.resendBtn}
                onPress={handleSendOtp}
                disabled={loading}
              >
                <Text style={s.resendTxt}>Didn't get a code? Resend →</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ══════════════════════════════════
              STEP: EMAIL / PASSWORD (fallback)
          ══════════════════════════════════ */}
          {step === STEP.EMAIL && (
            <>
              <Text style={s.cardTitle}>Email Login</Text>
              <Text style={s.cardSub}>Use your email and password</Text>

              <Text style={s.label}>EMAIL</Text>
              <TextInput
                style={s.input}
                placeholder="you@email.com"
                placeholderTextColor={C.muted2}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!loading}
              />

              <Text style={s.label}>PASSWORD</Text>
              <View style={s.inputRow}>
                <TextInput
                  ref={passwordRef}
                  style={[s.input, s.inputFlex]}
                  placeholder="••••••••"
                  placeholderTextColor={C.muted2}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!pwVisible}
                  returnKeyType="done"
                  onSubmitEditing={handleEmailLogin}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={s.eyeBtn}
                  onPress={() => setPwVisible((v) => !v)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={s.eyeTxt}>{pwVisible ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[s.btn, loading && s.btnDisabled]}
                onPress={handleEmailLogin}
                disabled={loading}
                activeOpacity={0.82}
              >
                {loading
                  ? <ActivityIndicator color="#000" />
                  : <Text style={s.btnTxt}>MAG-LOGIN</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* Sign up link (all steps) */}
          <TouchableOpacity
            onPress={() => navigation.navigate('SignUp')}
            disabled={loading}
            style={s.linkRow}
          >
            <Text style={s.linkTxt}>
              Wala pang account?{'  '}
              <Text style={s.linkAccent}>Mag-sign up →</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── FOOTER ── */}
        <View style={s.footer}>
          <View style={s.footerLine} />
          <Text style={s.footerTxt}>Para Po! v1.0 · Powered by Supabase</Text>
          <View style={s.footerLine} />
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: C.bg },
  inner: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 48 },

  // ── Hero ──
  hero: { alignItems: 'center', paddingTop: 56, paddingBottom: 28 },
  logoRing: {
    width: 120, height: 120, borderRadius: 34,
    backgroundColor: C.accentDim,
    borderWidth: 1.5, borderColor: 'rgba(255,193,7,0.55)',
    padding: 5, marginBottom: 12,
    ...SHADOW.glow,
  },
  logoInner: { flex: 1, borderRadius: 28, overflow: 'hidden' },
  logo:      { width: '100%', height: '100%' },
  trikeBadge: {
    width: 88, height: 52, backgroundColor: C.accent,
    borderRadius: 999, alignItems: 'center', justifyContent: 'center',
    marginBottom: 14, ...SHADOW.glow,
  },
  trikeImg: { width: 76, height: 46 },
  brand:   { fontSize: 38, fontWeight: '900', color: C.accent, letterSpacing: -0.5 },
  tagline: { fontSize: 10, color: C.muted, letterSpacing: 2.5, marginTop: 4, fontWeight: '700' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  liveDot: {
    width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.green,
    shadowColor: C.green, shadowOpacity: 0.8, shadowRadius: 6, elevation: 4,
  },
  liveTxt: { fontSize: 11, color: C.muted, fontWeight: '600' },

  // ── Form card ──
  card: {
    backgroundColor: C.surface, borderRadius: 24,
    borderWidth: 1, borderColor: C.border,
    padding: 24, marginBottom: 20, ...SHADOW.card,
  },
  backBtn:  { marginBottom: 16 },
  backTxt:  { fontSize: 14, fontWeight: '700', color: C.accent },
  cardTitle:{ fontSize: 22, fontWeight: '900', color: C.text, letterSpacing: -0.4 },
  cardSub:  { fontSize: 13, color: C.muted, marginTop: 4, marginBottom: 20, lineHeight: 18 },

  label: {
    fontSize: 10, fontWeight: '800', color: C.muted,
    letterSpacing: 2, marginBottom: 8, marginLeft: 2,
  },
  input: {
    backgroundColor: C.surface2,
    borderRadius: 14, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 16, paddingVertical: 15,
    fontSize: 15, color: C.text, marginBottom: 16,
  },
  inputRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  inputFlex: { flex: 1, marginBottom: 0 },
  eyeBtn:    { position: 'absolute', right: 14 },
  eyeTxt:    { fontSize: 16 },

  // Phone input
  phoneRow:   { flexDirection: 'row', gap: 10, marginBottom: 16 },
  prefixBox:  {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.surface2, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 15,
  },
  prefixFlag: { fontSize: 20 },
  prefixCode: { fontSize: 15, fontWeight: '700', color: C.text },
  phoneInput: { flex: 1, marginBottom: 0 },

  // OTP input
  otpInput: {
    fontSize: 28, fontWeight: '800', letterSpacing: 8,
    paddingVertical: 18, borderColor: C.accent, borderWidth: 1.5,
  },

  // Primary CTA
  btn: {
    backgroundColor: C.accent, borderRadius: 999,
    paddingVertical: 17, alignItems: 'center',
    marginTop: 4, ...SHADOW.glow,
  },
  btnDisabled: { opacity: 0.5 },
  btnTxt: { color: '#07080F', fontWeight: '900', fontSize: 15, letterSpacing: 1.5 },

  // Divider
  divRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  divLine:{ flex: 1, height: 1, backgroundColor: C.divider },
  divTxt: { fontSize: 12, color: C.muted, fontWeight: '600' },

  // Google button
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 999, paddingVertical: 15,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, elevation: 4,
  },
  googleIcon: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#4285F4', alignItems: 'center', justifyContent: 'center',
  },
  googleG:  { fontSize: 14, fontWeight: '900', color: '#fff' },
  googleTxt:{ fontSize: 15, fontWeight: '700', color: '#1A1A1A' },

  // Email fallback link
  emailLink:    { alignItems: 'center', marginTop: 14, paddingVertical: 8 },
  emailLinkTxt: { fontSize: 13, color: C.muted2, fontWeight: '600' },

  // Resend OTP
  resendBtn:{ alignItems: 'center', marginTop: 14 },
  resendTxt:{ fontSize: 13, color: C.accent, fontWeight: '700' },

  // Sign-up link
  linkRow:   { marginTop: 20, alignItems: 'center' },
  linkTxt:   { fontSize: 14, color: C.muted },
  linkAccent:{ color: C.accent, fontWeight: '700' },

  // ── Footer ──
  footer:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  footerLine:{ flex: 1, height: 1, backgroundColor: C.divider },
  footerTxt: { fontSize: 10, color: C.muted2, letterSpacing: 0.5 },
});
