import { useCallback, useEffect, useRef, useState } from 'react';
import { UsbSerial } from './UsbSerial';
import type { ConnectOptions } from './types';

export type UseUsbSerialOptions = {
  onData?: (chunk: string) => void;
};

export function useUsbSerial(options: UseUsbSerialOptions = {}) {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Disconnected');
  const [error, setError] = useState<string | null>(null);

  const onDataRef = useRef(options.onData);
  onDataRef.current = options.onData;

  useEffect(() => {
    const subs = [
      UsbSerial.addListener('connected', setConnected),
      UsbSerial.addListener('status', setStatus),
      UsbSerial.addListener('error', setError),
      UsbSerial.addListener('data', (chunk) => onDataRef.current?.(chunk)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  const connect = useCallback((opts?: ConnectOptions) => UsbSerial.connect(opts), []);
  const disconnect = useCallback(() => UsbSerial.disconnect(), []);
  const startReading = useCallback(() => UsbSerial.startReading(), []);
  const stopReading = useCallback(() => UsbSerial.stopReading(), []);

  return {
    connected,
    status,
    error,
    connect,
    disconnect,
    startReading,
    stopReading,
  };
}
