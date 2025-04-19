import { DeadLetterQueue } from '@/lib/utils/dead-letter-queue';

describe('DeadLetterQueue', () => {
  let queue: DeadLetterQueue;

  beforeEach(() => {
    queue = new DeadLetterQueue();
  });

  it('should add a message to the queue', () => {
    queue.add('message1', {});
    expect(queue.size()).toBe(1);
  });

  it('should remove a message from the queue', () => {
    queue.add('message1', {});
    queue.add('message2', {});
    queue.remove('message1');
    expect(queue.size()).toBe(1);
    expect(queue.getAll()).toEqual([{ message: 'message2', data: {} }]);
  });

  it('should get all messages from the queue', () => {
    queue.add('message1', { key: 'value1' });
    queue.add('message2', { key: 'value2' });
    const messages = queue.getAll();
    expect(messages).toEqual([
      { message: 'message1', data: { key: 'value1' } },
      { message: 'message2', data: { key: 'value2' } },
    ]);
  });

  it('should get the number of messages in the queue', () => {
    queue.add('message1', {});
    queue.add('message2', {});
    expect(queue.size()).toBe(2);
  });

  it('should check if the queue is empty', () => {
    expect(queue.isEmpty()).toBe(true);
    queue.add('message1', {});
    expect(queue.isEmpty()).toBe(false);
  });

  it('should handle removing a non-existent message', () => {
    queue.add('message1', {});
    queue.remove('message2');
    expect(queue.size()).toBe(1);
    expect(queue.getAll()).toEqual([{ message: 'message1', data: {} }]);
  });

  it('should get all messages when empty', () => {
    expect(queue.getAll()).toEqual([]);
  });

  it('should get the size when empty', () => {
    expect(queue.size()).toBe(0);
  });
});