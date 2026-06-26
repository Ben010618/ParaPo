import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, ActivityIndicator } from 'react-native';
import PassengerMapScreen from '../screens/PassengerMapScreen';
import DriverScreen from '../screens/DriverScreen';
import AdminScreen from '../screens/AdminScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { useAuthStore } from '../store/authStore';
import { C } from '../theme/colors';

const Tab = createBottomTabNavigator();

function TabIcon({ emoji, focused }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 2 }}>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>
    </View>
  );
}

const TAB_BAR_STYLE = {
  backgroundColor: C.surface,
  borderTopColor: C.border,
  borderTopWidth: 1,
  paddingBottom: 8,
  paddingTop: 6,
  height: 62,
};

const HEADER_STYLE = {
  backgroundColor: C.surface,
  borderBottomColor: C.border,
  borderBottomWidth: 1,
  elevation: 0,
  shadowOpacity: 0,
};

export default function AppNavigator() {
  const profile = useAuthStore((s) => s.profile);

  // profile is always pre-filled from session metadata before this renders,
  // so this guard is just a safety net for unexpected null state.
  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  const role = profile.role;

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: HEADER_STYLE,
        headerTintColor: C.text,
        headerTitleStyle: { fontWeight: '700', color: C.text },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: TAB_BAR_STYLE,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      {/* Passenger */}
      {role === 'passenger' && (
        <Tab.Screen
          name="Map"
          component={PassengerMapScreen}
          options={{
            title: 'ParaPo 🛺',
            headerShown: false,
            tabBarLabel: 'Mapa',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🗺️" focused={focused} />,
          }}
        />
      )}

      {/* Driver */}
      {role === 'driver' && (
        <Tab.Screen
          name="Driver"
          component={DriverScreen}
          options={{
            title: 'Dashboard',
            tabBarLabel: 'Dashboard',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🛺" focused={focused} />,
          }}
        />
      )}

      {/* Admin */}
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
