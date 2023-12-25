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
export const FIELD_MODE: StateFieldInfo<number> = [[6, 1], "direct"];
export const FIELD_BATTERY_VOLTAGE: StateFieldInfo<number> = [[10, 1], "battery-voltage"];
export const FIELD_CURRENT_TEMPERATURE: StateFieldInfo<number> = [[11, 2], "short-to-float-01"];
export const FIELD_TEMPERATURE_DEVIATION: StateFieldInfo<number> = [[13, 1], "byte-to-float-01"];
export const FIELD_TARGET_TEMPERATURE_SAVING: StateFieldInfo<number> = [
  [15, 1],
  "byte-to-float-05",
];
export const FIELD_TARGET_TEMPERATURE_AUTO: StateFieldInfo<number> = [[16, 1], "byte-to-float-05"];
export const FIELD_TARGET_TEMPERATURE_MANUAL: StateFieldInfo<number> = [
  [17, 1],
  "byte-to-float-05",
];
export const FIELD_NAME: StateFieldInfo<string> = [[176, 64], "string"];
export const FIELD_SERIAL_NUMBER: StateFieldInfo<string> = [[154, 12], "hex-string"];
