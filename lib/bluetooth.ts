import EventEmitter from "events";

export interface IGattCentral {
  startScanning(callback: (peripheral: IGattPeripheral) => void): Promise<void>;
  stopScanning(): Promise<void>;
}

export interface IGattPeripheral {
  readonly address: string;
  readonly state: "error" | "connecting" | "connected" | "disconnecting" | "disconnected";

  connectAsync(): Promise<void>;
  disconnectAsync(): Promise<void>;
  discoverServicesAsync(uuids: Array<string>): Promise<Array<IGattService>>;
}

export interface IGattService {
  discoverCharacteristicsAsync(uuids: Array<string>): Promise<Array<IGattCharacteristic>>;
}

export interface IGattCharacteristic extends EventEmitter {
  writeAsync(value: Buffer, response: boolean): Promise<void>;
  notify(status: boolean): void;
  discoverDescriptorsAsync(): Promise<Array<IGattDescriptor>>;
}

export interface IGattDescriptor {
  writeValueAsync(value: Buffer): Promise<void>;
}
