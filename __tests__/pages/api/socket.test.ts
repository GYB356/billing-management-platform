import { createServer } from 'http';
import { Server, Socket as ClientSocket } from 'socket.io-client';
import { AddressInfo } from 'net';
import { getSession } from 'next-auth/react';
import { logSecurityEvent } from '@/lib/security/logging';
import ioHandler from '@/pages/api/socket';

jest.mock('next-auth/react');
jest.mock('@/lib/security/logging');

describe('Socket API', () => {
  let io: Server;
  let clientSocket: ClientSocket;
  let httpServer: ReturnType<typeof createServer>;

  beforeAll((done) => {
    httpServer = createServer();
    httpServer.listen(() => {
      const { port } = httpServer.address() as AddressInfo;
      io = new Server(httpServer);
      clientSocket = new ClientSocket(`http://localhost:${port}`);
      done();
    });
  });

  afterAll(() => {
    io.close();
    clientSocket.close();
    httpServer.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should authenticate valid sessions', (done) => {
      (getSession as jest.Mock).mockResolvedValueOnce({
        user: {
          id: 'user_123',
          organizationId: 'org_123',
        },
      });

      clientSocket.on('connect', () => {
        expect(logSecurityEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'LOGIN_SUCCESS',
            userId: 'user_123',
          })
        );
        done();
      });

      ioHandler(httpServer);
    });

    it('should reject invalid sessions', (done) => {
      (getSession as jest.Mock).mockResolvedValueOnce(null);

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toBe('Authentication failed');
        done();
      });

      ioHandler(httpServer);
    });
  });

  describe('Event Handling', () => {
    beforeEach(() => {
      (getSession as jest.Mock).mockResolvedValueOnce({
        user: {
          id: 'user_123',
          organizationId: 'org_123',
        },
      });
    });

    it('should handle channel subscriptions', (done) => {
      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe', 'test-channel');
        
        // Wait for subscription to be processed
        setTimeout(() => {
          expect(logSecurityEvent).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'LOGIN_SUCCESS',
              userId: 'user_123',
              metadata: expect.objectContaining({
                socketId: expect.any(String),
              }),
            })
          );
          done();
        }, 100);
      });

      ioHandler(httpServer);
    });

    it('should handle ping/pong', (done) => {
      clientSocket.on('connect', () => {
        clientSocket.emit('ping');
        
        clientSocket.on('notification', (data) => {
          expect(data).toEqual({
            message: 'pong',
            type: 'SYSTEM',
          });
          done();
        });
      });

      ioHandler(httpServer);
    });

    it('should handle disconnections', (done) => {
      clientSocket.on('connect', () => {
        clientSocket.disconnect();
      });

      clientSocket.on('disconnect', () => {
        expect(logSecurityEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'SESSION_EXPIRED',
            userId: 'user_123',
          })
        );
        done();
      });

      ioHandler(httpServer);
    });

    it('should handle errors', (done) => {
      clientSocket.on('connect', () => {
        const error = new Error('Test error');
        clientSocket.emit('error', error);

        setTimeout(() => {
          expect(logSecurityEvent).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'SUSPICIOUS_ACTIVITY',
              severity: 'MEDIUM',
              userId: 'user_123',
              metadata: expect.objectContaining({
                error: 'Test error',
              }),
            })
          );
          done();
        }, 100);
      });

      ioHandler(httpServer);
    });
  });
}); 