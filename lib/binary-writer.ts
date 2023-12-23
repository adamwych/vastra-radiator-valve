export default class BinaryWriter {
  public data: Array<number> = [];

  /**
   * Appends a byte array to the data array.
   * @param b
   */
  public write(b: Array<number>) {
    this.data.push(...b);
  }

  /**
   * Appends a `byte`/`uint8` to the data array.
   * @param b
   */
  public writeUInt8(b: number) {
    this.data.push(b & 255);
  }

  /**
   * Appends a `short`/`uint16` to the data array.
   * @param s
   */
  public writeUInt16(s: number) {
    this.data.push((s >> 8) & 255);
    this.data.push(s & 255);
  }

  public toBuffer() {
    return Buffer.from(this.data);
  }
}
