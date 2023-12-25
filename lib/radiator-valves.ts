import { IGattCentral } from "./bluetooth";
import Logger from "./logger";
import RadiatorValve from "./radiator-valve";

export type RadiatorValvesOptions = {
  wakeUpInterval: number;
  maxConnectionAttempts: number;
  connectionTimeout: number;
  maxReadAttempts: number;
  readTimeout: number;
  maxWriteAttempts: number;
  logger?: Logger;
  verbose?: boolean;
  raspberryFix: boolean;
};

export default class RadiatorValves {
  private discoveredValves = new Map<string, RadiatorValve>();

  constructor(
    private readonly bluetooth: IGattCentral,
    private readonly options: Partial<RadiatorValvesOptions> = {}
  ) {
    this.options = {
      wakeUpInterval: 10 * 1000,
      maxConnectionAttempts: 5,
      connectionTimeout: 7000,
      maxReadAttempts: 5,
      readTimeout: 5000,
      maxWriteAttempts: 5,
      logger: new Logger(options.verbose ?? true),
      raspberryFix: false,
      ...options,
    };
  }

  public dispose() {
    this.stopScanning();
    for (const valve of this.discoveredValves.values()) {
      valve.disconnect();
    }
    this.discoveredValves.clear();
  }

  public scanOnce(): Promise<RadiatorValve> {
    return new Promise((resolve) => {
      this.bluetooth.startScanning(async (peripheral) => {
        await this.bluetooth.stopScanning();
        resolve(new RadiatorValve(peripheral, this.options as RadiatorValvesOptions));
      });
    });
  }

  public startScanning(callback: (valve: RadiatorValve) => Promise<void>) {
    this.bluetooth.startScanning(async (peripheral) => {
      if (this.discoveredValves.has(peripheral.address)) {
        return;
      }

      // Temporarily stop scanning, because some adapters don't like
      // connecting and scanning simultaneously.
      await this.bluetooth.stopScanning();

      const valve = new RadiatorValve(peripheral, this.options as RadiatorValvesOptions);
      this.discoveredValves.set(peripheral.address, valve);
      await callback(valve);

      // Resume scanning.
      this.startScanning(callback);
    });
  }

  public stopScanning() {
    this.bluetooth.stopScanning();
  }
}
