import * as noble from "@abandonware/noble";
import { IGattCentral, IGattPeripheral } from "./bluetooth";

export default class NobleBluetoothCentral implements IGattCentral {
  public async startScanning(callback: (peripheral: IGattPeripheral) => void): Promise<void> {
    await noble.startScanningAsync(["fff0"], false);

    noble.removeAllListeners("discover");
    noble.on("discover", async (peripheral) => {
      callback(peripheral satisfies IGattPeripheral);
    });
  }

  public async stopScanning(): Promise<void> {
    await noble.stopScanningAsync();
    noble.removeAllListeners("discover");
  }

  public static create(): Promise<NobleBluetoothCentral> {
    return new Promise((resolve) => {
      noble.on("stateChange", (state) => {
        if (state === "unsupported") {
          throw new Error("Bluetooth is not supported by the host");
        } else if (state === "poweredOn") {
          resolve(new NobleBluetoothCentral());
        }
      });
    });
  }
}
