import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, Animated, Vibration, ActivityIndicator, Image,
  ScrollView, Linking, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useRideStore } from '../store/rideStore';
import { C, DARK_MAP_STYLE } from '../theme/colors';

const RS = { IDLE: 'idle', SEARCHING: 'searching', MATCHED: 'matched', ARRIVED: 'arrived' };
const CANCEL_WINDOW_SECS = 60;

const PAX_CANNED = [
  "On my way 🏃",
  "I'm here! 📍",
  "Wait lang 5 mins ⏳",
  "Where are you? 🛺",
];

// ── Driver map marker ─────────────────────────────────────────
function DriverMarker({ pulse = false }) {
  return (
    <View style={mk.wrap}>
      <View style={[mk.outerRing, pulse && mk.outerRingPulse]} />
      <View style={mk.inner}><Text style={{ fontSize: 20 }}>🛺</Text></View>
    </View>
  );
}
const mk = StyleSheet.create({
  wrap:          { width: 54, height: 54, alignItems: 'center', justifyContent: 'center' },
  outerRing:     {
    position: 'absolute', width: 54, height: 54, borderRadius: 27,
    backgroundColor: 'rgba(255,193,7,0.12)',
    borderWidth: 1.5, borderColor: 'rgba(255,193,7,0.35)',
  },
  outerRingPulse: { borderColor: C.accent, backgroundColor: 'rgba(255,193,7,0.22)' },
  inner:         {
    width: 36, height: 36, borderRadius: 18, backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.accent, shadowOpacity: 1, shadowRadius: 12, elevation: 10,
  },
});

// ── Destination popout modal ──────────────────────────────────
function DestinationModal({ visible, value, onChange, onClose }) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={dm.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={dm.card}>
          {/* Header */}
          <View style={dm.header}>
            <TouchableOpacity
              style={dm.backBtn}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={dm.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={dm.title}>Saan kayo papunta?</Text>
          </View>

          {/* Input — auto-focused so keyboard appears above it */}
          <View style={dm.inputRow}>
            <Text style={dm.pin}>📍</Text>
            <TextInput
              style={dm.input}
              autoFocus
              placeholder="Type your destination…"
              placeholderTextColor={C.muted}
              value={value}
              onChangeText={onChange}
              returnKeyType="done"
              onSubmitEditing={value.trim() ? onClose : undefined}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {value.length > 0 && (
              <TouchableOpacity
                onPress={() => onChange('')}
                style={dm.clearBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={dm.clearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Confirm */}
          <TouchableOpacity
            style={[dm.confirmBtn, !value.trim() && dm.confirmBtnDisabled]}
            onPress={onClose}
            disabled={!value.trim()}
            activeOpacity={0.85}
          >
            <Text style={dm.confirmText}>
              {value.trim() ? `Confirm: ${value.trim()} ✓` : 'Enter a destination first'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const dm = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.58)' },
  card: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 42,
    borderWidth: 1, borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header:   { flexDirection: 'row', alignItems: 'center', marginBottom: 18, gap: 12 },
  backBtn:  { paddingVertical: 4 },
  backText: { color: C.accent, fontSize: 15, fontWeight: '700' },
  title:    { flex: 1, fontSize: 15, fontWeight: '700', color: C.text },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface2, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.accent,
    paddingHorizontal: 14, marginBottom: 16, height: 56,
  },
  pin:      { fontSize: 18, marginRight: 10 },
  input:    { flex: 1, fontSize: 15, color: C.text },
  clearBtn: { padding: 6 },
  clearText: { color: C.muted, fontSize: 16 },
  confirmBtn: {
    backgroundColor: C.accent, borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.35 },
  confirmText: { color: '#000', fontWeight: '800', fontSize: 15 },
});

// ── Full name helper ──────────────────────────────────────────
const fullName = (p) => {
  if (!p) return 'Driver';
  if (p.given_name && p.surname)
    return [p.given_name, p.middle_initial ? `${p.middle_initial}.` : null, p.surname]
      .filter(Boolean).join(' ');
  return p.name ?? 'Driver';
};

// ── Star rating ───────────────────────────────────────────────
function StarRating({ value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginVertical: 14 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n)} activeOpacity={0.7}>
          <Text style={{ fontSize: 40, color: n <= value ? C.accent : C.border }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function PassengerMapScreen() {
  const mapRef           = useRef(null);
  const mountedRef       = useRef(true);
  const cardAnim         = useRef(new Animated.Value(500)).current;
  const searchTimer      = useRef(null);
  const cancelTimerRef   = useRef(null);
  const triedDriverIds   = useRef([]);
  const driversRef       = useRef([]);
  const matchedDriverRef = useRef(null);

  const [rideState,        setRideState]        = useState(RS.IDLE);
  const [userLocation,     setUserLocation]     = useState(null);
  const [drivers,          setDrivers]          = useState([]);
  const [matchedDriver,    setMatchedDriver]    = useState(null);
  const [locationReady,    setLocationReady]    = useState(false);
  const [locationError,    setLocationError]    = useState(null);
  const [destination,      setDestination]      = useState('');
  const [rating,           setRating]           = useState(0);
  const [destModalVisible, setDestModalVisible] = useState(false);
  const [cancelSecsLeft,   setCancelSecsLeft]   = useState(CANCEL_WINDOW_SECS);
  const [driverLiveCoord,  setDriverLiveCoord]  = useState(null);
  const [freeText,         setFreeText]         = useState('');
  const [fareInput,        setFareInput]        = useState('');
  const [showFareInput,    setShowFareInput]    = useState(false);
  const [showReportModal,  setShowReportModal]  = useState(false);
  const [selectedReason,   setSelectedReason]   = useState('');
  const [reportDesc,       setReportDesc]       = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const msgScrollRef = useRef(null);

  const { session } = useAuthStore();
  const {
    activeRide, requestRide, cancelRide,
    matchedDriverProfile,
    rideMessages, sendMessage, subscribeMessages, unsubscribeMessages,
    submitRating, confirmFare,
  } = useRideStore();

  // ── Notification permissions ──────────────────────────────────
  useEffect(() => { Notifications.requestPermissionsAsync().catch(() => {}); }, []);

  // ── Mount guard ───────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(searchTimer.current);
      if (cancelTimerRef.current) clearInterval(cancelTimerRef.current);
    };
  }, []);

  // ── Location ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (mountedRef.current) setLocationError('Location permission denied. Enable in Settings.');
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!mountedRef.current) return;
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserLocation(coords);
        setLocationReady(true);
        mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 800);
      } catch (_) {
        if (mountedRef.current) setLocationError('Could not get location. Check GPS.');
      }
    })();
  }, []);

  // Keep refs current so Realtime callbacks always see fresh values
  useEffect(() => { driversRef.current     = drivers; },       [drivers]);
  useEffect(() => { matchedDriverRef.current = matchedDriver; }, [matchedDriver]);

  // ── Realtime driver list ───────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('driver_locations').select('*').eq('is_available', true);
        if (mountedRef.current) setDrivers(data ?? []);
      } catch (_) {}
    };
    load();
    const channel = supabase.channel('pax-drivers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, (payload) => {
        if (!mountedRef.current) return;
        setDrivers((prev) => {
          if (payload.eventType === 'DELETE')
            return prev.filter((d) => d.driver_id !== payload.old?.driver_id);
          const inc = payload.new;
          if (!inc?.is_available)
            return prev.filter((d) => d.driver_id !== inc?.driver_id);
          const idx = prev.findIndex((d) => d.driver_id === inc.driver_id);
          if (idx >= 0) { const next = [...prev]; next[idx] = inc; return next; }
          return [...prev, inc];
        });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Watch active ride status ───────────────────────────────────
  useEffect(() => {
    if (!activeRide?.id) return;
    const channel = supabase.channel(`ride-pax-${activeRide.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'ride_requests', filter: `id=eq.${activeRide.id}`,
      }, (payload) => {
        if (!mountedRef.current) return;
        useRideStore.setState({ activeRide: payload.new });
        if (payload.new?.status === 'completed') {
          setRideState(RS.ARRIVED);
          slideCardIn();
        } else if (payload.new?.status === 'accepted') {
          const dp    = useRideStore.getState().matchedDriverProfile;
          const dName = dp?.given_name ?? dp?.name ?? 'Your driver';
          const plate = dp?.plate_number ? ` · Plate: ${dp.plate_number}` : '';
          Notifications.scheduleNotificationAsync({
            content: {
              title: '🛺 Driver accepted your ride!',
              body:  `${dName}${plate} is on the way. Look for their tricycle.`,
              sound: true,
            },
            trigger: null,
          }).catch(() => {});
        } else if (payload.new?.status === 'declined') {
          // Auto-retry with next nearest untried driver
          const prev    = matchedDriverRef.current;
          const tried   = [...triedDriverIds.current, prev?.driver_id].filter(Boolean);
          triedDriverIds.current = tried;
          const untried = driversRef.current.filter(d => !tried.includes(d.driver_id));

          if (untried.length > 0 && tried.length < 3) {
            if (payload.new?.id) cancelRide(payload.new.id);
            useRideStore.setState({ activeRide: null, matchedDriverProfile: null });
            setRideState(RS.SEARCHING);

            const nearest = untried.reduce((best, d) => {
              const dist = Math.hypot(
                (d.lat ?? 0) - (userLocation?.latitude ?? 0),
                (d.lng ?? 0) - (userLocation?.longitude ?? 0),
              );
              return dist < best.dist ? { driver: d, dist } : best;
            }, { driver: untried[0], dist: Infinity }).driver;

            searchTimer.current = setTimeout(async () => {
              if (!mountedRef.current) return;
              try {
                await requestRide(
                  session.user.id, nearest.driver_id,
                  userLocation.latitude, userLocation.longitude, destination.trim(),
                );
                if (!mountedRef.current) return;
                setMatchedDriver(nearest);
                setRideState(RS.MATCHED);
                slideCardIn();
              } catch (e) {
                if (!mountedRef.current) return;
                setRideState(RS.IDLE);
                triedDriverIds.current = [];
                Alert.alert('Error', e?.message ?? 'Could not reach another driver.');
              }
            }, 2000);
          } else {
            handleCancel(false);
            triedDriverIds.current = [];
            Alert.alert(
              tried.length >= 3 ? 'No takers nearby' : 'Pasensya na',
              tried.length >= 3
                ? `We tried ${tried.length} nearby drivers and none accepted. Please try again shortly.`
                : 'The driver is unavailable. Trying another…',
            );
          }
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeRide?.id]);

  // ── Messages subscription once matched ────────────────────────
  useEffect(() => {
    if (activeRide?.id && rideState === RS.MATCHED) subscribeMessages(activeRide.id);
  }, [activeRide?.id, rideState]);

  // ── 60-second cancel grace window countdown ───────────────────
  useEffect(() => {
    if (cancelTimerRef.current) clearInterval(cancelTimerRef.current);
    if (rideState === RS.MATCHED) {
      const t0 = Date.now();
      setCancelSecsLeft(CANCEL_WINDOW_SECS);
      cancelTimerRef.current = setInterval(() => {
        if (!mountedRef.current) return;
        const left = Math.max(0, CANCEL_WINDOW_SECS - Math.floor((Date.now() - t0) / 1000));
        setCancelSecsLeft(left);
        if (left <= 0) { clearInterval(cancelTimerRef.current); cancelTimerRef.current = null; }
      }, 1000);
    } else {
      setCancelSecsLeft(CANCEL_WINDOW_SECS);
    }
    return () => { if (cancelTimerRef.current) clearInterval(cancelTimerRef.current); };
  }, [rideState]);

  // ── Live driver location on map when matched ──────────────────
  useEffect(() => {
    if (rideState !== RS.MATCHED || !matchedDriver?.driver_id) {
      setDriverLiveCoord(null);
      return;
    }
    const ch = supabase.channel(`live-drv-${matchedDriver.driver_id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'driver_locations',
        filter: `driver_id=eq.${matchedDriver.driver_id}`,
      }, (p) => {
        if (p.new?.lat && p.new?.lng && mountedRef.current)
          setDriverLiveCoord({ latitude: p.new.lat, longitude: p.new.lng });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [rideState, matchedDriver?.driver_id]);

  // ── Animations ────────────────────────────────────────────────
  const slideCardIn  = useCallback(() => {
    Animated.spring(cardAnim, { toValue: 0, useNativeDriver: true, bounciness: 6, speed: 14 }).start();
  }, [cardAnim]);

  const slideCardOut = useCallback((cb) => {
    Animated.timing(cardAnim, { toValue: 500, useNativeDriver: true, duration: 220 }).start(cb);
  }, [cardAnim]);

  const handleRecenter = useCallback(() => {
    if (userLocation)
      mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 500);
  }, [userLocation]);

  // ── SOS ───────────────────────────────────────────────────────
  const handleSOS = useCallback(() => {
    const driverInfo = matchedDriverProfile
      ? `Driver: ${fullName(matchedDriverProfile)}\nPlate: ${matchedDriverProfile.plate_number ?? '—'}\nRide ID: ${activeRide?.id?.slice(0, 8) ?? '—'}`
      : `Ride ID: ${activeRide?.id?.slice(0, 8) ?? '—'}`;
    Alert.alert(
      '🆘 Emergency',
      `${driverInfo}\n\nCall emergency services?`,
      [
        { text: '📞 Call 117 (PNP)', onPress: () => Linking.openURL('tel:117') },
        { text: '📞 Call 911',       onPress: () => Linking.openURL('tel:911') },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [matchedDriverProfile, activeRide?.id]);

  // ── Hail ──────────────────────────────────────────────────────
  const handleParaPo = async () => {
    if (rideState !== RS.IDLE) return;

    if (!destination.trim()) {
      setDestModalVisible(true);
      return;
    }
    if (!locationReady) {
      Alert.alert('GPS not ready', locationError ?? 'Waiting for your location…');
      return;
    }
    if (drivers.length === 0) {
      Alert.alert('Walang driver', 'No available tricycles nearby right now. Try again shortly.');
      return;
    }
    if (!session?.user?.id) {
      Alert.alert('Session expired', 'Please log in again.');
      return;
    }

    setRideState(RS.SEARCHING);
    Vibration.vibrate(60);

    const nearest = drivers.reduce((best, d) => {
      const dist = Math.hypot(
        (d.lat ?? 0) - (userLocation?.latitude ?? 0),
        (d.lng ?? 0) - (userLocation?.longitude ?? 0),
      );
      return dist < best.dist ? { driver: d, dist } : best;
    }, { driver: drivers[0], dist: Infinity }).driver;

    searchTimer.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      try {
        await requestRide(
          session.user.id,
          nearest.driver_id,
          userLocation.latitude,
          userLocation.longitude,
          destination.trim(),
        );
        if (!mountedRef.current) return;
        setMatchedDriver(nearest);
        setRideState(RS.MATCHED);
        slideCardIn();
      } catch (e) {
        if (!mountedRef.current) return;
        setRideState(RS.IDLE);
        const msg = e?.message ?? 'Could not send request.';
        Alert.alert('Hindi nakonekta', `${msg}\n\nPlease check your internet and try again.`);
      }
    }, 3200);
  };

  const handleCancel = useCallback((showSlide = true) => {
    clearTimeout(searchTimer.current);
    triedDriverIds.current = [];
    const doReset = () => {
      if (!mountedRef.current) return;
      if (activeRide?.id) cancelRide(activeRide.id);
      unsubscribeMessages();
      setRideState(RS.IDLE);
      setMatchedDriver(null);
      setDestination('');
      setRating(0);
      setDriverLiveCoord(null);
      cardAnim.setValue(500);
      useRideStore.setState({ matchedDriverProfile: null });
    };
    if (showSlide) slideCardOut(doReset); else doReset();
  }, [activeRide?.id, cardAnim, slideCardOut, cancelRide, unsubscribeMessages]);

  const handleDone = useCallback(() => {
    if (rating > 0 && activeRide?.id) submitRating(activeRide.id, rating).catch(() => {});
    unsubscribeMessages();
    slideCardOut(() => {
      if (!mountedRef.current) return;
      useRideStore.setState({ activeRide: null, matchedDriverProfile: null });
      setRideState(RS.IDLE);
      setMatchedDriver(null);
      setDestination('');
      setRating(0);
      setDriverLiveCoord(null);
    });
  }, [slideCardOut, rating, activeRide?.id, submitRating, unsubscribeMessages]);

  const handleSendMessage = useCallback((msg) => {
    if (!activeRide?.id || !session?.user?.id) return;
    sendMessage(activeRide.id, session.user.id, 'passenger', msg);
  }, [activeRide?.id, session?.user?.id, sendMessage]);

  const handleAgreeFare = useCallback(async (amount) => {
    if (!activeRide?.id || !session?.user?.id) return;
    try {
      await confirmFare(activeRide.id, amount);
      await sendMessage(activeRide.id, session.user.id, 'passenger', `✅ Fare agreed: ₱${amount} — ready!`);
    } catch (_) {
      Alert.alert('Error', 'Could not confirm fare. Please try again.');
    }
  }, [activeRide?.id, session?.user?.id, confirmFare, sendMessage]);

  const handleSubmitReport = useCallback(async () => {
    if (!selectedReason || !session?.user?.id) return;
    setReportSubmitting(true);
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: session.user.id,
        reported_id: matchedDriverProfile?.id ?? null,
        ride_id:     activeRide?.id ?? null,
        reason:      selectedReason,
        description: reportDesc.trim() || null,
      });
      if (error) throw error;
      setShowReportModal(false);
      setSelectedReason('');
      setReportDesc('');
      Alert.alert('Report Submitted', 'Thank you. Admin will review within 24 hours.');
    } catch (e) {
      Alert.alert('Error', e?.message ?? 'Could not submit report. Try again.');
    } finally {
      setReportSubmitting(false);
    }
  }, [selectedReason, reportDesc, session?.user?.id, matchedDriverProfile?.id, activeRide?.id]);

  const handleSendFree = useCallback(() => {
    if (!freeText.trim()) return;
    handleSendMessage(freeText.trim());
    setFreeText('');
  }, [freeText, handleSendMessage]);

  const handleSendFare = useCallback(() => {
    const amount = fareInput.replace(/[^0-9]/g, '');
    if (!amount) return;
    handleSendMessage(`💰 Fare proposal: ₱${amount}`);
    setFareInput('');
    setShowFareInput(false);
  }, [fareInput, handleSendMessage]);

  const isCardVisible = rideState === RS.MATCHED || rideState === RS.ARRIVED;
  const driverProfile = matchedDriverProfile;

  const etaMinutes = (() => {
    const coord = driverLiveCoord
      ?? (matchedDriver?.lat ? { latitude: matchedDriver.lat, longitude: matchedDriver.lng } : null);
    if (!coord || !userLocation) return null;
    const distKm = Math.hypot(
      coord.latitude  - userLocation.latitude,
      coord.longitude - userLocation.longitude,
    ) * 111;
    return Math.max(1, Math.ceil((distKm / 20) * 60));
  })();

  return (
    <View style={s.root}>

      {/* ── MAP ── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        customMapStyle={DARK_MAP_STYLE}
        showsUserLocation showsMyLocationButton={false} showsCompass={false}
        initialRegion={
          userLocation
            ? { ...userLocation, latitudeDelta: 0.008, longitudeDelta: 0.008 }
            : { latitude: 14.5995, longitude: 120.9842, latitudeDelta: 0.04, longitudeDelta: 0.04 }
        }
      >
        {/* Available drivers (only shown in idle) */}
        {rideState === RS.IDLE && drivers.map((d) =>
          d?.lat && d?.lng ? (
            <Marker
              key={d.driver_id}
              coordinate={{ latitude: d.lat, longitude: d.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <DriverMarker />
            </Marker>
          ) : null,
        )}

        {/* Matched driver — live position */}
        {driverLiveCoord && (
          <Marker
            key="matched-driver-live"
            coordinate={driverLiveCoord}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <DriverMarker pulse />
          </Marker>
        )}
      </MapView>

      {/* ── TOP STATUS PILL ── */}
      <View style={s.topRow}>
        <View style={[s.pill, drivers.length === 0 && s.pillEmpty]}>
          <View style={[s.pillDot, drivers.length === 0 && { backgroundColor: C.red }]} />
          <Text style={s.pillText}>
            {rideState === RS.MATCHED
              ? '🛺 Driver on the way'
              : drivers.length > 0
                ? `${drivers.length} trike${drivers.length !== 1 ? 's' : ''} nearby`
                : locationError ?? 'No drivers available'}
          </Text>
        </View>
      </View>

      {/* ── SOS (matched only) ── */}
      {rideState === RS.MATCHED && (
        <TouchableOpacity style={s.sosBtn} onPress={handleSOS} activeOpacity={0.85}>
          <Text style={s.sosBtnText}>🆘</Text>
          <Text style={s.sosBtnLabel}>SOS</Text>
        </TouchableOpacity>
      )}

      {/* ── RECENTER FAB ── */}
      {locationReady && (
        <TouchableOpacity style={s.recenterBtn} onPress={handleRecenter} activeOpacity={0.8}>
          <Text style={{ fontSize: 18 }}>📍</Text>
        </TouchableOpacity>
      )}

      {/* ── BOTTOM CARD (idle / searching / matched peek) ── */}
      {rideState !== RS.ARRIVED && (
        <View style={s.bottomCard}>
          <View style={s.handle} />

          <View style={s.infoRow}>
            <View style={s.infoBadge}>
              <Text style={s.infoBadgeText}>🛺 {drivers.length} available</Text>
            </View>
            <View style={s.infoBadge}>
              <Text style={s.infoBadgeText}>
                {locationReady
                  ? '📍 GPS ready'
                  : locationError
                    ? '⚠️ GPS error'
                    : '📍 Getting GPS…'}
              </Text>
            </View>
          </View>

          {/* Destination trigger — opens modal */}
          {rideState === RS.IDLE && (
            <TouchableOpacity
              style={s.destTrigger}
              onPress={() => setDestModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={s.destIcon}>📍</Text>
              <Text
                style={[s.destTriggerText, !destination && { color: C.muted }]}
                numberOfLines={1}
              >
                {destination || 'Saan kayo? — tap to set destination'}
              </Text>
              {destination.length > 0 ? (
                <TouchableOpacity
                  onPress={() => setDestination('')}
                  style={{ padding: 6 }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ color: C.muted, fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              ) : (
                <Text style={{ color: C.accent, fontSize: 20, fontWeight: '700' }}>›</Text>
              )}
            </TouchableOpacity>
          )}

          {rideState === RS.MATCHED && destination.length > 0 && (
            <View style={s.destActiveWrap}>
              <Text style={s.destActiveLabel}>GOING TO</Text>
              <Text style={s.destActiveText} numberOfLines={1}>📍 {destination}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              s.paraBtn,
              rideState === RS.MATCHED   && s.paraBtnMatched,
              rideState === RS.SEARCHING && s.paraBtnSearching,
            ]}
            onPress={handleParaPo}
            activeOpacity={0.82}
            disabled={rideState === RS.SEARCHING || rideState === RS.MATCHED}
          >
            {/* 3-D dome highlight */}
            <View style={s.paraBtnShine} pointerEvents="none" />
            {rideState === RS.SEARCHING ? (
              <>
                <ActivityIndicator color={C.accent} size="large" />
                <Text style={[s.paraBtnText, { color: C.accent, fontSize: 12, marginTop: 8 }]}>
                  Hailing…
                </Text>
              </>
            ) : (
              <>
                <Text style={s.paraBtnEmoji}>
                  {rideState === RS.MATCHED ? '🛺' : '🤚'}
                </Text>
                <Text style={[s.paraBtnText, rideState === RS.MATCHED && { color: '#fff', fontSize: 14 }]}>
                  {rideState === RS.MATCHED ? 'On the way!' : 'Para Po!'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {rideState === RS.IDLE && (
            <Text style={s.hintText}>
              {destination.trim()
                ? 'Tap Para Po! to hail the nearest tricycle'
                : 'Tap the box above to set your destination first'}
            </Text>
          )}
        </View>
      )}

      {/* ── DRIVER MATCHED / ARRIVED CARD ── */}
      {isCardVisible && (
        <Animated.View style={[s.driverCard, { transform: [{ translateY: cardAnim }] }]}>

          {/* MATCHED */}
          {rideState === RS.MATCHED && (
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <View style={s.cardHandle} />
              <Text style={s.matchBadge}>🛺  DRIVER ON THE WAY</Text>

              {/* Prominent driver ID card — name, plate, ETA at a glance */}
              <View style={s.driverIdCard}>
                <View style={{ flex: 1 }}>
                  <Text style={s.driverIdLabel}>DRIVER</Text>
                  <Text style={s.driverIdName} numberOfLines={1}>
                    {driverProfile?.given_name
                      ? [driverProfile.given_name, driverProfile.surname].filter(Boolean).join(' ')
                      : driverProfile?.name ?? '—'}
                  </Text>
                </View>
                {driverProfile?.plate_number ? (
                  <View style={s.driverIdPlate}>
                    <Text style={s.driverIdPlateLabel}>PLATE</Text>
                    <Text style={s.driverIdPlateNum}>{driverProfile.plate_number}</Text>
                  </View>
                ) : null}
                {etaMinutes ? (
                  <View style={s.driverIdETA}>
                    <Text style={s.driverIdETAVal}>~{etaMinutes}</Text>
                    <Text style={s.driverIdETALabel}>min</Text>
                  </View>
                ) : null}
              </View>

              {/* Driver identity (avatar + details) */}
              <View style={s.matchHeader}>
                <View style={s.matchAvatarRing}>
                  {driverProfile?.license_photo_url ? (
                    <Image
                      source={{ uri: driverProfile.license_photo_url }}
                      style={s.matchAvatarImg}
                    />
                  ) : (
                    <View style={s.matchAvatar}>
                      <Text style={{ fontSize: 34 }}>🛺</Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={s.matchName}>{fullName(driverProfile)}</Text>
                  {driverProfile?.average_rating ? (
                    <Text style={s.matchRating}>⭐ {driverProfile.average_rating}  ·  Verified Driver</Text>
                  ) : null}
                  {(driverProfile?.brgy_purok || driverProfile?.city_municipality) ? (
                    <Text style={s.matchAddr} numberOfLines={1}>
                      📍 {[driverProfile.brgy_purok, driverProfile.city_municipality].filter(Boolean).join(', ')}
                    </Text>
                  ) : null}
                  {driverProfile?.toda_location ? (
                    <Text style={s.matchToda}>🏷 TODA: {driverProfile.toda_location}</Text>
                  ) : null}
                </View>
              </View>

              {/* Vehicle badges */}
              {(driverProfile?.plate_number || driverProfile?.toda_location) && (
                <View style={s.vehicleRow}>
                  {driverProfile?.plate_number && (
                    <View style={s.vehicleBadge}>
                      <Text style={s.vehicleLabel}>PLATE</Text>
                      <Text style={s.vehicleVal}>{driverProfile.plate_number}</Text>
                    </View>
                  )}
                  {driverProfile?.toda_location && (
                    <View style={[s.vehicleBadge, { flex: 2 }]}>
                      <Text style={s.vehicleLabel}>TODA</Text>
                      <Text style={s.vehicleVal} numberOfLines={1}>{driverProfile.toda_location}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Route card */}
              <View style={s.routeCard}>
                <View style={s.routeDots}>
                  <View style={[s.rdot, { backgroundColor: C.blue }]} />
                  <View style={s.rline} />
                  <View style={[s.rdot, { backgroundColor: C.accent }]} />
                </View>
                <View style={{ flex: 1, gap: 10 }}>
                  <View>
                    <Text style={s.routeLabel}>PICKUP</Text>
                    <Text style={s.routePlace}>Your current location</Text>
                  </View>
                  <View>
                    <Text style={s.routeLabel}>DESTINATION</Text>
                    <Text style={s.routePlace}>{destination || 'Not specified'}</Text>
                  </View>
                </View>
              </View>

              {/* ── CHAT THREAD ── */}
              <View style={s.chatBox}>
                <ScrollView
                  ref={msgScrollRef}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={s.chatContent}
                  onContentSizeChange={() => msgScrollRef.current?.scrollToEnd({ animated: true })}
                >
                  {rideMessages.length === 0 ? (
                    <Text style={s.chatEmpty}>
                      No messages yet.{'\n'}Propose a fare or type a message below.
                    </Text>
                  ) : (
                    rideMessages.map((msg) => {
                      const isMe      = msg.sender_role === 'passenger';
                      const isFare    = msg.message.startsWith('💰') || msg.message.startsWith('✅ Fare agreed');
                      const fareAmt   = msg.message.match(/₱(\d+)/)?.[1];
                      const agreedFare = activeRide?.agreed_fare;
                      const showAgree = isFare && !isMe && fareAmt && !agreedFare;
                      return (
                        <View key={msg.id ?? msg.created_at}
                          style={[s.msgBubble, isMe ? s.msgBubbleMe : s.msgBubbleThem, isFare && s.msgBubbleFare]}>
                          <Text style={[s.msgText, isMe ? s.msgTextMe : s.msgTextThem]}>
                            {msg.message}
                          </Text>
                          {showAgree && (
                            <TouchableOpacity style={s.agreeBtn} onPress={() => handleAgreeFare(fareAmt)} activeOpacity={0.8}>
                              <Text style={s.agreeBtnText}>✓ Agree to ₱{fareAmt}</Text>
                            </TouchableOpacity>
                          )}
                          {agreedFare && fareAmt && parseInt(fareAmt) === agreedFare && !isMe && (
                            <Text style={s.agreedLabel}>✅ You agreed</Text>
                          )}
                        </View>
                      );
                    })
                  )}
                </ScrollView>
              </View>

              {/* Quick-reply chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cannedRow}>
                {PAX_CANNED.map((msg) => (
                  <TouchableOpacity key={msg} style={s.cannedBtn} onPress={() => handleSendMessage(msg)} activeOpacity={0.75}>
                    <Text style={s.cannedText}>{msg}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Fare bargaining / free-text input */}
              {showFareInput ? (
                <View style={s.fareInputRow}>
                  <Text style={s.fareRowLabel}>💰 Propose</Text>
                  <TextInput
                    style={s.fareInput}
                    placeholder="Amount (e.g. 25)"
                    placeholderTextColor={C.muted}
                    keyboardType="numeric"
                    value={fareInput}
                    onChangeText={setFareInput}
                    autoFocus
                    returnKeyType="send"
                    onSubmitEditing={handleSendFare}
                  />
                  <TouchableOpacity
                    style={[s.fareSendBtn, !fareInput.trim() && { opacity: 0.4 }]}
                    onPress={handleSendFare}
                    disabled={!fareInput.trim()}
                    activeOpacity={0.8}
                  >
                    <Text style={s.fareSendText}>₱ Send</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setShowFareInput(false); setFareInput(''); }}
                    style={s.fareCancelBtn}
                  >
                    <Text style={{ color: C.muted, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.chatInputRow}>
                  <TouchableOpacity style={s.fareToggleBtn} onPress={() => setShowFareInput(true)} activeOpacity={0.8}>
                    <Text style={s.fareToggleText}>💰</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={s.chatInput}
                    placeholder="Type a message…"
                    placeholderTextColor={C.muted}
                    value={freeText}
                    onChangeText={setFreeText}
                    returnKeyType="send"
                    onSubmitEditing={handleSendFree}
                  />
                  <TouchableOpacity
                    style={[s.sendBtn, !freeText.trim() && { opacity: 0.35 }]}
                    onPress={handleSendFree}
                    disabled={!freeText.trim()}
                    activeOpacity={0.8}
                  >
                    <Text style={s.sendBtnText}>↑</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Cancel — 60-second grace window only */}
              {cancelSecsLeft > 0 ? (
                <TouchableOpacity
                  style={s.cancelBtn}
                  onPress={() => {
                    Alert.alert(
                      'Cancel Ride?',
                      'Are you sure? This may affect your driver.',
                      [
                        { text: 'No, keep ride', style: 'cancel' },
                        { text: 'Yes, cancel', style: 'destructive', onPress: () => handleCancel(true) },
                      ],
                    );
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={s.cancelText}>Cancel Ride</Text>
                  <Text style={s.cancelTimer}>Window closes in {cancelSecsLeft}s</Text>
                </TouchableOpacity>
              ) : (
                <View style={s.cancelLocked}>
                  <Text style={s.cancelLockedIcon}>🔒</Text>
                  <Text style={s.cancelLockedText}>Cancellation closed</Text>
                  <Text style={s.cancelLockedSub}>Please wait for your driver — it's fair to them.</Text>
                </View>
              )}
            </ScrollView>
          )}

          {/* ARRIVED + RATING */}
          {rideState === RS.ARRIVED && (
            <View style={s.arrivedWrap}>
              <View style={s.cardHandle} />
              <Text style={{ fontSize: 52, textAlign: 'center' }}>🛺</Text>
              <Text style={s.arrivedTitle}>Nakarating na!</Text>

              {/* Trip summary */}
              <View style={s.tripCard}>
                <View style={s.tripRow}>
                  <Text style={s.tripLabel}>DRIVER</Text>
                  <Text style={s.tripValue} numberOfLines={1}>
                    {driverProfile?.given_name
                      ? [driverProfile.given_name, driverProfile.surname].filter(Boolean).join(' ')
                      : driverProfile?.name ?? '—'}
                  </Text>
                </View>
                {driverProfile?.plate_number ? (
                  <View style={s.tripRow}>
                    <Text style={s.tripLabel}>PLATE</Text>
                    <Text style={s.tripValue}>{driverProfile.plate_number}</Text>
                  </View>
                ) : null}
                <View style={s.tripRow}>
                  <Text style={s.tripLabel}>DESTINATION</Text>
                  <Text style={s.tripValue} numberOfLines={1}>{destination || '—'}</Text>
                </View>
                {activeRide?.agreed_fare ? (
                  <View style={[s.tripRow, { borderBottomWidth: 0 }]}>
                    <Text style={s.tripLabel}>AGREED FARE</Text>
                    <Text style={[s.tripValue, { color: C.accent, fontWeight: '900', fontSize: 17 }]}>
                      ₱{activeRide.agreed_fare}
                    </Text>
                  </View>
                ) : (
                  <View style={[s.tripRow, { borderBottomWidth: 0 }]}>
                    <Text style={s.tripLabel}>FARE</Text>
                    <Text style={[s.tripValue, { color: C.muted }]}>Not agreed in app</Text>
                  </View>
                )}
              </View>

              <Text style={s.ratePrompt}>Rate your driver:</Text>
              <StarRating value={rating} onChange={setRating} />
              {rating > 0 && (
                <Text style={s.rateLabel}>
                  {['', 'Poor 😕', 'Fair 😐', 'Good 🙂', 'Great 😊', 'Excellent! 🤩'][rating]}
                </Text>
              )}
              <TouchableOpacity style={s.doneBtn} onPress={handleDone} activeOpacity={0.85}>
                <Text style={s.doneBtnText}>
                  {rating > 0 ? `Submit ${rating}★ & Done` : 'Skip Rating — Done'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.reportLinkBtn} onPress={() => setShowReportModal(true)}>
                <Text style={s.reportLinkText}>⚠️ Report an issue with this ride</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      )}

      {/* ── REPORT MODAL ── */}
      <Modal visible={showReportModal} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setShowReportModal(false)}>
        <View style={s.reportOverlay}>
          <View style={s.reportCard}>
            <Text style={s.reportTitle}>⚠️ Report an Issue</Text>
            <Text style={s.reportSub}>What happened? Select the reason:</Text>
            {[
              'Driver did not show up',
              'Driver asked for more than agreed fare',
              'Driver was rude or threatening',
              'Driver caused harm or injury',
              'Other',
            ].map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[s.reportOption, selectedReason === reason && s.reportOptionSelected]}
                onPress={() => setSelectedReason(reason)}
                activeOpacity={0.8}
              >
                <Text style={[s.reportOptionText, selectedReason === reason && { color: C.accent }]}>
                  {reason}
                </Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={s.reportDescInput}
              placeholder="Additional details (optional)…"
              placeholderTextColor={C.muted}
              value={reportDesc}
              onChangeText={setReportDesc}
              multiline
              numberOfLines={3}
            />
            <View style={s.reportBtnRow}>
              <TouchableOpacity style={s.reportCancelBtn} onPress={() => { setShowReportModal(false); setSelectedReason(''); setReportDesc(''); }} activeOpacity={0.8}>
                <Text style={{ color: C.muted, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.reportSubmitBtn, (!selectedReason || reportSubmitting) && { opacity: 0.4 }]}
                onPress={handleSubmitReport}
                disabled={!selectedReason || reportSubmitting}
                activeOpacity={0.85}
              >
                {reportSubmitting
                  ? <ActivityIndicator size="small" color="#000" />
                  : <Text style={s.reportSubmitText}>Submit Report</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── DESTINATION MODAL ── */}
      <DestinationModal
        visible={destModalVisible}
        value={destination}
        onChange={setDestination}
        onClose={() => setDestModalVisible(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  topRow: { position: 'absolute', top: 16, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(20,20,20,0.92)', borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 9,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 12, elevation: 8,
  },
  pillEmpty: { borderColor: 'rgba(239,68,68,0.3)' },
  pillDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  pillText:  { color: C.text, fontSize: 13, fontWeight: '600' },

  sosBtn: {
    position: 'absolute', top: 70, right: 16,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: C.red, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.red, shadowOpacity: 0.8, shadowRadius: 14, elevation: 14,
  },
  sosBtnText:  { fontSize: 20 },
  sosBtnLabel: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 1 },

  recenterBtn: {
    position: 'absolute', right: 16, bottom: 200,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 10, elevation: 10,
  },

  // ── Bottom card ───────────────────────────────────────────
  bottomCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    padding: 20, paddingBottom: 38,
    borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.07)',
    shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: 20, elevation: 20,
  },
  handle:        { width: 44, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  infoRow:       { flexDirection: 'row', gap: 8, marginBottom: 12 },
  infoBadge:     { flex: 1, backgroundColor: C.surface2, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  infoBadgeText: { fontSize: 12, color: C.muted, fontWeight: '500' },

  destTrigger: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface2, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, marginBottom: 14, height: 52,
  },
  destIcon:        { fontSize: 18, marginRight: 10 },
  destTriggerText: { flex: 1, fontSize: 15, color: C.text },

  destActiveWrap: {
    backgroundColor: C.surface2, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)',
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
  },
  destActiveLabel: { fontSize: 10, color: C.blue, fontWeight: '700', letterSpacing: 0.8 },
  destActiveText:  { fontSize: 14, color: C.text, fontWeight: '600', marginTop: 2 },

  paraBtn: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: 10,
    // 3-D border: lighter top edge, darker bottom edge
    borderWidth: 2,
    borderTopColor:    'rgba(255,255,255,0.45)',
    borderLeftColor:   'rgba(255,255,255,0.22)',
    borderRightColor:  'rgba(0,0,0,0.18)',
    borderBottomColor: 'rgba(0,0,0,0.32)',
    // depth shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 16,
  },
  paraBtnShine: {
    position: 'absolute', top: 10, left: 18,
    width: 56, height: 26, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  paraBtnSearching: {
    backgroundColor: C.surface2,
    borderColor: C.border,
    shadowOpacity: 0, elevation: 4,
  },
  paraBtnMatched: {
    backgroundColor: C.green,
    borderTopColor:    'rgba(255,255,255,0.4)',
    borderBottomColor: 'rgba(0,0,0,0.3)',
    shadowColor: C.green,
  },
  paraBtnEmoji: { fontSize: 38, marginBottom: 2 },
  paraBtnText:  { fontSize: 17, fontWeight: '900', color: '#000', textAlign: 'center' },
  hintText:     { textAlign: 'center', color: C.muted2, fontSize: 12, marginTop: 4 },

  // ── Driver matched card ───────────────────────────────────
  driverCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    maxHeight: '80%',
    paddingHorizontal: 20, paddingTop: 0, paddingBottom: 44,
    borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.07)',
    shadowColor: '#000', shadowOpacity: 1, shadowRadius: 30, elevation: 30,
  },
  cardHandle:  { width: 44, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginVertical: 16 },
  matchBadge:  { fontSize: 11, fontWeight: '800', color: C.green, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 },
  matchHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  matchAvatarRing: { width: 80, height: 80, borderRadius: 40, borderWidth: 2.5, borderColor: C.accent, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  matchAvatarImg:  { width: 80, height: 80, borderRadius: 40 },
  matchAvatar:     { width: 80, height: 80, borderRadius: 40, backgroundColor: C.orangeDim, alignItems: 'center', justifyContent: 'center' },
  matchName:       { fontSize: 19, fontWeight: '900', color: C.text, marginBottom: 3 },
  matchRating:     { fontSize: 12, color: C.accent, marginBottom: 2 },
  matchAddr:       { fontSize: 12, color: C.muted, marginBottom: 2 },
  matchToda:       { fontSize: 12, color: C.muted },

  vehicleRow:   { flexDirection: 'row', gap: 8, marginBottom: 12 },
  vehicleBadge: { flex: 1, backgroundColor: C.surface2, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: C.border },
  vehicleLabel: { fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  vehicleVal:   { fontSize: 14, fontWeight: '700', color: C.text, marginTop: 2 },

  routeCard:  { flexDirection: 'row', gap: 14, padding: 14, backgroundColor: C.surface2, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  routeDots:  { alignItems: 'center', paddingTop: 3 },
  rdot:       { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: '#fff' },
  rline:      { width: 2, flex: 1, backgroundColor: C.border, marginVertical: 4 },
  routeLabel: { fontSize: 10, color: C.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
  routePlace: { fontSize: 14, fontWeight: '600', color: C.text, marginTop: 2 },

  incomingMsgWrap: {
    backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)',
    padding: 12, marginBottom: 10,
  },
  incomingMsgLabel: { fontSize: 10, color: C.blue, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  incomingMsgText:  { fontSize: 14, color: C.text, fontStyle: 'italic' },
  cannedTitle: { fontSize: 11, color: C.muted, fontWeight: '600', marginBottom: 8 },
  cannedRow:   { paddingBottom: 12, gap: 8, flexDirection: 'row' },
  cannedBtn:   { backgroundColor: C.surface2, borderRadius: 20, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 10 },
  cannedText:  { fontSize: 13, color: C.text, fontWeight: '600' },

  cancelBtn: {
    borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 15, alignItems: 'center', backgroundColor: C.redDim, marginTop: 4,
  },
  cancelText:  { color: C.red, fontSize: 15, fontWeight: '700' },
  cancelTimer: { fontSize: 11, color: C.red, opacity: 0.7, marginTop: 3 },
  cancelLocked: {
    borderRadius: 14, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.surface2, padding: 16, alignItems: 'center', marginTop: 4, gap: 4,
  },
  cancelLockedIcon: { fontSize: 20 },
  cancelLockedText: { color: C.muted, fontSize: 13, fontWeight: '700' },
  cancelLockedSub:  { color: C.muted2, fontSize: 11, textAlign: 'center' },

  // ── Driver ID card ────────────────────────────────────────
  driverIdCard: {
    backgroundColor: C.accentDim,
    borderRadius: 14, borderWidth: 1.5, borderColor: C.accent + '55',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    marginBottom: 14, gap: 12,
  },
  driverIdLabel:      { fontSize: 10, color: C.accent, fontWeight: '700', letterSpacing: 1 },
  driverIdName:       { fontSize: 19, fontWeight: '900', color: C.text, marginTop: 2 },
  driverIdPlate: {
    backgroundColor: C.surface3, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center',
    borderWidth: 1, borderColor: C.border, minWidth: 72,
  },
  driverIdPlateLabel: { fontSize: 9, color: C.muted, fontWeight: '700', letterSpacing: 1 },
  driverIdPlateNum:   { fontSize: 16, fontWeight: '900', color: C.text, marginTop: 2, letterSpacing: 1 },
  driverIdETA: {
    backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)', minWidth: 54,
  },
  driverIdETAVal:   { fontSize: 20, fontWeight: '900', color: C.green },
  driverIdETALabel: { fontSize: 9, color: C.green, fontWeight: '700' },

  // ── Chat thread ───────────────────────────────────────────
  chatBox: {
    maxHeight: 160,
    backgroundColor: C.surface2, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    marginBottom: 10, overflow: 'hidden',
  },
  chatContent: { padding: 10, gap: 6 },
  chatEmpty:   { fontSize: 12, color: C.muted, textAlign: 'center', paddingVertical: 18, fontStyle: 'italic' },
  msgBubble:   { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  msgBubbleMe:   { alignSelf: 'flex-end',   backgroundColor: C.accent },
  msgBubbleThem: { alignSelf: 'flex-start', backgroundColor: C.surface3 },
  msgText:    { fontSize: 14 },
  msgTextMe:   { color: '#000', fontWeight: '600' },
  msgTextThem: { color: C.text },

  // ── Chat input ────────────────────────────────────────────
  chatInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface2, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 10, height: 48, gap: 6, marginBottom: 8,
  },
  chatInput:      { flex: 1, fontSize: 14, color: C.text },
  fareToggleBtn:  {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: C.accentDim, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.accent + '44',
  },
  fareToggleText: { fontSize: 18 },
  sendBtn:        {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnText:    { fontSize: 18, fontWeight: '900', color: '#000' },

  // ── Fare proposal input ───────────────────────────────────
  fareInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.accentDim, borderRadius: 14,
    borderWidth: 1, borderColor: C.accent + '55',
    paddingHorizontal: 12, height: 52, gap: 8, marginBottom: 8,
  },
  fareRowLabel:  { fontSize: 13, color: C.accent, fontWeight: '700' },
  fareInput:     { flex: 1, fontSize: 18, color: C.text, fontWeight: '700' },
  fareSendBtn:   {
    backgroundColor: C.accent, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  fareSendText:  { color: '#000', fontWeight: '800', fontSize: 13 },
  fareCancelBtn: { padding: 6 },

  // ── Fare bubble extras ────────────────────────────────────
  msgBubbleFare: { borderWidth: 1.5, borderColor: C.accent + '66' },
  agreeBtn:      {
    marginTop: 8, backgroundColor: C.accent, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'flex-start',
  },
  agreeBtnText:  { fontSize: 13, fontWeight: '800', color: '#000' },
  agreedLabel:   { fontSize: 11, color: C.green, fontWeight: '700', marginTop: 6 },

  // ── Trip summary card ────────────────────────────────────
  tripCard: {
    width: '100%', backgroundColor: C.surface2,
    borderRadius: 14, borderWidth: 1, borderColor: C.border,
    marginVertical: 12, overflow: 'hidden',
  },
  tripRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  tripLabel: { fontSize: 10, color: C.muted, fontWeight: '700', letterSpacing: 0.8 },
  tripValue: { fontSize: 14, fontWeight: '700', color: C.text, maxWidth: '60%', textAlign: 'right' },

  // ── Report link ───────────────────────────────────────────
  reportLinkBtn:  { marginTop: 14, padding: 8 },
  reportLinkText: { fontSize: 12, color: C.red, fontWeight: '600', textDecorationLine: 'underline' },

  // ── Report modal ──────────────────────────────────────────
  reportOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  reportCard: {
    backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    padding: 22, paddingBottom: 40,
    borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.08)',
  },
  reportTitle:   { fontSize: 17, fontWeight: '800', color: C.text, marginBottom: 6 },
  reportSub:     { fontSize: 13, color: C.muted, marginBottom: 14 },
  reportOption:  {
    padding: 13, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    backgroundColor: C.surface2, marginBottom: 8,
  },
  reportOptionSelected: { borderColor: C.accent, backgroundColor: C.accentDim },
  reportOptionText:     { fontSize: 14, color: C.text, fontWeight: '500' },
  reportDescInput: {
    backgroundColor: C.surface2, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    padding: 12, color: C.text, fontSize: 14,
    marginTop: 6, marginBottom: 14,
    minHeight: 70, textAlignVertical: 'top',
  },
  reportBtnRow:    { flexDirection: 'row', gap: 10 },
  reportCancelBtn: {
    flex: 1, padding: 14, borderRadius: 12,
    backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  reportSubmitBtn:  { flex: 2, padding: 14, borderRadius: 12, backgroundColor: C.red, alignItems: 'center' },
  reportSubmitText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // ── Arrived + Rating ─────────────────────────────────────
  arrivedWrap:  { alignItems: 'center', paddingVertical: 8 },
  arrivedTitle: { fontSize: 28, fontWeight: '900', color: C.green, marginTop: 8 },
  ratePrompt:   { fontSize: 16, fontWeight: '700', color: C.text, marginTop: 4 },
  rateLabel:    { fontSize: 14, color: C.accent, fontWeight: '600', marginBottom: 4 },
  doneBtn:      { backgroundColor: C.accent, borderRadius: 16, paddingHorizontal: 32, paddingVertical: 16, marginTop: 10 },
  doneBtnText:  { fontSize: 15, fontWeight: '800', color: '#000' },
});
