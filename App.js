import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Linking } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { supabase } from './src/lib/supabase';
import { useAuthStore } from './src/store/authStore';
import AppNavigator from './src/navigation/AppNavigator';
import AuthNavigator from './src/navigation/AuthNavigator';
import { C } from './src/theme/colors';

// Allow notifications to show and play sound even when the app is in foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
});

const NAV_THEME = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: C.accent,
    background: C.bg,
    card: C.surface,
    text: C.text,
    border: C.border,
    notification: C.red,
  },
};

export default function App() {
  const { session, loading, loadSession, setSession, fetchProfile } = useAuthStore();

  useEffect(() => {
    loadSession();

    // Request notification permission for the driver ring feature.
    Notifications.requestPermissionsAsync().catch(() => {});

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user?.id) fetchProfile(newSession.user.id);
    });

    // Handle Google OAuth deep-link callback: parapo://auth/callback#access_token=...
    const handleDeepLink = ({ url }) => {
      if (!url) return;
      const fragment = url.split('#')[1] ?? url.split('?')[1] ?? '';
      const params = new URLSearchParams(fragment);
      const accessToken  = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (accessToken && refreshToken) {
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .catch(() => {});
      }
    };

    Linking.getInitialURL().then((url) => { if (url) handleDeepLink({ url }); }).catch(() => {});
    const urlSub = Linking.addEventListener('url', handleDeepLink);

    return () => { subscription?.unsubscribe(); urlSub.remove(); };
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer theme={NAV_THEME}>
        <StatusBar style="light" backgroundColor={C.surface} />
        {session ? <AppNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
