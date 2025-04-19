import { EventManager } from '@/lib/events/events';

describe('EventManager', () => {
  let eventManager: EventManager;

  beforeEach(() => {
    eventManager = new EventManager();
  });

  it('should subscribe to an event', () => {
    const callback = jest.fn();
    eventManager.subscribe('test', callback);
    expect(eventManager['eventSubscriptions'].has('test')).toBe(true);
  });

  it('should emit an event and call the callback', () => {
    const callback = jest.fn();
    eventManager.subscribe('test', callback);
    eventManager.emit('test', {});
    expect(callback).toHaveBeenCalled();
  });

  it('should unsubscribe from an event and not call the callback', () => {
    const callback = jest.fn();
    eventManager.subscribe('test', callback);
    eventManager.unsubscribe('test', callback);
    eventManager.emit('test', {});
    expect(callback).not.toHaveBeenCalled();
  });

  it('should emit an event with data and the data is received by the callback', () => {
    const callback = jest.fn();
    const data = { message: 'hello' };
    eventManager.subscribe('test', callback);
    eventManager.emit('test', data);
    expect(callback).toHaveBeenCalledWith(data);
  });
});