import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';
import type { ConnectOptions, UsbSerialEventMap, Subscription } from './types';

const LINKING_ERROR =
  `react-native-usb-serial-android: the native module is not linked.\n` +
  `- Make sure you ran \`cd android && ./gradlew clean\` after install\n` +
  `- Rebuild the app (\`npx react-native run-android\`)\n` +
  `- This library is Android-only; on iOS the module will be undefined.`;

const native: any =
  NativeModules.UsbSerialModule ??
  new Proxy(
    {},
    {
      get() {
        throw new Error(LINKING_ERROR);
      },
    }
  );

const NATIVE_EVENT_NAMES: Record<keyof UsbSerialEventMap, string> = {
  data: 'usbData',
  status: 'usbStatus',
  error: 'usbError',
  connected: 'usbConnected',
};

export const UsbSerial = {
  isSupported(): boolean {
    return Platform.OS === 'android' && !!NativeModules.UsbSerialModule;
  },

  async connect(options: ConnectOptions = {}): Promise<string> {
    const { baudRate = 9600, dataBits = 8, stopBits = 1 } = options;
    return native.connect(baudRate, dataBits, stopBits);
  },

  async disconnect(): Promise<string> {
    return native.disconnect();
  },

  startReading(): void {
    native.startReading();
  },

  stopReading(): void {
    native.stopReading();
  },

  addListener<E extends keyof UsbSerialEventMap>(
    event: E,
    callback: (payload: UsbSerialEventMap[E]) => void
  ): Subscription {
    const sub = DeviceEventEmitter.addListener(
      NATIVE_EVENT_NAMES[event],
      callback as (p: unknown) => void
    );
    return { remove: () => sub.remove() };
  },
};
