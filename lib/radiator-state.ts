/**
 * Position of a field stored in valve's state buffer in [offset, length] format.
 */
export type StateFieldBufferPosition = [number, number];

/**
 * Specifies the method used to encode/decode a field stored in valve's state buffer.
 */
export type StateFieldEncodingMethod =
  | "direct"
  | "battery-voltage"
  | "byte-to-float-01"
  | "byte-to-float-05"
  | "short-to-float-01"
  | "string"
  | "hex-string";

/**
 * Position and encoding method of a field stored in valve's state buffer.
 */
export type StateFieldInfo<T> = [StateFieldBufferPosition, StateFieldEncodingMethod];

export const FIELD_LOCKED: StateFieldInfo<number> = [[5, 1], "direct"];
export const FIELD_BATTERY_VOLTAGE: StateFieldInfo<number> = [[10, 1], "battery-voltage"];
export const FIELD_CURRENT_TEMPERATURE: StateFieldInfo<number> = [[11, 2], "short-to-float-01"];
export const FIELD_TEMPERATURE_DEVIATION: StateFieldInfo<number> = [[13, 1], "byte-to-float-01"];
export const FIELD_TARGET_TEMPERATURE: StateFieldInfo<number> = [[16, 1], "byte-to-float-05"];
export const FIELD_NAME: StateFieldInfo<string> = [[176, 64], "string"];
export const FIELD_SERIAL_NUMBER: StateFieldInfo<string> = [[154, 12], "hex-string"];

export function encodeStateField(value: any, method: StateFieldEncodingMethod) {
  if (value instanceof Buffer) {
    return value;
  }

  switch (method) {
    case "direct":
      return Buffer.from(Array.isArray(value) ? value : [value]);
    case "byte-to-float-05":
      return Buffer.from([(value / 0.5) & 255]);
    case "string":
    case "hex-string":
      return Buffer.from(value);
    default:
      throw new Error("Unsupported field encoding: " + method);
  }
}

export function decodeStateField(value: Buffer, method: StateFieldEncodingMethod) {
  switch (method) {
    case "direct":
      return value.length === 1 ? value[0] : value;
    case "battery-voltage":
      return ((value[0] & 255) + 170) / 100;
    case "byte-to-float-01":
      return value[0] * 0.1;
    case "byte-to-float-05":
      return (value[0] & 255) * 0.5;
    case "short-to-float-01":
      return ((value[1] & 255) | (value[0] << 8)) * 0.1;
    case "string":
      return value.toString("utf8");
    case "hex-string":
      return [...value].map((x) => x.toString(16)).join("");
    default:
      throw new Error("Unsupported field encoding: " + method);
  }
}
