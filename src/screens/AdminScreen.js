import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Modal, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { C } from '../theme/colors';

const ACTIVITY_ICONS = { accepted: '🛺', completed: '✅', pending: '📍', declined: '❌' };

const REPORT_REASONS = {
  no_show:          'No-show',
  verbal_abuse:     'Verbal Abuse',
  unsafe_driving:   'Unsafe Driving',
  overcharging:     'Overcharging',
  harassment:       'Harassment',
  other:            'Other',
};

export default function AdminScreen() {
  const { session } = useAuthStore();
  const mountedRef = useRef(true);

  // Dashboard state
  const [stats, setStats]           = useState({ driversOnline: 0, activeRides: 0, ridesToday: 0, completedRides: 0 });
  const [drivers, setDrivers]       = useState([]);
  const [recentRides, setRecentRides] = useState([]);
  const [activity, setActivity]     = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Reports state
  const [reports, setReports]       = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Message modal state
  const [msgModal, setMsgModal]     = useState(false);
  const [msgTarget, setMsgTarget]   = useState(null);   // { id, name }
  const [msgText, setMsgText]       = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const [activeReportId, setActiveReportId] = useState(null);

  useEffect(() => {
    mountedRef.current = true;
    loadAll();
    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, () => {
        if (mountedRef.current) loadDrivers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_requests' }, (p) => {
        if (!mountedRef.current) return;
        loadRides();
        if (p.new) {
          const icon = ACTIVITY_ICONS[p.new.status] ?? '📋';
          const txt = `Ride #${p.new.id?.slice(0, 6) ?? '?'} → ${p.new.status}`;
          setActivity((prev) => [{ icon, text: txt, time: 'just now', id: Date.now() }, ...prev].slice(0, 8));
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, () => {
        if (mountedRef.current) loadReports();
      })
      .subscribe();
    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const loadAll = async () => {
    await Promise.allSettled([loadDrivers(), loadRides(), loadReports()]);
  };

  const loadDrivers = async () => {
    try {
      const { data } = await supabase
        .from('driver_locations')
        .select('*, profile:driver_id(name, plate_number)');
      if (!mountedRef.current) return;
      setDrivers(data ?? []);
      setStats((p) => ({ ...p, driversOnline: (data ?? []).length }));
    } catch (_) {}
  };

  const loadRides = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from('ride_requests')
        .select('*, passenger:passenger_id(name), driver:driver_id(name)')
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false })
        .limit(20);
      if (!mountedRef.current) return;
      const rides = data ?? [];
      setRecentRides(rides);
      setStats((p) => ({
        ...p,
        activeRides:    rides.filter((r) => r.status === 'accepted').length,
        ridesToday:     rides.filter((r) => r.status !== 'declined').length,
        completedRides: rides.filter((r) => r.status === 'completed').length,
      }));
    } catch (_) {}
  };

  const loadReports = async () => {
    setReportsLoading(true);
    try {
      const { data } = await supabase
        .from('reports')
        .select('*, reporter:reporter_id(name, role), reported:reported_id(name, role, is_disabled)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (mountedRef.current) setReports(data ?? []);
    } catch (_) {}
    if (mountedRef.current) setReportsLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    if (mountedRef.current) setRefreshing(false);
  };

  // ── Report actions ────────────────────────────────────────────────────────

  const openWarnModal = (report) => {
    setMsgTarget({ id: report.reported_id, name: report.reported?.name ?? 'User' });
    setActiveReportId(report.id);
    setMsgText('');
    setMsgModal(true);
  };

  const handleSendWarning = async () => {
    if (!msgText.trim()) { Alert.alert('Empty message', 'Please type a message.'); return; }
    const adminId = session?.user?.id;
    if (!adminId) return;
    setMsgSending(true);
    try {
      await supabase.from('admin_messages').insert({
        admin_id: adminId,
        user_id:  msgTarget.id,
        message:  msgText.trim(),
      });
      // Increment warning_count
      await supabase.rpc('increment_warning', { uid: msgTarget.id }).catch(async () => {
        // Fallback if RPC not set up: read then write
        const { data: p } = await supabase.from('profiles').select('warning_count').eq('id', msgTarget.id).single();
        await supabase.from('profiles').update({ warning_count: (p?.warning_count ?? 0) + 1 }).eq('id', msgTarget.id);
      });
      // Mark report as reviewed after warning is sent
      if (activeReportId) {
        await supabase.from('reports').update({ status: 'reviewed' }).eq('id', activeReportId);
      }
      setMsgModal(false);
      setMsgText('');
      loadReports();
      Alert.alert('Warning sent ✓', `Message delivered to ${msgTarget.name}.`);
    } catch (e) {
      Alert.alert('Error', e?.message ?? 'Failed to send warning.');
    } finally {
      setMsgSending(false);
    }
  };

  const handleDisableUser = (report) => {
    const name = report.reported?.name ?? 'this user';
    Alert.alert(
      '🚫 Disable Account',
      `Disable ${name}? They will not be able to log in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('profiles').update({
                is_disabled:     true,
                disabled_reason: `Suspended after report: ${REPORT_REASONS[report.reason] ?? report.reason}`,
              }).eq('id', report.reported_id);
              await supabase.from('reports').update({ status: 'actioned' }).eq('id', report.id);
              loadReports();
              Alert.alert('Account disabled ✓', `${name}'s account has been suspended.`);
            } catch (e) {
              Alert.alert('Error', e?.message ?? 'Failed to disable account.');
            }
          },
        },
      ],
    );
  };

  const handleEnableUser = (profileId, name) => {
    Alert.alert(
      'Enable Account',
      `Restore access for ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Enable',
          onPress: async () => {
            try {
              await supabase.from('profiles').update({
                is_disabled: false, disabled_reason: null,
              }).eq('id', profileId);
              Alert.alert('Done ✓', `${name}'s account is now active.`);
              loadDrivers();
            } catch (e) {
              Alert.alert('Error', e?.message ?? 'Failed.');
            }
          },
        },
      ],
    );
  };

  const handleDismissReport = async (reportId) => {
    try {
      await supabase.from('reports').update({ status: 'dismissed' }).eq('id', reportId);
      setReports((r) => r.filter((x) => x.id !== reportId));
    } catch (e) {
      Alert.alert('Error', e?.message ?? 'Failed to dismiss.');
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────

  const STAT_CARDS = [
    { icon: '🛺', val: stats.driversOnline, lbl: 'Drivers Online', color: C.green },
    { icon: '🚀', val: stats.activeRides,   lbl: 'Active Rides',   color: C.orange },
    { icon: '✅', val: stats.ridesToday,    lbl: 'Rides Today',    color: C.blue },
    { icon: '⭐', val: stats.completedRides ?? stats.ridesToday, lbl: 'Completed', color: C.accent },
  ];

  const STATUS_COLOR = { pending: C.orange, accepted: C.blue, declined: C.red, completed: C.green };

  return (
    <>
      <ScrollView
        style={s.root}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Control Center</Text>
            <Text style={s.headerSub}>ParaPo Operations · Real-time</Text>
          </View>
          <View style={s.liveBadge}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>LIVE</Text>
          </View>
        </View>

        {/* ── Stats Grid ── */}
        <View style={s.statsGrid}>
          {STAT_CARDS.map((card) => (
            <View key={card.lbl} style={s.statCard}>
              <Text style={s.statIcon}>{card.icon}</Text>
              <Text style={[s.statVal, { color: card.color }]}>{card.val}</Text>
              <Text style={s.statLbl}>{card.lbl}</Text>
            </View>
          ))}
        </View>

        {/* ── Pending Reports ── */}
        <View style={s.panel}>
          <View style={s.panelHeader}>
            <Text style={s.panelTitle}>⚠️ Pending Reports</Text>
            <View style={[s.panelBadge, reports.length > 0 && { backgroundColor: C.redDim }]}>
              <Text style={[s.panelBadgeText, reports.length > 0 && { color: C.red }]}>
                {reportsLoading ? '…' : `${reports.length} pending`}
              </Text>
            </View>
          </View>
          {reportsLoading ? (
            <ActivityIndicator color={C.accent} style={{ padding: 20 }} />
          ) : reports.length === 0 ? (
            <Text style={s.emptyText}>No pending reports</Text>
          ) : (
            reports.map((r, i) => (
              <View key={r.id ?? i} style={[s.reportCard, i === reports.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={s.reportMeta}>
                  <Text style={s.reporterText}>
                    <Text style={{ color: C.blue }}>
                      {r.reporter?.role === 'driver' ? '🛺' : '🤚'} {r.reporter?.name ?? 'Unknown'}
                    </Text>
                    {' reported '}
                    <Text style={{ color: C.red }}>
                      {r.reported?.role === 'driver' ? '🛺' : '🤚'} {r.reported?.name ?? 'Unknown'}
                    </Text>
                  </Text>
                  <View style={s.reasonTag}>
                    <Text style={s.reasonTagText}>{REPORT_REASONS[r.reason] ?? r.reason ?? 'Other'}</Text>
                  </View>
                </View>
                {r.description ? (
                  <Text style={s.reportDesc} numberOfLines={3}>{r.description}</Text>
                ) : null}
                {r.reported?.is_disabled ? (
                  <View style={s.disabledTag}>
                    <Text style={s.disabledTagText}>🚫 Account already suspended</Text>
                  </View>
                ) : null}
                <View style={s.reportActions}>
                  <TouchableOpacity style={s.actionWarn} onPress={() => openWarnModal(r)}>
                    <Text style={s.actionWarnText}>⚠️ Warn</Text>
                  </TouchableOpacity>
                  {!r.reported?.is_disabled && (
                    <TouchableOpacity style={s.actionDisable} onPress={() => handleDisableUser(r)}>
                      <Text style={s.actionDisableText}>🚫 Disable</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={s.actionDismiss} onPress={() => handleDismissReport(r.id)}>
                    <Text style={s.actionDismissText}>✓ Dismiss</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Online Drivers ── */}
        <View style={s.panel}>
          <View style={s.panelHeader}>
            <Text style={s.panelTitle}>Online Drivers</Text>
            <View style={s.panelBadge}>
              <Text style={s.panelBadgeText}>{drivers.length} active</Text>
            </View>
          </View>
          {drivers.length === 0 ? (
            <Text style={s.emptyText}>No drivers online right now</Text>
          ) : (
            drivers.map((d, i) => {
              const driverName  = d.profile?.name ?? `Driver #${(d.driver_id ?? '?').slice(0, 8)}`;
              const plateNumber = d.profile?.plate_number ?? '—';
              return (
                <View key={d.driver_id ?? i} style={[s.driverRow, i === drivers.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={s.driverAv}><Text style={{ fontSize: 18 }}>🛺</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.driverName}>{driverName}</Text>
                    <Text style={s.driverMeta}>
                      Plate: {plateNumber} · {d.lat?.toFixed(4) ?? '?'}, {d.lng?.toFixed(4) ?? '?'}
                    </Text>
                  </View>
                  <View style={s.driverActions}>
                    <View style={[s.statusDot, { backgroundColor: d.is_available ? C.green : C.orange }]} />
                    {d.profile?.is_disabled ? (
                      <TouchableOpacity
                        style={s.enableBtn}
                        onPress={() => handleEnableUser(d.driver_id, driverName)}
                      >
                        <Text style={s.enableBtnText}>Enable</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ── Live Activity ── */}
        <View style={s.panel}>
          <View style={s.panelHeader}>
            <Text style={s.panelTitle}>Live Activity</Text>
            <View style={s.panelBadge}>
              <Text style={s.panelBadgeText}>{activity.length} events</Text>
            </View>
          </View>
          {activity.length === 0 ? (
            <Text style={s.emptyText}>Waiting for activity…</Text>
          ) : (
            activity.map((item, i) => (
              <View key={item.id ?? i} style={[s.activityItem, i === activity.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={s.activityIcon}>{item.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.activityText}>{item.text}</Text>
                  <Text style={s.activityTime}>{item.time}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Recent Rides ── */}
        <View style={s.panel}>
          <View style={s.panelHeader}>
            <Text style={s.panelTitle}>Recent Rides</Text>
          </View>
          {recentRides.length === 0 ? (
            <Text style={s.emptyText}>No rides today yet</Text>
          ) : (
            recentRides.slice(0, 8).map((ride, i) => {
              const color = STATUS_COLOR[ride.status] ?? C.muted;
              const passengerName = ride.passenger?.name ?? `#${(ride.passenger_id ?? '?').slice(0, 6)}`;
              const driverName    = ride.driver?.name    ?? `#${(ride.driver_id    ?? '?').slice(0, 6)}`;
              return (
                <View key={ride.id ?? i} style={[s.rideRow, i === Math.min(7, recentRides.length - 1) && { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rideNames} numberOfLines={1}>
                      🤚 {passengerName} → 🛺 {driverName}
                    </Text>
                    {ride.agreed_fare ? (
                      <Text style={s.rideFare}>💰 ₱{ride.agreed_fare}</Text>
                    ) : null}
                  </View>
                  <View style={[s.rideBadge, { backgroundColor: color + '20' }]}>
                    <Text style={[s.rideBadgeText, { color }]}>{ride.status}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ── Warning / Message Modal ── */}
      <Modal
        visible={msgModal}
        animationType="slide"
        transparent
        onRequestClose={() => !msgSending && setMsgModal(false)}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>⚠️ Send Warning</Text>
              <TouchableOpacity onPress={() => !msgSending && setMsgModal(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {msgTarget ? (
              <Text style={s.modalTo}>To: <Text style={{ color: C.accent }}>{msgTarget.name}</Text></Text>
            ) : null}
            <TextInput
              style={s.msgInput}
              value={msgText}
              onChangeText={setMsgText}
              placeholder="Type your warning or message to this user…"
              placeholderTextColor={C.muted2}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              autoFocus
            />
            <TouchableOpacity
              style={[s.sendBtn, msgSending && { opacity: 0.6 }]}
              onPress={handleSendWarning}
              disabled={msgSending}
              activeOpacity={0.8}
            >
              {msgSending
                ? <ActivityIndicator color="#000" />
                : <Text style={s.sendBtnText}>Send Warning</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 40 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, marginTop: 4 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: C.text },
  headerSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.greenDim, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)',
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
  liveText: { fontSize: 12, fontWeight: '700', color: C.green },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    width: '47%', backgroundColor: C.surface, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: C.border,
  },
  statIcon: { fontSize: 20, marginBottom: 8 },
  statVal:  { fontSize: 26, fontWeight: '900' },
  statLbl:  { fontSize: 12, color: C.muted, marginTop: 3 },

  panel: {
    backgroundColor: C.surface, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, marginBottom: 14, overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  panelTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  panelBadge: { backgroundColor: C.surface3, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  panelBadgeText: { fontSize: 12, fontWeight: '600', color: C.muted },
  emptyText: { fontSize: 13, color: C.muted, padding: 16, textAlign: 'center' },

  // ── Reports ───────────────────────────────────────────────
  reportCard: {
    padding: 14, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  reportMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 },
  reporterText: { fontSize: 13, color: C.text, flex: 1 },
  reasonTag: {
    backgroundColor: C.orangeDim ?? 'rgba(251,146,60,0.15)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: C.orange + '44',
  },
  reasonTagText: { fontSize: 11, fontWeight: '700', color: C.orange },
  reportDesc: { fontSize: 12, color: C.muted, lineHeight: 17, marginBottom: 8 },
  disabledTag: {
    backgroundColor: C.redDim, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
    marginBottom: 8, alignSelf: 'flex-start',
  },
  disabledTagText: { fontSize: 11, fontWeight: '700', color: C.red },
  reportActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionWarn: {
    flex: 1, backgroundColor: 'rgba(251,146,60,0.12)', borderRadius: 10,
    padding: 9, alignItems: 'center',
    borderWidth: 1, borderColor: C.orange + '44',
  },
  actionWarnText: { fontSize: 12, fontWeight: '700', color: C.orange },
  actionDisable: {
    flex: 1, backgroundColor: C.redDim, borderRadius: 10,
    padding: 9, alignItems: 'center',
    borderWidth: 1, borderColor: C.red + '44',
  },
  actionDisableText: { fontSize: 12, fontWeight: '700', color: C.red },
  actionDismiss: {
    flex: 1, backgroundColor: C.surface2, borderRadius: 10,
    padding: 9, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  actionDismissText: { fontSize: 12, fontWeight: '700', color: C.muted },

  // ── Drivers ───────────────────────────────────────────────
  driverRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  driverAv: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center',
  },
  driverName:    { fontSize: 13, fontWeight: '600', color: C.text },
  driverMeta:    { fontSize: 11, color: C.muted, marginTop: 2 },
  driverActions: { alignItems: 'center', gap: 6 },
  statusDot:     { width: 9, height: 9, borderRadius: 5 },
  enableBtn: {
    backgroundColor: C.greenDim, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: C.green + '44',
  },
  enableBtnText: { fontSize: 11, fontWeight: '700', color: C.green },

  // ── Activity ──────────────────────────────────────────────
  activityItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  activityIcon: { fontSize: 16, width: 24, textAlign: 'center' },
  activityText: { fontSize: 13, color: C.muted },
  activityTime: { fontSize: 11, color: C.muted2, marginTop: 3 },

  // ── Ride rows ─────────────────────────────────────────────
  rideRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  rideNames:    { fontSize: 12, fontWeight: '600', color: C.text },
  rideFare:     { fontSize: 11, color: C.muted, marginTop: 2 },
  rideBadge:    { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  rideBadgeText:{ fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  // ── Message modal ─────────────────────────────────────────
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle:  { fontSize: 17, fontWeight: '800', color: C.text },
  modalClose:  { fontSize: 18, color: C.muted, paddingHorizontal: 4 },
  modalTo:     { fontSize: 13, color: C.muted, marginBottom: 10 },
  msgInput: {
    backgroundColor: C.bg, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 14, fontSize: 14, color: C.text, minHeight: 110, marginBottom: 14,
  },
  sendBtn: {
    backgroundColor: C.accent, borderRadius: 14, padding: 16, alignItems: 'center',
  },
  sendBtnText: { fontSize: 15, fontWeight: '800', color: '#000' },
});
