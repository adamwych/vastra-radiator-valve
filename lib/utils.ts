export class TimeoutToken {
  public timedOut = false;
  constructor(public timeout: number) {}
}

export function withTimeout<T>(promise: Promise<T>, token: TimeoutToken): Promise<T> {
  return new Promise((resolve) => {
    token.timedOut = false;
    const id = setTimeout(() => {
      token.timedOut = true;
      resolve(null as any);
    }, token.timeout);
    promise.then((value) => {
      resolve(value);
      clearTimeout(id);
    });
  });
}

export function sleepAsync(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}