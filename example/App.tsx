import React, { useEffect, useState } from 'react';
import {
  DeviceEventEmitter,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { useUsbSerial } from 'react-native-usb-serial-android';

// Android can report StatusBar.currentHeight=0 in edge-to-edge mode (default on
// Android 15+). Use a safe minimum so the title isn't drawn under the status bar.
const SAFE_TOP = Platform.OS === 'android'
  ? Math.max(StatusBar.currentHeight ?? 0, 40)
  : 0;

export default function App() {
  const [log, setLog] = useState('');
  const [demoActive, setDemoActive] = useState(false);

  const {
    connected,
    status,
    error,
    connect,
    disconnect,
    startReading,
    stopReading,
  } = useUsbSerial({
    onData: (chunk) => setLog((prev) => (prev + chunk).slice(-4000)),
  });

  useEffect(() => {
    if (!demoActive) return;

    DeviceEventEmitter.emit('usbConnected', true);
    DeviceEventEmitter.emit('usbStatus', 'Connected (demo) — 9600 baud, 8N1');

    let i = 0;
    const interval = setInterval(() => {
      const ts = new Date().toTimeString().slice(0, 8);
      const t = (22.0 + Math.sin(i / 10) * 2 + Math.random() * 0.3).toFixed(2);
      const h = (55 + Math.cos(i / 8) * 5 + Math.random() * 1.5).toFixed(1);
      const p = (1013.2 + Math.sin(i / 15) * 1.4).toFixed(2);
      DeviceEventEmitter.emit(
        'usbData',
        `[${ts}] T=${t}C  H=${h}%  P=${p}hPa\n`
      );
      i++;
    }, 450);

    return () => {
      clearInterval(interval);
      DeviceEventEmitter.emit('usbConnected', false);
      DeviceEventEmitter.emit('usbStatus', 'Demo stopped');
    };
  }, [demoActive]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0b0b" />

      <View style={styles.header}>
        <Text style={styles.title}>USB Serial</Text>
        <Pressable onPress={() => demoActive && setDemoActive(false)} hitSlop={16}>
          <View style={[styles.dot, { backgroundColor: connected ? '#0f0' : '#444' }]} />
        </Pressable>
      </View>

      <View style={styles.statusBox}>
        <Text style={styles.statusLabel}>Status</Text>
        <Text style={styles.statusValue}>{status}</Text>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={styles.row}>
        <Pressable
          style={styles.btn}
          onPress={() => connect({ baudRate: 9600 })}
          disabled={demoActive}
        >
          <Text style={[styles.btnText, demoActive && styles.btnTextDim]}>Connect</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={disconnect} disabled={demoActive}>
          <Text style={[styles.btnText, demoActive && styles.btnTextDim]}>Disconnect</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={startReading} disabled={demoActive}>
          <Text style={[styles.btnText, demoActive && styles.btnTextDim]}>Start reading</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={stopReading} disabled={demoActive}>
          <Text style={[styles.btnText, demoActive && styles.btnTextDim]}>Stop reading</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => setLog('')}>
          <Text style={styles.btnText}>Clear</Text>
        </Pressable>
      </View>

      {!demoActive && (
        <Pressable style={styles.demoBtn} onPress={() => setDemoActive(true)}>
          <Text style={styles.demoBtnText}>
            ▶ Start demo (simulated data, no hardware needed)
          </Text>
        </Pressable>
      )}

      <Text style={styles.logLabel}>Raw data</Text>
      <ScrollView style={styles.logBox}>
        <Text style={styles.logText}>{log || '(no data yet)'}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0b',
    padding: 16,
    paddingTop: SAFE_TOP + 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', flex: 1 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  statusBox: {
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginBottom: 16,
  },
  statusLabel: { color: '#888', fontSize: 12 },
  statusValue: { color: '#fff', fontSize: 14, marginTop: 2 },
  error: { color: '#ff5555', marginTop: 6 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  btn: {
    flex: 1,
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '600' },
  btnTextDim: { color: '#666' },
  demoBtn: {
    padding: 12,
    backgroundColor: '#1f3a5f',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  demoBtnText: { color: '#cce4ff', fontWeight: '600' },
  logLabel: { color: '#888', fontSize: 12, marginTop: 12, marginBottom: 4 },
  logBox: { flex: 1, backgroundColor: '#000', borderRadius: 8, padding: 8 },
  logText: { color: '#0f0', fontFamily: 'monospace', fontSize: 12 },
});
