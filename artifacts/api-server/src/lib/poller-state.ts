// Shared counter so ig-poller.ts can detect when real webhook DM delivery
// starts working (and slow down polling). Both webhooks.ts and ig-poller.ts
// import from here — this breaks the circular dependency between those two.
let _webhookDmsSeen = 0;

export function markWebhookDmSeen(): void {
  _webhookDmsSeen++;
}

export function getWebhookDmsSeen(): number {
  return _webhookDmsSeen;
}
