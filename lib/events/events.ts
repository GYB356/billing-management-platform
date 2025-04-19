class EventManager {
  private subscriptions: Map<string, Function[]> = new Map();

  subscribe(event: string, callback: Function): void {
    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, []);
    }
    this.subscriptions.get(event)?.push(callback);
  }

  unsubscribe(event: string, callback: Function): void {
    const callbacks = this.subscriptions.get(event);
    if (callbacks) {
      this.subscriptions.set(
        event,
        callbacks.filter((cb) => cb !== callback)
      );
    }
  }

  emit(event: string, data: any): void {
    const callbacks = this.subscriptions.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }
}