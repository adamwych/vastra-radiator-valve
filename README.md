# vastra-radiator-valve

Node.js library to query and configure Vastra's smart radiator valves.

**Note:** This is not an official library, the protocol was reverse-engineered. I am not responsible for any issues as a result of using this library.

## Example

```ts
import { NobleBluetoothCentral } from "vastra-radiator-valve";

const bluetooth = await NobleBluetoothCentral.create();
const valves = new RadiatorValves(bluetooth);

// Scan nearby Bluetooth devices and return first found valve.
const valve = await valves.scanOnce();

// Establish connection with the valve.
await valve.connect();

// Now you can query information from the valve, configure it etc.
const currentTemperature = await valve.getCurrentTemperature();

// Make sure to disconnect once you are done.
await valve.disconnect();
```

You can find other examples in the `examples` directory.

## Acknowledgements

The library uses [Noble](https://github.com/abandonware/noble) to communicate with peripherals. As per their README:

> macOS / Mac OS X, Linux, FreeBSD and Windows are currently the only supported OSes.

You can implement a custom Bluetooth bridge by implementing the `IGattCentral` interface and passing it to `new RadiatorValves(yourBluetoothBridge)`.

## License

MIT.
