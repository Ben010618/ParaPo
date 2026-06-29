import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, ScrollView, Image, StatusBar, SafeAreaView, Animated,
} from 'react-native';
import { C, SHADOW, R } from '../theme/colors';

const { width: W } = Dimensions.get('window');
const TRAYSIKEL = require('../../assets/traysikel.png');
const ICON      = require('../../assets/icon.png');

const SLIDES = [
  {
    key: '1',
    headline: 'Sakay kahit saan',
    sub: 'Hindi na kailangang pumunta sa terminal.\nI-call ang traysikel diretso sa iyong pintuan.',
    detail: 'Para Po! — Calauan\'s first app-based tricycle service',
    accent: '#FFC107',
    bg:     '#0C0900',
    glow:   'rgba(255,193,7,0.18)',
    emoji:  '📍',
    showTrike: true,
  },
  {
    key: '2',
    headline: 'Patas na presyo',
    sub: 'Makipag-chat sa driver at mag-negotiate.\nWalang nakatagong bayad — ikaw ang nagdedesisyon.',
    detail: 'Built-in fare negotiation · Cash-based · No digital wallet needed',
    accent: '#10B981',
    bg:     '#000E09',
    glow:   'rgba(16,185,129,0.18)',
    emoji:  '💬',
    showTrike: false,
  },
  {
    key: '3',
    headline: 'Ligtas sa bawat biyahe',
    sub: 'Lahat ng biyahe ay nire-record.\nI-share ang trip mo. Emergency SOS isa lang ang tap.',
    detail: 'Driver ID verified · Trip log · One-tap emergency contacts',
    accent: '#38BDF8',
    bg:     '#000B12',
    glow:   'rgba(56,189,248,0.18)',
    emoji:  '🛡',
    showTrike: false,
  },
];

export default function OnboardingScreen({ onDone }) {
  const scrollRef  = useRef(null);
  const [idx, setIdx] = useState(0);
  const slide   = SLIDES[idx];
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const animateIn = () => {
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.88);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, bounciness: 7, speed: 18 }),
      Animated.timing(fadeAnim,  { toValue: 1, useNativeDriver: true, duration: 280 }),
    ]).start();
  };

  const goNext = () => {
    if (idx < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: W * (idx + 1), animated: true });
      setIdx((i) => i + 1);
      animateIn();
    } else {
      onDone();
    }
  };

  const onScroll = (e) => {
    const newIdx = Math.round(e.nativeEvent.contentOffset.x / W);
    if (newIdx !== idx) {
      setIdx(newIdx);
      animateIn();
    }
  };

  // Animate icon on mount
  useEffect(() => { animateIn(); }, []);

  return (
    <View style={[s.root, { backgroundColor: slide.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={slide.bg} />

      {/* Skip button */}
      {idx < SLIDES.length - 1 && (
        <TouchableOpacity style={s.skip} onPress={onDone} activeOpacity={0.7}>
          <Text style={s.skipTxt}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Header — icon + brand */}
      <SafeAreaView>
        <View style={s.headerRow}>
          <View style={[s.headerLogo, { borderColor: slide.accent + '88' }]}>
            <Image source={ICON} style={s.headerLogoImg} resizeMode="cover" />
          </View>
          <Text style={[s.headerBrand, { color: slide.accent }]}>Para Po!</Text>
        </View>
      </SafeAreaView>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {SLIDES.map((sl, i) => (
          <View key={sl.key} style={s.slide}>
            {/* Animated icon circle — springs in on slide change */}
            <Animated.View style={[
              s.iconWrap,
              { borderColor: sl.accent + '55', backgroundColor: sl.glow },
              i === idx && { transform: [{ scale: scaleAnim }], opacity: fadeAnim },
            ]}>
              <Text style={s.iconEmoji}>{sl.emoji}</Text>
              {sl.showTrike && (
                <View style={[s.trikeContainer, { backgroundColor: sl.accent }]}>
                  <Image source={TRAYSIKEL} style={s.slideTrike} resizeMode="contain" />
                </View>
              )}
            </Animated.View>

            <Animated.Text style={[
              s.headline, { color: sl.accent },
              i === idx && { opacity: fadeAnim },
            ]}>{sl.headline}</Animated.Text>
            <Text style={s.sub}>{sl.sub}</Text>

            <View style={[s.pill, { borderColor: sl.accent + '44' }]}>
              <View style={[s.pillDot, { backgroundColor: sl.accent }]} />
              <Text style={[s.pillTxt, { color: sl.accent }]}>{sl.detail}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom: dots + CTA */}
      <SafeAreaView>
        <View style={s.bottom}>
          {/* Progress dots */}
          <View style={s.dots}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[
                  s.dot,
                  i === idx
                    ? [s.dotActive, { backgroundColor: slide.accent, shadowColor: slide.accent }]
                    : { backgroundColor: 'rgba(255,255,255,0.15)' },
                ]}
              />
            ))}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[s.btn, { backgroundColor: slide.accent, shadowColor: slide.accent }]}
            onPress={goNext}
            activeOpacity={0.86}
          >
            <Text style={s.btnTxt}>
              {idx < SLIDES.length - 1 ? 'SUSUNOD  →' : 'MAGSIMULA NA!'}
            </Text>
          </TouchableOpacity>

          {/* Terms on last slide */}
          {idx === SLIDES.length - 1 && (
            <Text style={s.terms}>
              Sa paggamit ng Para Po!, sumasang-ayon ka sa aming{'\n'}
              <Text style={{ color: slide.accent, fontWeight: '700' }}>Terms of Use</Text>
              {' '}at{' '}
              <Text style={{ color: slide.accent, fontWeight: '700' }}>Privacy Policy</Text>
            </Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  skip:    { position: 'absolute', top: 58, right: 24, zIndex: 20, padding: 8 },
  skipTxt: { color: 'rgba(255,255,255,0.40)', fontSize: 14, fontWeight: '700' },

  headerRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 18, paddingHorizontal: 22 },
  headerLogo:   { width: 38, height: 38, borderRadius: 10, borderWidth: 1.5, overflow: 'hidden' },
  headerLogoImg:{ width: 38, height: 38 },
  headerBrand:  { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },

  slide: { width: W, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 22 },

  iconWrap: {
    width: 170, height: 170, borderRadius: 85,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
  },
  iconEmoji: { fontSize: 72 },
  trikeContainer: {
    position: 'absolute', bottom: 16,
    width: 88, height: 58, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  slideTrike: { width: 80, height: 52 },

  headline: { fontSize: 32, fontWeight: '900', textAlign: 'center', letterSpacing: -0.3 },
  sub:      { fontSize: 15, color: 'rgba(255,255,255,0.68)', textAlign: 'center', lineHeight: 24 },

  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillTxt: { fontSize: 11, fontWeight: '700', flex: 1 },

  bottom:  { paddingHorizontal: 28, paddingBottom: 36, alignItems: 'center', gap: 20 },

  dots:    { flexDirection: 'row', gap: 8 },
  dot:     { height: 6, borderRadius: 999 },
  dotActive: {
    width: 28, shadowOpacity: 0.8, shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },

  btn: {
    width: W - 56, height: 62, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.45, shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  btnTxt: { fontSize: 16, fontWeight: '900', color: '#07080F', letterSpacing: 1.5 },

  terms: { fontSize: 11, color: 'rgba(255,255,255,0.30)', textAlign: 'center', lineHeight: 18 },
});
