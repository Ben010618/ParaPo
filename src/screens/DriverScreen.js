import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Animated, Switch, Vibration, ScrollView, Image, Linking,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useDriverStore } from '../store/driverStore';
import { useRideStore } from '../store/rideStore';
import { C } from '../theme/colors';

const DRIVER_CANNED = [
  "On my way! 🛺",
  "I'm here now! 📍",
  "Running 5 mins late ⏳",
  "Look for my plate 🔍",
];

const DS = {
  OFFLINE: 'offline', IDLE: 'idle', INCOMING: 'incoming',
  PICKUP: 'pickup', ENROUTE: 'enroute', COMPLETE: 'complete',
};

export default function DriverScreen() {
  const mountedRef     = useRef(true);
  const driverStateRef = useRef(DS.OFFLINE);
  const reqCardAnim    = useRef(new Animated.Value(500)).current;
  const activeCardAnim = useRef(new Animated.Value(500)).current;
  const timerTimeout   = useRef(null);

  const [driverState,    setDriverState]    = useState(DS.OFFLINE);
  const [toggling,       setToggling]       = useState(false);
  const [ridesCount,     setRidesCount]     = useState(0);
  const [onlineSeconds,  setOnlineSeconds]  = useState(0);

  useEffect(() => { driverStateRef.current = driverState; }, [driverState]);

  const { session, profile }                                      = useAuthStore();
  const { isOnline, goOnline, goOffline }                         = useDriverStore();
  const {
    incomingRequest, setIncomingRequest, clearIncomingRequest,
    respondToRide, activeRide, completeRide,
    incomingPassengerProfile, fetchIncomingPassenger,
    rideMessages, sendMessage, subscribeMessages, unsubscribeMessages,
  } = useRideStore();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(timerTimeout.current);
    };
  }, []);

  // Sync driverState with store
  useEffect(() => {
    if (!isOnline && driverState !== DS.PICKUP && driverState !== DS.ENROUTE && driverState !== DS.COMPLETE) {
      setDriverState(DS.OFFLINE);
    } else if (isOnline && driverState === DS.OFFLINE) {
      setDriverState(DS.IDLE);
    }
  }, [isOnline]);

  // Online timer
  useEffect(() => {
    if (!isOnline) { setOnlineSeconds(0); return; }
    const t = setInterval(() => { if (mountedRef.current) setOnlineSeconds((p) => p + 1); }, 1000);
    return () => clearInterval(t);
  }, [isOnline]);

  // Subscribe to incoming requests
  useEffect(() => {
    if (!isOnline || !session?.user?.id) return;
    const channel = supabase.channel(`driver-requests-${session.user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ride_requests', filter: `driver_id=eq.${session.user.id}` }, (payload) => {
        if (!mountedRef.current) return;
        if (payload.new?.status === 'pending' && driverStateRef.current === DS.IDLE) {
          setIncomingRequest(payload.new);
          fetchIncomingPassenger(payload.new.passenger_id);
          setDriverState(DS.INCOMING);
          // Vibrate + ring notification
          Vibration.vibrate([0, 400, 200, 400, 200, 400]);
          Notifications.scheduleNotificationAsync({
            content: {
              title: '🛺 Bagong Pasahero!',
              body:  'May naghahanap ng sakay. Tanggapin agad!',
              sound: true,
            },
            trigger: null, // fire immediately
          }).catch(() => {});
          showReqCard();
          startTimer();
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isOnline, session?.user?.id]);

  // ── Animations ────────────────────────────────────────────
  const showReqCard    = useCallback(() => {
    Animated.spring(reqCardAnim, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 14 }).start();
  }, [reqCardAnim]);

  const hideReqCard    = useCallback((cb) => {
    Animated.timing(reqCardAnim, { toValue: 500, useNativeDriver: true, duration: 200 }).start(cb);
  }, [reqCardAnim]);

  const showActiveCard = useCallback(() => {
    Animated.spring(activeCardAnim, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 14 }).start();
  }, [activeCardAnim]);

  const hideActiveCard = useCallback((cb) => {
    Animated.timing(activeCardAnim, { toValue: 500, useNativeDriver: true, duration: 200 }).start(cb);
  }, [activeCardAnim]);

  // ── 15-second auto-decline timer (no visual bar) ─────────
  const startTimer = useCallback(() => {
    timerTimeout.current = setTimeout(() => {
      if (mountedRef.current && driverStateRef.current === DS.INCOMING) handleDecline(true);
    }, 15000);
  }, [handleDecline]);

  const stopTimer = useCallback(() => {
    clearTimeout(timerTimeout.current);
  }, []);

  // ── Toggle ────────────────────────────────────────────────
  const handleToggle = async () => {
    if (toggling || !session?.user?.id) return;
    setToggling(true);
    try {
      if (isOnline) {
        await goOffline(session.user.id);
        if (mountedRef.current) setDriverState(DS.OFFLINE);
      } else {
        await goOnline(session.user.id);
        if (mountedRef.current) setDriverState(DS.IDLE);
      }
    } catch (e) {
      if (mountedRef.current) Alert.alert('Error', e?.message ?? 'Could not change status.');
    } finally {
      if (mountedRef.current) setToggling(false);
    }
  };

  // ── Accept / Decline ──────────────────────────────────────
  const handleAccept = async () => {
    if (!incomingRequest?.id) return;
    stopTimer();
    hideReqCard(async () => {
      try {
        await respondToRide(incomingRequest.id, true);
        if (!mountedRef.current) return;
        subscribeMessages(incomingRequest.id);
        setDriverState(DS.PICKUP);
        showActiveCard();
      } catch (e) {
        if (mountedRef.current) {
          Alert.alert('Error', e?.message ?? 'Could not accept ride.');
          setDriverState(DS.IDLE);
          clearIncomingRequest();
        }
      }
    });
  };

  const handleDecline = useCallback(async (auto = false) => {
    if (!incomingRequest?.id && !auto) return;
    stopTimer();
    hideReqCard(async () => {
      if (!mountedRef.current) return;
      if (incomingRequest?.id) {
        try { await respondToRide(incomingRequest.id, false); } catch (_) {}
      }
      setDriverState(DS.IDLE);
      clearIncomingRequest();
      reqCardAnim.setValue(500);
    });
  }, [incomingRequest?.id, stopTimer, hideReqCard, respondToRide, clearIncomingRequest, reqCardAnim]);

  // ── Arrived / Complete ────────────────────────────────────
  const handleArrived = () => {
    if (driverState === DS.PICKUP) setDriverState(DS.ENROUTE);
    else if (driverState === DS.ENROUTE) handleCompleteRide();
  };

  const handleCompleteRide = async () => {
    if (!activeRide?.id) return;
    hideActiveCard(async () => {
      try {
        await completeRide(activeRide.id);
        if (!mountedRef.current) return;
        unsubscribeMessages();
        setRidesCount((p) => p + 1);
        setDriverState(DS.COMPLETE);
      } catch (e) {
        if (mountedRef.current) Alert.alert('Error', e?.message ?? 'Could not complete ride.');
      }
    });
  };

  const handleDone = () => {
    if (mountedRef.current) { setDriverState(DS.IDLE); activeCardAnim.setValue(500); }
  };

  const formatOnlineTime = () => {
    const h = Math.floor(onlineSeconds / 3600);
    const m = Math.floor((onlineSeconds % 3600) / 60);
    const s = onlineSeconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  // D1 — open Google Maps navigation to passenger pickup
  const handleNavigate = useCallback(() => {
    const lat = activeRide?.pickup_lat;
    const lng = activeRide?.pickup_lng;
    if (!lat || !lng) return;
    const url = `https://maps.google.com/maps?daddr=${lat},${lng}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Navigation error', 'Could not open Google Maps.');
    });
  }, [activeRide?.pickup_lat, activeRide?.pickup_lng]);

  // C1 — send a canned message to passenger
  const handleSendMessage = useCallback((msg) => {
    if (!activeRide?.id || !session?.user?.id) return;
    sendMessage(activeRide.id, session.user.id, 'driver', msg);
  }, [activeRide?.id, session?.user?.id, sendMessage]);

  const arrivedBtnLabel = driverState === DS.PICKUP ? "I've Arrived at Pickup" : 'Complete Ride ✓';

  // Last message from passenger
  const lastPaxMsg = [...rideMessages].reverse().find((m) => m.sender_role === 'passenger');

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── ONLINE / OFFLINE HERO ── */}
        <View style={[s.statusHero, isOnline && s.statusHeroOnline]}>
          <View style={s.statusLeft}>
            <View style={[s.statusDotLarge, !isOnline && s.statusDotOff]} />
            <View>
              <Text style={s.statusTitle}>{isOnline ? "You're Online" : "You're Offline"}</Text>
              <Text style={s.statusSub}>
                {isOnline ? 'Accepting rides · Sharing location' : 'Toggle to start receiving rides'}
              </Text>
            </View>
          </View>
          <View style={s.switchWrap}>
            <Switch
              value={isOnline}
              onValueChange={handleToggle}
              disabled={toggling}
              trackColor={{ false: C.surface3, true: 'rgba(34,197,94,0.45)' }}
              thumbColor={isOnline ? C.green : C.muted}
            />
          </View>
        </View>

        {/* ── STATS STRIP ── */}
        <View style={s.earningsStrip}>
          <View style={s.earnItem}>
            <Text style={s.earnAmt}>{ridesCount}</Text>
            <Text style={s.earnLbl}>Rides Done</Text>
          </View>
          <View style={s.earnDivider} />
          <View style={s.earnItem}>
            <Text style={[s.earnAmt, { color: C.accent }]}>
              {profile?.average_rating ? `⭐ ${profile.average_rating.toFixed(1)}` : '—'}
            </Text>
            <Text style={s.earnLbl}>Avg Rating</Text>
          </View>
          <View style={s.earnDivider} />
          <View style={s.earnItem}>
            <Text style={[s.earnAmt, { fontSize: 14 }]}>{formatOnlineTime()}</Text>
            <Text style={s.earnLbl}>Online Time</Text>
          </View>
        </View>

        {/* ── ONLINE STATS ── */}
        {isOnline && (
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statIcon}>⏱</Text>
              <Text style={s.statVal}>{formatOnlineTime()}</Text>
              <Text style={s.statLbl}>Online</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statIcon}>📍</Text>
              <Text style={s.statVal}>Active</Text>
              <Text style={s.statLbl}>GPS sharing</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statIcon}>🛺</Text>
              <Text style={s.statVal}>Ready</Text>
              <Text style={s.statLbl}>For rides</Text>
            </View>
          </View>
        )}

        {/* ── IDLE STATE ── */}
        {driverState === DS.IDLE && (
          <View style={s.waitCard}>
            <Text style={s.waitEmoji}>🛺</Text>
            <Text style={s.waitTitle}>Naghihintay ng pasahero…</Text>
            <Text style={s.waitSub}>You are visible to passengers nearby.{'\n'}Stay in range!</Text>
          </View>
        )}

        {/* ── OFFLINE STATE ── */}
        {driverState === DS.OFFLINE && (
          <View style={s.waitCard}>
            <Text style={s.waitEmoji}>😴</Text>
            <Text style={s.waitTitle}>You are offline</Text>
            <Text style={s.waitSub}>Toggle the switch above{'\n'}to start accepting rides.</Text>
            <TouchableOpacity style={s.goOnlineBtn} onPress={handleToggle} disabled={toggling} activeOpacity={0.85}>
              <Text style={s.goOnlineBtnText}>Go Online →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── COMPLETE STATE ── */}
        {driverState === DS.COMPLETE && (
          <View style={s.completeCard}>
            <Text style={{ fontSize: 56 }}>🎉</Text>
            <Text style={s.completeTitle}>Ride Complete!</Text>
            <Text style={s.completeSub}>Salamat, Kuya! Great job today.{'\n'}Nakatulong ka ng isang pasahero.</Text>
            <TouchableOpacity style={s.doneBtn} onPress={handleDone} activeOpacity={0.85}>
              <Text style={s.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ── INCOMING REQUEST CARD ── */}
      <Animated.View style={[s.slideCard, { transform: [{ translateY: reqCardAnim }] }]}>
        <View style={s.slideHandle} />

        <Text style={s.reqBadge}>🛺  NEW PASSENGER REQUEST</Text>

        {/* Avatar + Identity */}
        <View style={s.reqIdentity}>
          <View style={s.reqAvatarRing}>
            {incomingPassengerProfile?.id_photo_url ? (
              <Image source={{ uri: incomingPassengerProfile.id_photo_url }} style={s.reqAvatarImg} />
            ) : (
              <View style={s.reqIconWrap}>
                <Text style={{ fontSize: 34 }}>🤚</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={s.reqTitle}>
              {incomingPassengerProfile
                ? [incomingPassengerProfile.given_name, incomingPassengerProfile.surname].filter(Boolean).join(' ') || incomingPassengerProfile.name || 'Passenger'
                : 'New Passenger'}
            </Text>
            {(incomingPassengerProfile?.house_no || incomingPassengerProfile?.street) && (
              <Text style={s.reqAddrLine1} numberOfLines={1}>
                {[incomingPassengerProfile.house_no, incomingPassengerProfile.street].filter(Boolean).join(' ')}
              </Text>
            )}
            <Text style={s.reqAddrLine2} numberOfLines={1}>
              {incomingPassengerProfile?.brgy_purok
                ? `${incomingPassengerProfile.brgy_purok}${incomingPassengerProfile.city_municipality ? `, ${incomingPassengerProfile.city_municipality}` : ''}`
                : '📍 Passenger nearby'}
            </Text>
          </View>
        </View>

        {/* Destination + Pickup */}
        <View style={s.reqLocCard}>
          <View style={{ flex: 1 }}>
            {incomingRequest?.destination_text ? (
              <>
                <Text style={s.reqLocLabel}>DESTINATION</Text>
                <Text style={[s.reqLocText, { color: C.accent, marginBottom: 8 }]}>
                  📍 {incomingRequest.destination_text}
                </Text>
              </>
            ) : null}
            <Text style={s.reqLocLabel}>PICKUP COORDINATES</Text>
            <Text style={s.reqLocText}>
              {incomingRequest?.pickup_lat?.toFixed(5) ?? '—'},{' '}
              {incomingRequest?.pickup_lng?.toFixed(5) ?? '—'}
            </Text>
          </View>
        </View>

        <View style={s.reqBtns}>
          <TouchableOpacity style={s.declineBtn} onPress={() => handleDecline(false)} activeOpacity={0.8}>
            <Text style={s.declineText}>✕  Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.acceptBtn} onPress={handleAccept} activeOpacity={0.85}>
            <Text style={s.acceptText}>✓  Accept</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── ACTIVE RIDE CARD ── */}
      <Animated.View style={[s.slideCard, { transform: [{ translateY: activeCardAnim }] }]}>
        <View style={s.slideHandle} />

        <View style={s.activeTop}>
          <View>
            <Text style={s.activeTitle}>Active Ride</Text>
            <Text style={s.activeSub}>
              {driverState === DS.PICKUP ? '🚗 Heading to pickup' : '🛣  En route with passenger'}
            </Text>
          </View>
          <View style={[s.activeBadge, driverState === DS.ENROUTE && { backgroundColor: C.greenDim, borderColor: 'rgba(34,197,94,0.3)' }]}>
            <Text style={[s.activeBadgeText, driverState === DS.ENROUTE && { color: C.green }]}>
              {driverState === DS.PICKUP ? 'PICKUP' : 'EN ROUTE'}
            </Text>
          </View>
        </View>

        <View style={s.paxCard}>
          <View style={s.paxAvatarRing}>
            {incomingPassengerProfile?.id_photo_url ? (
              <Image source={{ uri: incomingPassengerProfile.id_photo_url }} style={s.paxAvatarImg} />
            ) : (
              <View style={s.paxAvatar}><Text style={{ fontSize: 28 }}>🤚</Text></View>
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={s.paxName}>
              {incomingPassengerProfile
                ? [incomingPassengerProfile.given_name, incomingPassengerProfile.surname].filter(Boolean).join(' ') || incomingPassengerProfile.name || 'Passenger'
                : 'Passenger'}
            </Text>
            <Text style={s.paxAddr}>
              {incomingPassengerProfile?.brgy_purok
                ? `📍 ${incomingPassengerProfile.brgy_purok}${incomingPassengerProfile.city_municipality ? `, ${incomingPassengerProfile.city_municipality}` : ''}`
                : `📍 ${activeRide?.pickup_lat?.toFixed(4) ?? '—'}, ${activeRide?.pickup_lng?.toFixed(4) ?? '—'}`}
            </Text>
            {(incomingPassengerProfile?.house_no || incomingPassengerProfile?.street) && (
              <Text style={s.paxAddrSub} numberOfLines={1}>
                {[incomingPassengerProfile.house_no, incomingPassengerProfile.street].filter(Boolean).join(' ')}
              </Text>
            )}
          </View>
        </View>

        {/* A1 — Destination display */}
        {activeRide?.destination_text && (
          <View style={s.destRow}>
            <Text style={s.destRowLabel}>GOING TO</Text>
            <Text style={s.destRowText} numberOfLines={1}>
              📍 {activeRide.destination_text}
            </Text>
          </View>
        )}

        {/* C1 — Last passenger message */}
        {lastPaxMsg && (
          <View style={s.incomingMsgWrap}>
            <Text style={s.incomingMsgLabel}>Passenger says:</Text>
            <Text style={s.incomingMsgText}>"{lastPaxMsg.message}"</Text>
          </View>
        )}

        {/* C1 — Canned messages */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.cannedRow}>
          {DRIVER_CANNED.map((msg) => (
            <TouchableOpacity
              key={msg} style={s.cannedBtn}
              onPress={() => handleSendMessage(msg)} activeOpacity={0.75}
            >
              <Text style={s.cannedText}>{msg}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* D1 — Navigate + Arrived row */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.navigateBtn} onPress={handleNavigate} activeOpacity={0.85}>
            <Text style={s.navigateBtnText}>🗺 Navigate</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.arrivedBtn, driverState === DS.ENROUTE && { backgroundColor: C.green }]}
            onPress={handleArrived}
            activeOpacity={0.85}
          >
            <Text style={s.arrivedBtnText}>{arrivedBtnLabel}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 120, gap: 12 },

  // ── Status hero ───────────────────────────────────────────
  statusHero: {
    backgroundColor: C.surface, borderRadius: 18,
    padding: 18, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  statusHeroOnline: { borderColor: 'rgba(34,197,94,0.35)', backgroundColor: '#141f14' },
  statusLeft:       { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  statusDotLarge: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: C.green,
    shadowColor: C.green, shadowOpacity: 0.9, shadowRadius: 6,
  },
  statusDotOff: { backgroundColor: C.muted, shadowOpacity: 0 },
  statusTitle:  { fontSize: 16, fontWeight: '700', color: C.text },
  statusSub:    { fontSize: 12, color: C.muted, marginTop: 2 },
  switchWrap:   { marginLeft: 8 },

  // ── Stats strip (no prices) ───────────────────────────────
  earningsStrip: {
    backgroundColor: C.surface, borderRadius: 18,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  earnItem:    { flex: 1, padding: 16, alignItems: 'center' },
  earnDivider: { width: 1, height: 40, backgroundColor: C.border },
  earnAmt:     { fontSize: 20, fontWeight: '900', color: C.text },
  earnLbl:     { fontSize: 10, color: C.muted, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Stats row ─────────────────────────────────────────────
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: C.surface, borderRadius: 14,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  statIcon: { fontSize: 20, marginBottom: 6 },
  statVal:  { fontSize: 15, fontWeight: '700', color: C.text },
  statLbl:  { fontSize: 10, color: C.muted, marginTop: 2 },

  // ── Wait / idle card ──────────────────────────────────────
  waitCard: {
    backgroundColor: C.surface, borderRadius: 18,
    padding: 32, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  waitEmoji: { fontSize: 56, marginBottom: 14 },
  waitTitle: { fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center' },
  waitSub:   { fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  goOnlineBtn: {
    marginTop: 20, backgroundColor: C.green, borderRadius: 14,
    paddingHorizontal: 32, paddingVertical: 12,
  },
  goOnlineBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // ── Complete card ─────────────────────────────────────────
  completeCard: {
    backgroundColor: C.surface, borderRadius: 18,
    padding: 32, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
  },
  completeTitle: { fontSize: 26, fontWeight: '900', color: C.accent, marginTop: 12 },
  completeSub:   { fontSize: 14, color: C.muted, marginTop: 12, textAlign: 'center', lineHeight: 22 },
  doneBtn: {
    backgroundColor: C.accent, borderRadius: 14,
    paddingHorizontal: 48, paddingVertical: 14, marginTop: 20,
  },
  doneBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },

  // ── Slide-up cards ────────────────────────────────────────
  slideCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.surface,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    padding: 20, paddingBottom: 44,
    borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.07)',
    shadowColor: '#000', shadowOpacity: 1, shadowRadius: 30, elevation: 30,
  },
  slideHandle: {
    width: 44, height: 4, backgroundColor: C.border, borderRadius: 2,
    alignSelf: 'center', marginBottom: 18,
  },

  // ── Request card internals ────────────────────────────────
  reqBadge: {
    fontSize: 11, fontWeight: '800', color: C.accent,
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: 16,
  },
  reqIdentity:  { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  reqAvatarRing: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2.5, borderColor: C.accent,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  reqAvatarImg:  { width: 80, height: 80, borderRadius: 40 },
  reqIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.accentDim,
    alignItems: 'center', justifyContent: 'center',
  },
  reqTitle:    { fontSize: 20, fontWeight: '900', color: C.text, marginBottom: 4 },
  reqAddrLine1:{ fontSize: 13, color: C.text, fontWeight: '500' },
  reqAddrLine2:{ fontSize: 13, color: C.muted, marginTop: 2 },

  reqLocCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.surface2, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: C.border, marginBottom: 16,
  },
  reqLocDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: C.orange },
  reqLocLabel: { fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  reqLocText:  { fontSize: 14, fontWeight: '600', color: C.text, marginTop: 2 },

  reqBtns:    { flexDirection: 'row', gap: 10 },
  declineBtn: {
    flex: 1, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.redDim, padding: 15, alignItems: 'center',
  },
  declineText: { color: C.red, fontSize: 15, fontWeight: '700' },
  acceptBtn:   {
    flex: 2, borderRadius: 14, backgroundColor: C.green,
    padding: 15, alignItems: 'center',
  },
  acceptText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // ── Active ride card internals ────────────────────────────
  activeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  activeTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  activeSub:   { fontSize: 13, color: C.muted, marginTop: 3 },
  activeBadge: {
    backgroundColor: C.accentDim, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.25)',
    paddingHorizontal: 10, paddingVertical: 4,
  },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: C.accent },

  paxCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, backgroundColor: C.surface2,
    borderRadius: 16, borderWidth: 1, borderColor: C.border, marginBottom: 14,
  },
  paxAvatarRing: {
    width: 68, height: 68, borderRadius: 34,
    borderWidth: 2.5, borderColor: C.orange,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  paxAvatarImg: { width: 68, height: 68, borderRadius: 34 },
  paxAvatar: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: C.orangeDim,
    alignItems: 'center', justifyContent: 'center',
  },
  paxName:    { fontSize: 17, fontWeight: '800', color: C.text, marginBottom: 4 },
  paxAddr:    { fontSize: 13, color: C.muted },
  paxAddrSub: { fontSize: 12, color: C.muted2, marginTop: 2 },

  // ── Action row (navigate + arrived) ──────────────────────
  actionRow:    { flexDirection: 'row', gap: 10 },
  navigateBtn:  {
    flex: 1, borderRadius: 14, padding: 16, alignItems: 'center',
    backgroundColor: C.surface2, borderWidth: 1, borderColor: 'rgba(59,130,246,0.35)',
  },
  navigateBtnText: { fontSize: 14, fontWeight: '700', color: C.blue },
  arrivedBtn: {
    flex: 2, backgroundColor: C.accent, borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  arrivedBtnText: { fontSize: 15, fontWeight: '800', color: '#000' },

  // ── Destination row (active card) ─────────────────────────
  destRow: {
    backgroundColor: C.surface2, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.25)',
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
  },
  destRowLabel: { fontSize: 10, color: C.accent, fontWeight: '700', letterSpacing: 0.8 },
  destRowText:  { fontSize: 14, color: C.text, fontWeight: '600', marginTop: 2 },

  // ── Messages ──────────────────────────────────────────────
  incomingMsgWrap: {
    backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)',
    padding: 12, marginBottom: 10,
  },
  incomingMsgLabel: { fontSize: 10, color: C.blue, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3 },
  incomingMsgText:  { fontSize: 13, color: C.text, fontStyle: 'italic' },
  cannedRow:  { paddingBottom: 12, gap: 8, flexDirection: 'row' },
  cannedBtn:  {
    backgroundColor: C.surface2, borderRadius: 20,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  cannedText: { fontSize: 12, color: C.text, fontWeight: '600' },
});
