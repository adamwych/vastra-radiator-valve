import BinaryWriter from "./binary-writer";
import { MAX_STATE_WRITE_CHUNK } from "./constants";
import { chunk } from "./utils";
import { StateFieldEncodingMethod } from "./valve-state";

export enum PacketId {
  WakeUp = 235,
  StateChunk = 165,
  SaveSuccess = 130,
  ReadSuccess = 129,
}

export const PACKET_HEADER_LENGTH = 5;
export const RESPONSE_FOOTER_LENGTH = 3; // crc + \r + \n

const STATE_OP_READ = 1;
const STATE_OP_WRITE = 2;

const CRC8_MAXIM_TABLE = [
  0, 94, -68, -30, 97, 63, -35, -125, -62, -100, 126, 32, -93, -3, 31, 65, -99, -61, 33, 127, -4,
  -94, 64, 30, 95, 1, -29, -67, 62, 96, -126, -36, 35, 125, -97, -63, 66, 28, -2, -96, -31, -65, 93,
  3, -128, -34, 60, 98, -66, -32, 2, 92, -33, -127, 99, 61, 124, 34, -64, -98, 29, 67, -95, -1, 70,
  24, -6, -92, 39, 121, -101, -59, -124, -38, 56, 102, -27, -69, 89, 7, -37, -123, 103, 57, -70,
  -28, 6, 88, 25, 71, -91, -5, 120, 38, -60, -102, 101, 59, -39, -121, 4, 90, -72, -26, -89, -7, 27,
  69, -58, -104, 122, 36, -8, -90, 68, 26, -103, -57, 37, 123, 58, 100, -122, -40, 91, 5, -25, -71,
  -116, -46, 48, 110, -19, -77, 81, 15, 78, 16, -14, -84, 47, 113, -109, -51, 17, 79, -83, -13, 112,
  46, -52, -110, -45, -115, 111, 49, -78, -20, 14, 80, -81, -15, 19, 77, -50, -112, 114, 44, 109,
  51, -47, -113, 12, 82, -80, -18, 50, 108, -114, -48, 83, 13, -17, -79, -16, -82, 76, 18, -111,
  -49, 45, 115, -54, -108, 118, 40, -85, -11, 23, 73, 8, 86, -76, -22, 105, 55, -43, -117, 87, 9,
  -21, -75, 54, 104, -118, -44, -107, -53, 41, 119, -12, -86, 72, 22, -23, -73, 85, 11, -120, -42,
  52, 106, 43, 117, -105, -55, 74, 20, -10, -88, 116, 42, -56, -106, 21, 75, -87, -9, -74, -24, 10,
  84, -41, -119, 107, 53,
];

function calculateChecksum(buffer: Buffer) {
  let value = 0;
  for (let i = 1; i < 1 + buffer.length - 1; i++) {
    value = CRC8_MAXIM_TABLE[(value ^ buffer[i]) & 255];
  }
  return value;
}

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

// General packet structure:
// ---------------------------
// Offset | Type  | Description
// ---------------------------
// 0      | uint8 | Packet ID
// 1      | uint8 | Packet data length (excluding \r\n)
// 2      | N     | Data
// N      | uint8 | CRC
// N+1    | uint8 | \r (not in wakeup)
// N+2    | uint8 | \n (not in wakeup, only sometimes?)

export function createWakeUpPacket(): Buffer {
  const writer = new BinaryWriter();
  writer.writeUInt8(PacketId.WakeUp);
  return writer.toBuffer();
}

export function createStateReadPacket(offset: number, length: number = 48): Buffer {
  const writer = new BinaryWriter();
  writer.writeUInt8(PacketId.StateChunk);
  writer.writeUInt8(5);
  writer.writeUInt8(STATE_OP_READ);
  writer.writeUInt16(offset);
  writer.writeUInt8(length);
  writer.writeUInt8(calculateChecksum(writer.toBuffer()));
  writer.writeUInt8(13);
  return writer.toBuffer();
}

export function createStateWritePackets(data: Buffer, startOffset: number): Array<Buffer> {
  return chunk([...data], MAX_STATE_WRITE_CHUNK).map((chunk, chunkIndex) => {
    const relativeOffset = chunkIndex * MAX_STATE_WRITE_CHUNK;
    const writer = new BinaryWriter();
    writer.writeUInt8(PacketId.StateChunk);
    writer.writeUInt8(chunk.length + 4);
    writer.writeUInt8(STATE_OP_WRITE);
    writer.writeUInt16(startOffset + relativeOffset);
    writer.write([...chunk]);
    writer.writeUInt8(calculateChecksum(writer.toBuffer()));
    writer.writeUInt8(13);
    writer.writeUInt8(10);
    return writer.toBuffer();
  });
}
