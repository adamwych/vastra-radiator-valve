import { EventEmitter } from "events";
import { IGattCentral } from "./bluetooth";
import Logger from "./logger";
import RadiatorValve from "./valve";

export type RadiatorValvesOptions = {
  wakeUpInterval: number;
  maxConnectionAttempts: number;
  connectionTimeout: number;
  maxReadAttempts: number;
  readTimeout: number;
  maxWriteAttempts: number;
  logger?: Logger;
  verbose?: boolean;

  /**
   * Whether to automatically connect to the peripheral once it is
   * discovered. A `connected` event will be emitted once the connection
   * is established. If this is disabled, then only the `discovered` event
   * will be emitted.
   */
  autoConnect?: boolean;

  /**
   * Whether to enable notification flag in client configuration descriptor
   * of the RX characteristic. Some drivers do it automatically, so it's not
   * always necessary.
   */
  raspberryFix: boolean;
};

export declare interface RadiatorValveScanner {
  emit(event: "connected", valve: RadiatorValve): boolean;
  emit(event: "discovered", valve: RadiatorValve): boolean;

  on(event: "connected", listener: (valve: RadiatorValve) => void): this;
  on(event: "discovered", listener: (valve: RadiatorValve) => void): this;
}

export class RadiatorValveScanner extends EventEmitter {
  private connectedValves: Array<RadiatorValve> = [];
  private connectQueue: Array<RadiatorValve> = [];
  private connecting = false;
  private scanning = false;

  constructor(
    private readonly bluetooth: IGattCentral,
    private readonly options: Partial<RadiatorValvesOptions> = {}
  ) {
    super();

    this.options = {
      wakeUpInterval: 10 * 1000,
      maxConnectionAttempts: 5,
      connectionTimeout: 7000,
      maxReadAttempts: 5,
      readTimeout: 5000,
      maxWriteAttempts: 5,
      logger: new Logger(options.verbose ?? true),
      raspberryFix: false,
      autoConnect: true,
      ...options,
    };
  }

  public async disconnectAll() {
    await this.stop();
    for (const valve of this.connectedValves) {
      await valve.disconnect();
    }
    this.connectedValves = [];
  }

  public findOne(): Promise<RadiatorValve> {
    return new Promise((resolve) => {
      this.bluetooth.startScanning(async (peripheral) => {
        await this.bluetooth.stopScanning();
        const valve = new RadiatorValve(peripheral, this.options as RadiatorValvesOptions);
        if (this.options.autoConnect) {
          await valve.connect();
        }
        resolve(valve);
      });
    });
  }

  public start() {
    this.scanning = true;
    return this.bluetooth.startScanning((peripheral) => {
      const valve = new RadiatorValve(peripheral, this.options as RadiatorValvesOptions);
      this.emit("discovered", valve);

      if (this.options.autoConnect) {
        this.queueConnect(valve);
      }
    });
  }

  public stop() {
    if (!this.scanning) {
      return Promise.resolve();
    }
    this.scanning = false;
    return this.bluetooth.stopScanning();
  }

  private queueConnect(valve: RadiatorValve) {
    this.connectQueue.push(valve);
    this.processConnectQueue();
  }

  private async processConnectQueue() {
    if (this.connecting) {
      return;
    }

    const valve = this.connectQueue.shift();
    if (!valve) {
      return;
    }

    this.connecting = true;
    await this.stop();

    try {
      await valve.connect();
      this.connectedValves.push(valve);

      if (!this.emit("connected", valve)) {
        this.options.logger?.debug(
          `Disconnecting ${valve.peripheral.address} because there are no listeners`
        );
        await valve.disconnect();
      }
    } catch (error) {
      // Disconnect in case the error was thrown after the connection was established,
      // but before it was confirmed (e.g. we failed to discover services or characteristics)
      await valve.disconnect();
      this.options.logger?.error(String(error));
    }

    this.connecting = false;

    if (this.connectQueue.length > 0) {
      this.processConnectQueue();
    } else {
      if (this.scanning) {
        this.start();
      }
    }
  }
}
