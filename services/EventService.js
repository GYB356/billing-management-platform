const EventEmitter = require('events');
const { promisify } = require('util');
const logger = require('../utils/logger');

/**
 * Event-driven service for handling asynchronous operations
 * Implements observer pattern for decoupled communication between components
 */
class EventService {
  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50); // Set higher limit for more event types
    this.handlers = new Map();
    this.eventLog = [];
    this.maxLogSize = 1000; // Keep track of the last 1000 events
  }

  /**
   * Register an event handler
   * @param {string} eventName - The event to listen for
   * @param {Function} handler - The handler function
   * @param {Object} options - Additional options
   * @returns {Function} - Unsubscribe function
   */
  on(eventName, handler, options = {}) {
    if (typeof handler !== 'function') {
      throw new Error('Event handler must be a function');
    }

    const wrappedHandler = async (...args) => {
      try {
        // Log event processing
        logger.debug(`Processing event: ${eventName}`, {
          event: eventName,
          args: JSON.stringify(args[0]),
          timestamp: new Date().toISOString()
        });

        // Execute handler with timeout if specified
        if (options.timeout) {
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Event handler timeout: ${eventName}`)), options.timeout);
          });
          await Promise.race([handler(...args), timeoutPromise]);
        } else {
          await handler(...args);
        }

        // Log successful processing
        logger.debug(`Event processed: ${eventName}`, {
          event: eventName,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        // Log error
        logger.error(`Error processing event: ${eventName}`, {
          event: eventName,
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });

        // Retry logic if configured
        if (options.retry && options.retry.attempts > 0) {
          const newOptions = {
            ...options,
            retry: {
              ...options.retry,
              attempts: options.retry.attempts - 1
            }
          };

          logger.info(`Retrying event: ${eventName} (${options.retry.attempts - newOptions.retry.attempts}/${options.retry.maxAttempts})`, {
            event: eventName,
            timestamp: new Date().toISOString()
          });

          // Wait before retry if delay is specified
          if (options.retry.delay) {
            setTimeout(() => {
              this.emitter.emit(eventName, ...args);
            }, options.retry.delay);
          } else {
            // Immediate retry
            this.emitter.emit(eventName, ...args);
          }
        }

        // Re-throw if configured to propagate errors
        if (options.propagateErrors) {
          throw error;
        }
      }
    };

    // Store the handler for removal later
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName).push({ handler, wrappedHandler });

    // Register with the event emitter
    this.emitter.on(eventName, wrappedHandler);

    // Return unsubscribe function
    return () => this.off(eventName, handler);
  }

  /**
   * Remove an event handler
   * @param {string} eventName - The event name
   * @param {Function} handler - The handler to remove
   */
  off(eventName, handler) {
    if (!this.handlers.has(eventName)) {
      return;
    }

    const handlers = this.handlers.get(eventName);
    const index = handlers.findIndex(h => h.handler === handler);

    if (index !== -1) {
      const { wrappedHandler } = handlers[index];
      this.emitter.off(eventName, wrappedHandler);
      handlers.splice(index, 1);

      if (handlers.length === 0) {
        this.handlers.delete(eventName);
      }
    }
  }

  /**
   * Emit an event
   * @param {string} eventName - The event name
   * @param {any} data - The event data
   */
  emit(eventName, data = {}) {
    // Add event to log
    this.logEvent(eventName, data);

    // Emit the event
    this.emitter.emit(eventName, data);

    // Log the emission
    logger.debug(`Event emitted: ${eventName}`, {
      event: eventName,
      data: JSON.stringify(data),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit an event and wait for all handlers to complete
   * @param {string} eventName - The event name
   * @param {any} data - The event data
   * @returns {Promise<void>} - Promise that resolves when all handlers complete
   */
  async emitAsync(eventName, data = {}) {
    // Add event to log
    this.logEvent(eventName, data);

    // Create a promise that resolves when all handlers are done
    return new Promise((resolve, reject) => {
      const listeners = this.emitter.listeners(eventName);

      if (listeners.length === 0) {
        logger.warn(`No listeners for event: ${eventName}`, {
          event: eventName,
          timestamp: new Date().toISOString()
        });
        return resolve();
      }

      // Track completion and errors
      let completed = 0;
      const errors = [];

      // Create a wrapper for each listener
      const wrappers = listeners.map(listener => {
        return async () => {
          try {
            await listener(data);
          } catch (error) {
            errors.push(error);
          } finally {
            completed++;
            if (completed === listeners.length) {
              if (errors.length > 0) {
                reject(new AggregateError(errors, `Errors in event handlers for: ${eventName}`));
              } else {
                resolve();
              }
            }
          }
        };
      });

      // Execute all listeners
      wrappers.forEach(wrapper => wrapper());
    });
  }

  /**
   * Log an event for debugging and monitoring
   * @private
   * @param {string} eventName - The event name
   * @param {any} data - The event data
   */
  logEvent(eventName, data) {
    const event = {
      eventName,
      timestamp: new Date().toISOString(),
      data
    };

    this.eventLog.unshift(event);

    // Keep log size in check
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.pop();
    }
  }

  /**
   * Get recent events for debugging
   * @param {number} limit - Maximum number of events to return
   * @param {string} eventName - Optional filter by event name
   * @returns {Array<Object>} - Recent events
   */
  getRecentEvents(limit = 100, eventName = null) {
    let events = this.eventLog;

    if (eventName) {
      events = events.filter(e => e.eventName === eventName);
    }

    return events.slice(0, limit);
  }

  /**
   * Get all registered event names
   * @returns {Array<string>} - Event names
   */
  getRegisteredEvents() {
    return Array.from(this.handlers.keys());
  }
}

// Create a singleton instance
const eventService = new EventService();

module.exports = eventService; 