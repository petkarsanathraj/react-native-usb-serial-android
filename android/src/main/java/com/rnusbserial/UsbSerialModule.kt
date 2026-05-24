package com.rnusbserial

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbManager
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.hoho.android.usbserial.driver.UsbSerialPort
import com.hoho.android.usbserial.driver.UsbSerialProber
import com.hoho.android.usbserial.util.SerialInputOutputManager

class UsbSerialModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), SerialInputOutputManager.Listener {

    private var usbManager: UsbManager? = null
    private var port: UsbSerialPort? = null
    private var ioManager: SerialInputOutputManager? = null

    private var readingActive = false
    private var connectPromise: Promise? = null

    private var pendingBaudRate: Int = 9600
    private var pendingDataBits: Int = 8
    private var pendingStopBits: Int = 1

    private val permissionAction: String
        get() = "${reactContext.packageName}.USB_PERMISSION"

    override fun getName(): String = MODULE_NAME

    override fun initialize() {
        super.initialize()
        usbManager = reactContext.getSystemService(Context.USB_SERVICE) as UsbManager
        reactContext.registerReceiver(
            usbDetachReceiver,
            IntentFilter(UsbManager.ACTION_USB_DEVICE_DETACHED),
            Context.RECEIVER_NOT_EXPORTED
        )
        sendEvent(EVENT_STATUS, "Module initialized")
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        try {
            ioManager?.stop()
            port?.close()
            reactContext.unregisterReceiver(usbDetachReceiver)
        } catch (_: Exception) {}
    }

    @ReactMethod
    fun connect(baudRate: Int, dataBits: Int, stopBits: Int, promise: Promise) {
        connectPromise = promise

        val manager = usbManager
        if (manager == null) {
            promise.reject("NO_USB_MANAGER", "UsbManager unavailable")
            sendEventBool(EVENT_CONNECTED, false)
            return
        }

        val drivers = UsbSerialProber.getDefaultProber().findAllDrivers(manager)
        if (drivers.isEmpty()) {
            sendEvent(EVENT_ERROR, "No USB serial device found")
            promise.reject("NO_DEVICE", "No USB serial device found")
            sendEventBool(EVENT_CONNECTED, false)
            return
        }

        val driver = drivers[0]
        val device = driver.device

        val permissionIntent = PendingIntent.getBroadcast(
            reactContext,
            0,
            Intent(permissionAction).apply { setPackage(reactContext.packageName) },
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
        )

        reactContext.registerReceiver(
            usbPermissionReceiver,
            IntentFilter(permissionAction),
            Context.RECEIVER_NOT_EXPORTED
        )

        if (manager.hasPermission(device)) {
            val connection = manager.openDevice(device)
            if (connection == null) {
                promise.reject("OPEN_FAILED", "Failed to open USB device connection")
                return
            }
            openConnection(driver.ports.first(), connection, baudRate, dataBits, stopBits, promise)
        } else {
            pendingBaudRate = baudRate
            pendingDataBits = dataBits
            pendingStopBits = stopBits
            sendEvent(EVENT_STATUS, "Requesting USB permission")
            manager.requestPermission(device, permissionIntent)
        }
    }

    private fun openConnection(
        portUSB: UsbSerialPort,
        connection: android.hardware.usb.UsbDeviceConnection,
        baudRate: Int,
        dataBits: Int,
        stopBits: Int,
        promise: Promise
    ) {
        try {
            port = portUSB
            port!!.open(connection)

            val stopBitsVal = if (stopBits == 1) UsbSerialPort.STOPBITS_1 else UsbSerialPort.STOPBITS_2

            port!!.setParameters(
                baudRate,
                dataBits,
                stopBitsVal,
                UsbSerialPort.PARITY_NONE
            )

            port!!.dtr = true
            port!!.rts = true

            ioManager = SerialInputOutputManager(port, this)
            Thread(ioManager).start()

            sendEvent(EVENT_STATUS, "Connected at $baudRate baud, $dataBits data, $stopBits stop")
            sendEventBool(EVENT_CONNECTED, true)
            promise.resolve("Connected")
        } catch (e: Exception) {
            sendEvent(EVENT_ERROR, "Failed to open: ${e.message}")
            promise.reject("CONNECT_FAIL", e.message)
        }
    }

    @ReactMethod
    fun startReading() {
        if (ioManager == null) {
            sendEvent(EVENT_ERROR, "Not connected")
            return
        }
        readingActive = true
        sendEvent(EVENT_STATUS, "Reading started")
    }

    @ReactMethod
    fun stopReading() {
        readingActive = false
        sendEvent(EVENT_STATUS, "Reading stopped")
    }

    @ReactMethod
    fun disconnect(promise: Promise) {
        try {
            ioManager?.stop()
            ioManager = null
            port?.close()
            port = null
            readingActive = false
            sendEvent(EVENT_STATUS, "Disconnected")
            sendEventBool(EVENT_CONNECTED, false)
            promise.resolve("Disconnected")
        } catch (e: Exception) {
            promise.reject("DISCONNECT_ERROR", e.message)
        }
    }

    // SerialInputOutputManager.Listener
    override fun onNewData(data: ByteArray) {
        // ISO-8859-1 is a 1-to-1 byte->char mapping (0-255).
        // Using UTF-8 here would corrupt binary serial data with replacement chars.
        val text = String(data, java.nio.charset.StandardCharsets.ISO_8859_1)
        Log.d(LOG_TAG, "data: ${data.size} bytes")
        if (readingActive) {
            sendEvent(EVENT_DATA, text)
        }
    }

    override fun onRunError(e: Exception) {
        sendEvent(EVENT_ERROR, "USB stopped: ${e.message}")
        sendEventBool(EVENT_CONNECTED, false)
    }

    private fun handlePermissionResult(intent: Intent?) {
        try {
            reactContext.unregisterReceiver(usbPermissionReceiver)
        } catch (_: Exception) {}

        val granted = intent?.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false) ?: false
        if (!granted) {
            sendEventBool(EVENT_CONNECTED, false)
            sendEvent(EVENT_ERROR, "USB permission denied")
            connectPromise?.reject("PERMISSION_DENIED", "USB permission denied")
            return
        }
        sendEvent(EVENT_STATUS, "Permission granted")

        val drivers = UsbSerialProber.getDefaultProber().findAllDrivers(usbManager)
        if (drivers.isEmpty()) {
            connectPromise?.reject("NO_DRIVER", "No driver found after permission grant")
            return
        }

        val driver = drivers[0]
        try {
            val connection = usbManager!!.openDevice(driver.device)
            if (connection == null) {
                connectPromise?.reject("OPEN_FAILED", "Failed to open device connection")
                return
            }
            openConnection(
                driver.ports.first(),
                connection,
                pendingBaudRate,
                pendingDataBits,
                pendingStopBits,
                connectPromise!!
            )
        } catch (e: Exception) {
            connectPromise?.reject("OPEN_EXCEPTION", e.message)
        }
    }

    private val usbPermissionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == permissionAction) {
                handlePermissionResult(intent)
            }
        }
    }

    private val usbDetachReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == UsbManager.ACTION_USB_DEVICE_DETACHED) {
                sendEvent(EVENT_STATUS, "USB device detached")
                sendEventBool(EVENT_CONNECTED, false)
                ioManager?.stop()
                port?.close()
            }
        }
    }

    private fun sendEvent(event: String, msg: String) {
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(event, msg)
    }

    private fun sendEventBool(event: String, value: Boolean) {
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(event, value)
    }

    companion object {
        const val MODULE_NAME = "UsbSerialModule"
        const val LOG_TAG = "UsbSerialModule"
        const val EVENT_DATA = "usbData"
        const val EVENT_STATUS = "usbStatus"
        const val EVENT_ERROR = "usbError"
        const val EVENT_CONNECTED = "usbConnected"
    }
}
