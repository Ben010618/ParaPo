import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, Image, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PassengerMapScreen from '../screens/PassengerMapScreen';
import DriverScreen       from '../screens/DriverScreen';
import AdminScreen        from '../screens/AdminScreen';
import HistoryScreen      from '../screens/HistoryScreen';
import ProfileScreen      from '../screens/ProfileScreen';
import OnboardingScreen   from '../screens/OnboardingScreen';
import { useAuthStore }   from '../store/authStore';
import { C, SHADOW }      from '../theme/colors';

const Tab = createBottomTabNavigator();
const TRAYSIKEL_IMAGE = require('../../assets/traysikel.png');
const ONBOARDING_KEY  = 'parapo_onboarding_v1';

// ── Generic emoji tab icon ────────────────────────────────────
function TabIcon({ emoji, focused }) {
  return (
    <View style={[ti.wrap, focused && ti.wrapActive]}>
      <Text style={[ti.emoji, focused && ti.emojiActive]}>{emoji}</Text>
      {focused && <View style={ti.dot} />}
    </View>
  );
}

// ── Traysikel map tab icon ────────────────────────────────────
function TrikeTabIcon({ focused }) {
  return (
    <View style={[ti.wrap, focused && ti.wrapActive]}>
      <View style={[ti.trikeRing, focused && ti.trikeRingActive]}>
        <Image
          source={TRAYSIKEL_IMAGE}
          style={focused ? ti.trikeImgActive : ti.trikeImg}
          resizeMode="contain"
        />
      </View>
      {focused && <View style={ti.dot} />}
    </View>
  );
}

const ti = StyleSheet.create({
  wrap:       { alignItems: 'center', paddingTop: 2, gap: 3, minWidth: 56, paddingHorizontal: 6 },
  wrapActive: { backgroundColor: 'rgba(255,193,7,0.07)', borderRadius: 14 },
  emoji:      { fontSize: 20, opacity: 0.38 },
  emojiActive:{ opacity: 1, fontSize: 21 },

  trikeRing: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,193,7,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,193,7,0.22)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  trikeRingActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
    ...SHADOW.glow,
  },
  trikeImg:       { width: 23, height: 19 },
  trikeImgActive: { width: 23, height: 19 },

  dot: {
    width: 5, height: 5, borderRadius: 999,
    backgroundColor: C.accent,
    shadowColor: C.accent, shadowOpacity: 0.9, shadowRadius: 5, elevation: 4,
  },
});

// ── Tab bar visual config ─────────────────────────────────────
const TAB_BAR_STYLE = {
  backgroundColor: C.surface,
  borderTopColor:  'rgba(255,193,7,0.12)',
  borderTopWidth:  1,
  paddingBottom:   10,
  paddingTop:      8,
  height:          66,
};

const HEADER_STYLE = {
  backgroundColor: C.surface,
  borderBottomColor: C.border,
  borderBottomWidth: 1,
  elevation: 0, shadowOpacity: 0,
};

// ── Navigator ─────────────────────────────────────────────────
export default function AppNavigator() {
  const profile = useAuthStore((s) => s.profile);
  const [onboardingDone, setOnboardingDone] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((v) => setOnboardingDone(v === 'true'));
  }, []);

  if (!profile || onboardingDone === null) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <View style={nav.splashRing}>
          <Image source={TRAYSIKEL_IMAGE} style={nav.splashTrike} resizeMode="contain" />
        </View>
        <ActivityIndicator size="large" color={C.accent} style={{ marginTop: 24 }} />
      </View>
    );
  }

  if (!onboardingDone) {
    return (
      <OnboardingScreen
        onDone={() => {
          AsyncStorage.setItem(ONBOARDING_KEY, 'true');
          setOnboardingDone(true);
        }}
      />
    );
  }

  const role = profile.role;

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle:      HEADER_STYLE,
        headerTintColor:  C.text,
        headerTitleStyle: { fontWeight: '800', color: C.text, letterSpacing: -0.3 },
        tabBarActiveTintColor:   C.accent,
        tabBarInactiveTintColor: C.muted2,
        tabBarStyle:      TAB_BAR_STYLE,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginTop: -2 },
      }}
    >
      {/* Passenger map */}
      {role === 'passenger' && (
        <Tab.Screen
          name="Map"
          component={PassengerMapScreen}
          options={{
            title: 'Para Po!',
            headerShown: false,
            tabBarLabel: 'Mapa',
            tabBarIcon: ({ focused }) => <TrikeTabIcon focused={focused} />,
          }}
        />
      )}

      {/* Driver dashboard */}
      {role === 'driver' && (
        <Tab.Screen
          name="Driver"
          component={DriverScreen}
          options={{
            title: 'Dashboard',
            headerStyle: { ...HEADER_STYLE, backgroundColor: C.bg },
            tabBarLabel: 'Dashboard',
            tabBarIcon: ({ focused }) => <TrikeTabIcon focused={focused} />,
          }}
        />
      )}

      {/* Admin panel */}
      {role === 'admin' && (
        <Tab.Screen
          name="Admin"
          component={AdminScreen}
          options={{
            title: 'Control Center',
            tabBarLabel: 'Dashboard',
            tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
          }}
        />
      )}

      {/* Shared tabs */}
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: 'Kasaysayan',
          tabBarLabel: 'History',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

const nav = StyleSheet.create({
  splashRing: {
    width: 96, height: 96, borderRadius: 28,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
    ...SHADOW.glow,
  },
  splashTrike: { width: 80, height: 62 },
});
