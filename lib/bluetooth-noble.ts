import * as noble from "@abandonware/noble";
import { IGattCentral, IGattPeripheral } from "./bluetooth";
import { uuidToAddress } from "./utils";

export default class NobleBluetoothCentral implements IGattCentral {
  public async startScanning(callback: (peripheral: IGattPeripheral) => void): Promise<void> {
    noble.removeAllListeners("discover");
    noble.on("discover", async (peripheral) => {
      if (peripheral.address?.length === 0) {
        peripheral.address = uuidToAddress(peripheral.uuid);
      }

      callback(peripheral satisfies IGattPeripheral);
    });

    await noble.startScanningAsync(["fff0"], false);
  }

  public async stopScanning(): Promise<void> {
    noble.removeAllListeners("discover");
    await noble.stopScanningAsync();
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
