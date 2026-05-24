# Example app

Minimal React Native screen that exercises every part of the library: connect, start/stop reading, disconnect, and a scrolling raw-data log.

## Run it inside your own RN project

The fastest way to try this library is to drop `App.tsx` into a fresh React Native project:

```sh
npx @react-native-community/cli init MyUsbDemo
cd MyUsbDemo
npm install react-native-usb-serial-android
# replace MyUsbDemo/App.tsx with the App.tsx from this folder
npx react-native run-android
```

Then:

1. Plug a USB-serial device into your Android phone via USB-OTG (FTDI / CH340 / CP210x / CDC-ACM all work).
2. Grant the USB permission dialog when prompted.
3. Tap **Connect** → **Start reading**.

You should see raw data scroll in the green console.
