import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { C } from '../theme/colors';

export default function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }) {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.85, duration: 760, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3,  duration: 760, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: C.surface3, opacity: anim }, style]}
    />
  );
}

export function SkeletonCard({ style }) {
  return (
    <View style={[{
      backgroundColor: C.surface, borderRadius: 20, padding: 16,
      borderWidth: 1, borderColor: C.border, gap: 12,
      shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 10, elevation: 4,
    }, style]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width={110} height={13} />
        <Skeleton width={80} height={24} borderRadius={999} />
      </View>
      <Skeleton width="100%" height={1} borderRadius={0} />
      <View style={{ gap: 8 }}>
        <Skeleton width={60} height={10} />
        <Skeleton width="92%" height={15} />
      </View>
      <View style={{ gap: 8 }}>
        <Skeleton width={80} height={10} />
        <Skeleton width="78%" height={15} />
      </View>
    </View>
  );
}
