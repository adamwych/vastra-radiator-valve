# vastra-radiator-valve

Node.js library to query and configure Vastra's smart radiator valves.

**Note:**
This is not an official library, the protocol was reverse-engineered. I am not responsible for any problems that might arise after using this library.

I recommend capturing a full snapshot of the internal state of the valve using `RadiatorValve.requestStateSnapshot()` (should be 240 bytes) before doing any unusual things. This way you might be able to upload the entire state back to the device in case you accidentally put it into a bad state.

## Getting started

1. Install the package by running `yarn add vastra-radiator-valve` or `npm install --save vastra-radiator-valve`.
2. Wait for dependencies to be downloaded and compiled (might take some time).
   2.5. If you're using Node.js >= 19 and see errors when building the `usb` dependency, ignore them, everything should still work fine.
3. Take a look at the example below or at other examples in the `examples` folder.

```ts
import {
  NobleBluetoothCentral,
  RadiatorValveScanner,
} from "vastra-radiator-valve";

const bluetooth = await NobleBluetoothCentral.create();
const scanner = new RadiatorValveScanner(bluetooth, {
  // Additional settings...
});

// Scan nearby Bluetooth devices and return first found valve.
const valve = await scanner.findOne();

// Now you can query information from the valve, configure it etc.
const currentTemperature = await valve.getCurrentTemperature();

// Make sure to disconnect once you are done.
await valve.disconnect();
```

## Supported platforms

The library uses [Noble](https://github.com/abandonware/noble) to communicate with peripherals. As per their README:

> macOS / Mac OS X, Linux, FreeBSD and Windows are currently the only supported OSes.

You can implement a custom Bluetooth bridge by implementing the `IGattCentral` interface and passing it to `new RadiatorValveScanner(yourBluetoothBridge)`.

Tested using Node.js 18 on macOS and Raspbian.

**Note**: If you're planning on running this on a Raspberry Pi Zero v1 then beware - it has a very weak Bluetooth chip, so the connection is slow and unstable. Raspberry 3 A+ works much better.

## License

MIT.
