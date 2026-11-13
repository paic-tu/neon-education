export const DIRECT_EVENT_ORDER_NOTE = "[neon:direct-event-checkout]"

export function isDirectEventOrder(notes: string | null | undefined): boolean {
  return notes === DIRECT_EVENT_ORDER_NOTE
}
