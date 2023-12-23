import {
  MAX_STATE_CHUNK_SIZE,
  VALVE_STATE_LENGTH,
  VALVE_RX_UUID,
  VALVE_SERVICE_UUID,
  VALVE_TX_UUID,
} from "./constants";
import {
  PacketId,
  RESPONSE_FOOTER_LENGTH,
  PACKET_HEADER_LENGTH,
  createStateReadPacket,
  createStateWritePacket,
  createWakeUpPacket,
} from "./packets";
import { RadiatorValvesOptions } from "./radiator-valves";
import { TimeoutToken, withTimeout } from "./utils";
import { IGattCharacteristic, IGattPeripheral } from "./bluetooth";

/**
 * Position of a field stored in valve's state buffer in [offset, length] format.
 */
type StateFieldBufferPosition = [number, number];

/**
 * Specifies the method used to encode/decode a field stored in valve's state buffer.
 */
type StateFieldEncodingMethod =
  | "direct"
  | "battery-voltage"
  | "byte-to-float-01"
  | "byte-to-float-05"
  | "short-to-float-01";

function encodeStateField(value: any, method: StateFieldEncodingMethod) {
  switch (method) {
    case "direct":
      return Buffer.from([value]);
    case "byte-to-float-05":
      return Buffer.from([(value / 0.5) & 255]);
    default:
      throw new Error("Unsupported field encoding method: " + method);
  }
}

function decodeStateField(value: Buffer, method: StateFieldEncodingMethod) {
  switch (method) {
    case "direct":
      return value[0];
    case "battery-voltage":
      return ((value[0] & 255) + 170) / 100;
    case "byte-to-float-01":
      return value[0] * 0.1;
    case "byte-to-float-05":
      return (value[0] & 255) * 0.5;
    case "short-to-float-01":
      return ((value[1] & 255) | (value[0] << 8)) * 0.1;
    default:
      throw new Error("Unsupported field encoding method: " + method);
  }
}

/**
 * Position and encoding method of a field stored in valve's state buffer.
 */
type StateFieldInfo = [StateFieldBufferPosition, StateFieldEncodingMethod];

const FIELD_LOCKED: StateFieldInfo = [[5, 1], "direct"];
const FIELD_BATTERY_VOLTAGE: StateFieldInfo = [[10, 1], "battery-voltage"];
const FIELD_CURRENT_TEMPERATURE: StateFieldInfo = [[11, 2], "short-to-float-01"];
const FIELD_TEMPERATURE_DEVIATION: StateFieldInfo = [[13, 1], "byte-to-float-01"];
const FIELD_TARGET_TEMPERATURE: StateFieldInfo = [[16, 1], "byte-to-float-05"];

export default class RadiatorValve {
  /** Characteristic used to read data from the device. */
  private rx?: IGattCharacteristic;

  /** Characteristic used to write data to the device. */
  private tx?: IGattCharacteristic;

  private lastSentWakeUpTime = 0;
  private logger = this.options.logger;

  constructor(
    public readonly peripheral: IGattPeripheral,
    private readonly options: Readonly<RadiatorValvesOptions>
  ) {}

  /**
   * Attempts to establish a connection with the device.
   *
   * @param attempt Counts how many attempts have been made so far. For internal use only.
   */
  public async connect(attempt: number = 0): Promise<void> {
    if (this.peripheral.state === "connected") {
      await this.peripheral.disconnectAsync();
    }

    if (attempt >= this.options.maxConnectionAttempts) {
      throw new Error(`Too many attempts trying to connect to ${this.peripheral.address}`);
    }

    this.logger?.debug(
      `Connecting to ${this.peripheral.address} (timeout=${this.options.connectionTimeout}, attempt=${attempt})`
    );

    const timeoutToken = new TimeoutToken(this.options.connectionTimeout);

    if (this.peripheral.state !== "connected") {
      await withTimeout(this.peripheral.connectAsync(), timeoutToken);
      if (timeoutToken.timedOut) {
        this.logger?.warn(`Timed out connecting to ${this.peripheral.address}`);
        return this.connect(attempt + 1);
      }
    }

    // Find handles to the read/write service.
    const services = await withTimeout(
      this.peripheral.discoverServicesAsync([VALVE_SERVICE_UUID]),
      timeoutToken
    );
    if (timeoutToken.timedOut) {
      this.logger?.warn(`Timed out discovering services of ${this.peripheral.address}`);
      return this.connect(attempt + 1);
    }
    if (services.length === 0) {
      throw new Error(`${this.peripheral.address} did not report a communication service`);
    }

    // Find handles to read/write characteristics.
    const characteristics = await withTimeout(
      services[0].discoverCharacteristicsAsync([VALVE_RX_UUID, VALVE_TX_UUID]),
      timeoutToken
    );
    if (timeoutToken.timedOut) {
      this.logger?.warn(`Timed out discovering characteristics of ${this.peripheral.address}`);
      return this.connect(attempt + 1);
    }
    if (characteristics.length != 2) {
      throw new Error(`${this.peripheral.address} did not report read/write characteristics`);
    }

    [this.rx, this.tx] = characteristics;

    // Enable receiving notifications from RX characteristic.
    // Writing the value always times out, but somehow works fine on Raspberry.
    const descriptors = await withTimeout(this.rx.discoverDescriptorsAsync(), timeoutToken);
    if (timeoutToken.timedOut) {
      this.logger?.warn(`Timed out discovering descriptors of ${this.peripheral.address}`);
      return this.connect(attempt + 1);
    }
    if (this.options.raspberryFix) {
      descriptors[0].writeValueAsync(Buffer.from([0x01, 0x00]));
    }

    this.logger?.debug(`Connected to ${this.peripheral.address}`);
  }

  /**
   * Closes connection with the peripheral.
   */
  public async disconnect() {
    await this.peripheral.disconnectAsync();
    this.logger?.debug(`Closed connection to ${this.peripheral.address}`);
  }

  /**
   * Writes data contained in given buffer to the device.
   * Make sure to wait for the message to be fully sent by `await`-ing this
   * method before writing more data.
   *
   * @param data Data to write.
   */
  private write(data: Buffer) {
    this.logger?.verbose(`[Host -> ${this.peripheral.address}]`, data);
    return this.tx?.writeAsync(data, false);
  }

  /**
   * Writes a request to the device and waits for the response.
   *
   * @param request Request to send.
   * @returns Response.
   */
  private sendRequest(request: Buffer) {
    const work = async (resolve: Function, reject: Function, attempt: number) => {
      if (!this.tx || !this.rx) {
        throw new Error("Connection must be open before sending requests.");
      }

      if (attempt >= this.options.maxReadAttempts) {
        // TODO: Probably we should re-connect, because it's difficult to say how
        // the peripheral will act in case of a small congestion.
        throw new Error(`Timed out reading response from ${this.peripheral.address}`);
      }

      let responseChunks: Array<Buffer> = [];

      this.rx.notify(true);
      this.rx.on("data", (data) => {
        this.logger?.verbose(`[${this.peripheral.address} -> Host]`, data);

        responseChunks.push(data);

        if (data.length >= 2 && data.readUInt16LE(data.length - 2) === 0x0a0d) {
          this.rx?.removeAllListeners("data");
          this.rx?.notify(false);
          clearTimeout(timeoutId);
          resolve(Buffer.concat(responseChunks));
        }
      });

      await this.write(request);

      const timeoutId = setTimeout(() => {
        if (this.rx) {
          this.rx.removeAllListeners("data");
          this.rx.notify(false);
        }

        this.logger?.warn(
          `Timed out reading response from ${this.peripheral.address} (attempt ${attempt})`
        );
        work(resolve, reject, attempt + 1);
      }, this.options.readTimeout);
    };

    return new Promise<Buffer>(async (resolve, reject) => {
      work(resolve, reject, 0);
    });
  }

  /**
   * Sends Wake Up command to the peripheral and waits for a response.
   */
  public async requestWakeUp() {
    const timeSinceLastWakeUp = new Date().getTime() - this.lastSentWakeUpTime;
    if (timeSinceLastWakeUp < this.options.wakeUpInterval) {
      return;
    }
    await this.sendRequest(createWakeUpPacket());
    this.lastSentWakeUpTime = new Date().getTime();
  }

  /**
   * Requests value of a single field from peripheral's state buffer.
   * @returns Buffer containing the value.
   */
  public async requestField(field: StateFieldInfo) {
    const [position, encoding] = field;
    const packet = createStateReadPacket(position[0], position[1]);
    const response = await this.sendRequest(packet);

    // Skip header and checksum.
    // TODO: Verify checksum.
    const encodedValue = response.subarray(
      PACKET_HEADER_LENGTH,
      response.length - RESPONSE_FOOTER_LENGTH
    );

    return decodeStateField(encodedValue, encoding);
  }

  /**
   * Updates the value of a field.
   *
   * @param field Field to update.
   * @param value New value.
   */
  public async requestUpdateField(field: StateFieldInfo, value: any) {
    const [position, encoding] = field;
    const packet = createStateWritePacket(encodeStateField(value, encoding), position[0]);

    const work = async (attempt = 0) => {
      if (attempt >= this.options.maxWriteAttempts) {
        throw new Error(
          `Too many failed attempts at updating configuration of ${this.peripheral.address}`
        );
      }

      const response = await this.sendRequest(packet);
      if (response[2] !== PacketId.SaveSuccess) {
        this.logger?.warn(
          `Unable to update configuration of ${this.peripheral.address} (offset=${position[0]}, data=${value}, attempt=${attempt})`
        );
        await work(attempt + 1);
      }
    };

    await work(0);
  }

  /**
   * Requests a snapshot of the entire state buffer from the peripheral.
   * @returns Buffer containing the state.
   */
  public async requestStateSnapshot() {
    let buffer = Buffer.alloc(0);

    for (let offset = 0; offset < VALVE_STATE_LENGTH; offset += MAX_STATE_CHUNK_SIZE) {
      const packet = createStateReadPacket(offset, MAX_STATE_CHUNK_SIZE);
      let response = await this.sendRequest(packet);

      // Skip header and checksum.
      response = response.subarray(PACKET_HEADER_LENGTH, response.length - RESPONSE_FOOTER_LENGTH);

      buffer = Buffer.concat([buffer, response]);
    }

    return buffer;
  }

  public async setLocked(locked: boolean) {
    await this.requestWakeUp();
    await this.requestUpdateField(FIELD_LOCKED, locked ? 1 : 0);
  }

  public async getLocked() {
    await this.requestWakeUp();
    return this.requestField(FIELD_LOCKED);
  }

  public async getBatteryVoltage() {
    await this.requestWakeUp();
    return this.requestField(FIELD_BATTERY_VOLTAGE);
  }

  public async getTemperatureDeviation() {
    await this.requestWakeUp();
    return this.requestField(FIELD_TEMPERATURE_DEVIATION);
  }

  public async getCurrentTemperature() {
    await this.requestWakeUp();
    return this.requestField(FIELD_CURRENT_TEMPERATURE);
  }

  public async setTargetTemperature(value: number) {
    await this.requestWakeUp();
    await this.requestUpdateField(FIELD_TARGET_TEMPERATURE, value);
  }

  public async getTargetTemperature() {
    await this.requestWakeUp();
    return this.requestField(FIELD_TARGET_TEMPERATURE);
  }
}
