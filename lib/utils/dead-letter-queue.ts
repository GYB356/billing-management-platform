let deadLetterQueue: { eventId: string; eventData: any }[] = [];

export function addToDeadLetterQueue(eventId: string, eventData: any) {
  deadLetterQueue.push({ eventId, eventData });
}

export function getDeadLetterQueue() {
  return [...deadLetterQueue];
}