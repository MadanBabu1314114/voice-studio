export async function runPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  let next = 0
  let done = 0
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++
        await fn(items[i], i)
        done++
        onProgress?.(done, items.length)
      }
    },
  )
  await Promise.all(workers)
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
