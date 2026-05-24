module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath: 'import com.rnusbserial.UsbSerialPackage;',
        packageInstance: 'new UsbSerialPackage()',
      },
      ios: null,
    },
  },
};
