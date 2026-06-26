import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { C } from '../theme/colors';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef(null);
  const { signIn, fetchProfile } = useAuthStore();

  const handleLogin = async () => {
    const trimEmail = email.trim().toLowerCase();
    if (!trimEmail || !password) {
      Alert.alert('Kulang', 'Ilagay ang email at password.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(trimEmail)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const { session } = await signIn(trimEmail, password);
      if (session?.user?.id) await fetchProfile(session.user.id);
    } catch (e) {
      Alert.alert('Login failed', e?.message ?? 'Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={s.inner} keyboardShouldPersistTaps="handled">
        <Image source={require('../../assets/icon.png')} style={s.logo} resizeMode="contain" />
        <Text style={s.tagline}>Mag-login para magsimula</Text>

        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor={C.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          editable={!loading}
        />
        <TextInput
          ref={passwordRef}
          style={s.input}
          placeholder="Password"
          placeholderTextColor={C.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleLogin}
          editable={!loading}
        />

        <TouchableOpacity
          style={[s.btn, loading && s.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#000" />
            : <Text style={s.btnText}>Mag-login</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('SignUp')} disabled={loading}>
          <Text style={s.link}>
            Wala pang account? <Text style={s.linkBold}>Mag-sign up</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  logo: { width: 180, height: 180, alignSelf: 'center', marginBottom: 16, borderRadius: 36 },
  tagline: { fontSize: 14, textAlign: 'center', color: C.muted, marginBottom: 36, marginTop: 2 },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: 14,
    padding: 16, fontSize: 15, marginBottom: 12,
    backgroundColor: C.surface, color: C.text,
  },
  btn: {
    backgroundColor: C.accent, borderRadius: 14,
    padding: 17, alignItems: 'center', marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#000', fontWeight: '800', fontSize: 16 },
  link: { textAlign: 'center', marginTop: 22, color: C.muted, fontSize: 14 },
  linkBold: { color: C.accent, fontWeight: '700' },
});
