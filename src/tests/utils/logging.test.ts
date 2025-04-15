import { expect } from 'chai';
import * as sinon from 'sinon';
import { Logger } from '../../utils/logging';
import { LogLevel } from '../../types/logging';
import fs from 'fs/promises';
import path from 'path';

describe('Logger', () => {
  let logger: Logger;
  let consoleStub: sinon.SinonStub;
  let writeFileStub: sinon.SinonStub;
  let mkdirStub: sinon.SinonStub;

  beforeEach(() => {
    logger = new Logger({
      appName: 'test-app',
      logLevel: LogLevel.DEBUG,
      enableFileLogging: true,
      logFilePath: '/logs/app.log'
    });

    // Stub console methods
    consoleStub = sinon.stub(console, 'log');
    writeFileStub = sinon.stub(fs, 'appendFile').resolves();
    mkdirStub = sinon.stub(fs, 'mkdir').resolves();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('log levels', () => {
    it('should respect log level hierarchy', () => {
      // Set log level to ERROR
      logger.setLogLevel(LogLevel.ERROR);

      // These should not log
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      
      // This should log
      logger.error('error message');

      expect(consoleStub.callCount).to.equal(1);
      expect(consoleStub.firstCall.args[0]).to.include('error message');
    });

    it('should include correct metadata in logs', () => {
      const metadata = { userId: '123', action: 'payment' };
      logger.info('test message', metadata);

      expect(consoleStub.calledOnce).to.be.true;
      const loggedData = consoleStub.firstCall.args[0];
      expect(loggedData).to.include('test message');
      expect(loggedData).to.include(metadata.userId);
      expect(loggedData).to.include(metadata.action);
    });

    it('should merge global and local metadata', () => {
      logger = new Logger({
        appName: 'test-app',
        logLevel: LogLevel.INFO,
        metadata: { environment: 'test', service: 'billing' }
      });

      const localMetadata = { userId: '123', action: 'payment' };
      logger.info('test message', localMetadata);

      const loggedData = consoleStub.firstCall.args[0];
      expect(loggedData).to.include('environment');
      expect(loggedData).to.include('service');
      expect(loggedData).to.include('userId');
      expect(loggedData).to.include('action');
    });
  });

  describe('file logging', () => {
    it('should write to file when enabled', async () => {
      const message = 'test file logging';
      await logger.info(message);

      expect(mkdirStub.calledOnce).to.be.true;
      expect(writeFileStub.calledOnce).to.be.true;
      const writtenData = writeFileStub.firstCall.args[1];
      expect(writtenData).to.include(message);
    });

    it('should handle file writing errors', async () => {
      writeFileStub.rejects(new Error('Write failed'));
      const consoleErrorStub = sinon.stub(console, 'error');
      
      // Should not throw error to caller
      await logger.info('test message');
      
      expect(consoleErrorStub.calledOnce).to.be.true;
      expect(consoleErrorStub.firstCall.args[0]).to.include('Failed to write to log file');
    });

    it('should create log directory if it does not exist', async () => {
      await logger.info('test message');
      
      expect(mkdirStub.calledWith(path.dirname('/logs/app.log'), { recursive: true })).to.be.true;
    });
  });

  describe('performance logging', () => {
    it('should track operation duration', async () => {
      const clock = sinon.useFakeTimers();
      
      // Start performance tracking
      logger.startOperation('test-operation');
      
      // Simulate time passing
      clock.tick(100);
      
      // End and log performance
      const duration = logger.endOperation('test-operation');
      
      expect(duration).to.equal(100);
      expect(consoleStub.calledOnce).to.be.true;
      expect(consoleStub.firstCall.args[0]).to.include('test-operation');
      expect(consoleStub.firstCall.args[0]).to.include('100ms');
      
      clock.restore();
    });

    it('should handle multiple concurrent operations', () => {
      const clock = sinon.useFakeTimers();
      
      logger.startOperation('op1');
      clock.tick(50);
      logger.startOperation('op2');
      clock.tick(100);
      
      const duration1 = logger.endOperation('op1');
      clock.tick(50);
      const duration2 = logger.endOperation('op2');
      
      expect(duration1).to.equal(150);
      expect(duration2).to.equal(150);
      
      clock.restore();
    });

    it('should throw error for unknown operation', () => {
      expect(() => logger.endOperation('unknown')).to.throw('No timer found for operation');
    });
  });

  describe('error handling', () => {
    it('should handle invalid log levels gracefully', () => {
      logger.setLogLevel('INVALID' as LogLevel);
      logger.info('test message');
      
      expect(consoleStub.calledOnce).to.be.true;
    });

    it('should handle missing log file path', async () => {
      logger = new Logger({
        appName: 'test-app',
        logLevel: LogLevel.INFO,
        enableFileLogging: true
      });

      await logger.info('test message');
      expect(consoleStub.calledOnce).to.be.true;
      expect(writeFileStub.called).to.be.false;
    });
  });
}); 