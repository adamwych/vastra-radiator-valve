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
    promise.then(resolve).finally(() => {
      clearTimeout(id);
    });
  });
}

export function sleepAsync(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

export function chunk<T>(array: Array<T>, maxChunkSize: number): Array<Array<T>> {
  const chunks = [];
  const numberOfChunks = Math.ceil(array.length / maxChunkSize);
  for (let chunkIndex = 0; chunkIndex < numberOfChunks; chunkIndex++) {
    const relativeOffset = chunkIndex * maxChunkSize;
    chunks.push(array.slice(relativeOffset, relativeOffset + maxChunkSize));
  }
  return chunks;
}
