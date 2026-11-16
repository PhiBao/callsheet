/**
 * Turn a raw SDK failure into something a person can act on. The bill never
 * leaves the tab in any of these cases, and the message says so.
 */
export function describeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const lower = raw.toLowerCase();

  if (lower.includes('app check') || lower.includes('appcheck')) {
    return 'App Check rejected the request. This build is registered and enforced for AI Logic, so this is usually a reCAPTCHA score problem on this machine. The bill stayed on this computer.';
  }
  if (lower.includes('not registered')) {
    return 'App Check has not registered this app yet. Nothing was sent.';
  }
  if (lower.includes('429') || lower.includes('quota') || lower.includes('rate limit')) {
    return 'The model is busy or the free-tier quota is spent. Nothing was uploaded. Try again in a moment.';
  }
  if (
    lower.includes('503') ||
    lower.includes('deadline') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('unavailable')
  ) {
    return 'The model did not answer in time. The bill stayed on this computer.';
  }
  if (lower.includes('genai config')) {
    return 'Firebase AI Logic is not configured for this project yet.';
  }
  if (
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
    lower.includes('offline') ||
    lower.includes('connection')
  ) {
    return 'The network dropped before anything was sent. The bill stayed on this computer.';
  }
  if (lower.includes('json') || lower.includes('parse') || lower.includes('did not return')) {
    return 'The model did not return a readable result. Try the read again.';
  }
  if (!raw) {
    return 'Something went wrong. The bill stayed on this computer.';
  }
  return raw;
}
