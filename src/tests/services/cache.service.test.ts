import { expect } from 'chai';
import * as sinon from 'sinon';
import Redis from 'ioredis';
import { CacheService } from '../../services/cache.service';
import { MLModel, MLModelType } from '../../types/ml';
import { gzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);

describe('CacheService', () => {
  let cacheService: CacheService;
  let redisStub: sinon.SinonStubbedInstance<Redis>;

  const sampleModel: MLModel = {
    id: 'model-123',
    name: 'Test Model',
    version: '1.0.0',
    type: MLModelType.CLASSIFICATION,
    parameters: {
      learningRate: 0.01,
      epochs: 100
    },
    metadata: {
      framework: 'tensorflow',
      accuracy: 0.95,
      trainedOn: new Date(),
      datasetVersion: '1.0.0',
      inputFeatures: ['feature1', 'feature2'],
      outputFeatures: ['prediction']
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    // Create Redis stub
    redisStub = sinon.createStubInstance(Redis);
    
    // Create cache service with stubbed Redis
    cacheService = new CacheService();
    (cacheService as any).redis = redisStub;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('single operations', () => {
    it('should cache ML model successfully', async () => {
      // Arrange
      redisStub.setex.resolves('OK');

      // Act
      await cacheService.cacheMLModel('test-key', sampleModel);

      // Assert
      expect(redisStub.setex.calledOnce).to.be.true;
      const [key, ttl, value] = redisStub.setex.firstCall.args;
      expect(key).to.equal('ml_model:test-key');
      expect(ttl).to.equal(3600);
      expect(JSON.parse(value)).to.deep.equal(sampleModel);
    });

    it('should retrieve cached ML model', async () => {
      // Arrange
      const cachedValue = JSON.stringify(sampleModel);
      redisStub.get.resolves(cachedValue);

      // Act
      const result = await cacheService.getCachedMLModel('test-key');

      // Assert
      expect(result).to.deep.equal(sampleModel);
      expect(redisStub.get.calledWith('ml_model:test-key')).to.be.true;
    });

    it('should return null for non-existent model', async () => {
      // Arrange
      redisStub.get.resolves(null);

      // Act
      const result = await cacheService.getCachedMLModel('non-existent');

      // Assert
      expect(result).to.be.null;
    });

    it('should invalidate cached model', async () => {
      // Arrange
      redisStub.del.resolves(1);

      // Act
      await cacheService.invalidateMLModel('test-key');

      // Assert
      expect(redisStub.del.calledWith('ml_model:test-key')).to.be.true;
    });
  });

  describe('batch operations', () => {
    it('should batch cache multiple models', async () => {
      // Arrange
      const models = [
        { key: 'model1', model: sampleModel },
        { key: 'model2', model: { ...sampleModel, id: 'model-456' } }
      ];
      const pipelineStub = {
        setex: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves([])
      };
      redisStub.pipeline.returns(pipelineStub);

      // Act
      await cacheService.batchCacheMLModels(models);

      // Assert
      expect(pipelineStub.setex.callCount).to.equal(2);
      expect(pipelineStub.exec.calledOnce).to.be.true;
    });

    it('should batch retrieve multiple models', async () => {
      // Arrange
      const keys = ['model1', 'model2'];
      const pipelineStub = {
        get: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves([
          [null, JSON.stringify(sampleModel)],
          [null, JSON.stringify({ ...sampleModel, id: 'model-456' })]
        ])
      };
      redisStub.pipeline.returns(pipelineStub);

      // Act
      const results = await cacheService.batchGetMLModels(keys);

      // Assert
      expect(results).to.have.length(2);
      expect(results[0]).to.deep.equal(sampleModel);
      expect(results[1]?.id).to.equal('model-456');
    });

    it('should batch invalidate multiple models', async () => {
      // Arrange
      const keys = ['model1', 'model2'];
      const pipelineStub = {
        del: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves([])
      };
      redisStub.pipeline.returns(pipelineStub);

      // Act
      await cacheService.batchInvalidateMLModels(keys);

      // Assert
      expect(pipelineStub.del.callCount).to.equal(2);
      expect(pipelineStub.exec.calledOnce).to.be.true;
    });
  });

  describe('compression', () => {
    it('should compress large models', async () => {
      // Arrange
      const largeModel = {
        ...sampleModel,
        parameters: {
          ...sampleModel.parameters,
          largeArray: new Array(2000).fill('data') // Create data larger than compression threshold
        }
      };
      redisStub.setex.resolves('OK');

      // Act
      await cacheService.cacheMLModel('large-model', largeModel);

      // Assert
      const [, , value] = redisStub.setex.firstCall.args;
      expect(value.startsWith('gz:')).to.be.true;
    });

    it('should not compress small models', async () => {
      // Arrange
      redisStub.setex.resolves('OK');

      // Act
      await cacheService.cacheMLModel('small-model', sampleModel);

      // Assert
      const [, , value] = redisStub.setex.firstCall.args;
      expect(value.startsWith('gz:')).to.be.false;
      expect(JSON.parse(value)).to.deep.equal(sampleModel);
    });

    it('should decompress compressed models correctly', async () => {
      // Arrange
      const compressed = await gzipAsync(Buffer.from(JSON.stringify(sampleModel)));
      const cachedValue = `gz:${compressed.toString('base64')}`;
      redisStub.get.resolves(cachedValue);

      // Act
      const result = await cacheService.getCachedMLModel('compressed-model');

      // Assert
      expect(result).to.deep.equal(sampleModel);
    });
  });
}); 