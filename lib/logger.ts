export default class Logger {
  constructor(private readonly allowVerbose: boolean) {}

  public debug(message: String, ...params: Array<any>) {
    console.debug(message, ...params);
  }

  public info(message: String, ...params: Array<any>) {
    console.info(message, ...params);
  }

  public warn(message: String, ...params: Array<any>) {
    console.warn(message, ...params);
  }

  public error(message: String, ...params: Array<any>) {
    console.error(message, ...params);
  }

  public verbose(message: String, ...params: Array<any>) {
    if (this.allowVerbose) {
      console.debug(message, ...params);
    }
  }
}
