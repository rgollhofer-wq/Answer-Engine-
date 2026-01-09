export async function timeOperation<T>(operation: () => Promise<T>): Promise<{ result: T; latencyMs: number }> {
  const start = Date.now();
  const result = await operation();
  const latencyMs = Date.now() - start;
  return { result, latencyMs };
}
