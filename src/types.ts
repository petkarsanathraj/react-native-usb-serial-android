export type ConnectOptions = {
  baudRate?: number;
  dataBits?: 5 | 6 | 7 | 8;
  stopBits?: 1 | 2;
};

export type UsbSerialEventMap = {
  data: string;
  status: string;
  error: string;
  connected: boolean;
};

export type Subscription = { remove: () => void };
