/**
 * MongoDB Indexing Utility
 * 
 * This utility helps with MongoDB index management, creation, and analysis
 * to optimize database performance in the application.
 */
const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * Creates and verifies indexes for all registered Mongoose models
 * This should be called during application startup
 */
const createAllIndexes = async () => {
  try {
    logger.info('Starting MongoDB index creation and verification...');
    
    // Get all registered models
    const modelNames = mongoose.modelNames();
    
    for (const modelName of modelNames) {
      const model = mongoose.model(modelName);
      logger.info(`Creating indexes for model: ${modelName}`);
      
      try {
        // Create all defined indexes for this model
        await model.createIndexes();
        logger.info(`Successfully created indexes for model: ${modelName}`);
      } catch (error) {
        logger.error(`Error creating indexes for model ${modelName}:`, error);
      }
    }
    
    logger.info('Completed MongoDB index creation and verification.');
  } catch (error) {
    logger.error('Error during index creation:', error);
  }
};

/**
 * Analyzes database queries to find potential missing indexes
 * @param {Object} options - Options for the analysis
 * @param {number} options.slowMs - Threshold in milliseconds to consider a query slow
 * @param {number} options.sampleRate - Rate at which to sample queries (0-1)
 */
const analyzeIndexes = async (options = {}) => {
  const { slowMs = 100, sampleRate = 1 } = options;
  
  try {
    // Get MongoDB connection from mongoose
    const db = mongoose.connection.db;
    
    // Enable profiling to capture slow queries
    await db.command({ 
      profile: 2, 
      slowms: slowMs,
      sampleRate: sampleRate
    });
    
    logger.info(`MongoDB profiling enabled with slowms: ${slowMs}, sampleRate: ${sampleRate}`);
    logger.info('Query profiling data will be collected in the system.profile collection.');
    logger.info('Run getSlowQueries() to analyze collected query data.');
    
    return { success: true, message: 'Profiling enabled successfully' };
  } catch (error) {
    logger.error('Error enabling MongoDB profiling:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get slow queries from the profiler
 * @param {number} limit - Maximum number of slow queries to return
 * @returns {Array} - List of slow queries with suggestions
 */
const getSlowQueries = async (limit = 20) => {
  try {
    const db = mongoose.connection.db;
    
    // Query the profile collection for slow queries
    const slowQueries = await db.collection('system.profile')
      .find({ op: { $in: ['query', 'find', 'update', 'delete'] } })
      .sort({ millis: -1 })
      .limit(limit)
      .toArray();
    
    // Process and analyze each slow query
    const analyzedQueries = slowQueries.map(query => {
      const { ns, command, millis, ts } = query;
      const [database, collection] = ns.split('.');
      
      // Extract query filter and projection
      const filter = command.filter || command.query || {};
      const sort = command.sort || {};
      
      // Suggest indexes based on query and sort
      const suggestedIndexes = [];
      
      // Find potential index fields from query filter
      const potentialIndexFields = [];
      for (const [key, value] of Object.entries(filter)) {
        if (!key.startsWith('$')) {
          potentialIndexFields.push(key);
        }
      }
      
      // Add sort fields to potential indexes
      for (const [key, value] of Object.entries(sort)) {
        if (!potentialIndexFields.includes(key)) {
          potentialIndexFields.push(key);
        }
      }
      
      // Generate compound index suggestions if multiple fields used
      if (potentialIndexFields.length > 1) {
        // Start with fields from sort, then add fields from filter
        const indexFields = [...Object.keys(sort), ...potentialIndexFields.filter(f => !Object.keys(sort).includes(f))];
        
        // Suggest the compound index
        const indexDef = indexFields.reduce((acc, field) => {
          acc[field] = 1;
          return acc;
        }, {});
        
        suggestedIndexes.push(indexDef);
      } else if (potentialIndexFields.length === 1) {
        // Single field index
        suggestedIndexes.push({ [potentialIndexFields[0]]: 1 });
      }
      
      return {
        collection,
        executionTimeMs: millis,
        timestamp: ts,
        filter,
        sort,
        suggestedIndexes
      };
    });
    
    return analyzedQueries;
  } catch (error) {
    logger.error('Error getting slow queries:', error);
    return [];
  }
};

/**
 * Gets index information for all collections
 * @returns {Object} - Map of collection names to their indexes
 */
const getIndexInfo = async () => {
  try {
    const db = mongoose.connection.db;
    const collections = await db.collections();
    const result = {};
    
    for (const collection of collections) {
      const collectionName = collection.collectionName;
      const indexes = await collection.indexes();
      result[collectionName] = indexes;
    }
    
    return result;
  } catch (error) {
    logger.error('Error getting index information:', error);
    return {};
  }
};

/**
 * Gets index usage statistics
 * @returns {Object} - Index usage statistics
 */
const getIndexStats = async () => {
  try {
    const db = mongoose.connection.db;
    const collections = await db.collections();
    const result = {};
    
    for (const collection of collections) {
      const collectionName = collection.collectionName;
      
      // Get aggregate index statistics
      const indexStats = await db.command({
        aggregate: collectionName,
        pipeline: [{ $indexStats: {} }],
        cursor: {}
      });
      
      if (indexStats && indexStats.cursor && indexStats.cursor.firstBatch) {
        result[collectionName] = indexStats.cursor.firstBatch;
      }
    }
    
    return result;
  } catch (error) {
    logger.error('Error getting index stats:', error);
    return {};
  }
};

/**
 * Creates index optimization suggestions based on usage statistics
 * @returns {Object} - Index optimization suggestions
 */
const getIndexOptimizationSuggestions = async () => {
  try {
    const indexStats = await getIndexStats();
    const suggestions = {};
    
    for (const [collection, stats] of Object.entries(indexStats)) {
      suggestions[collection] = {
        unusedIndexes: [],
        duplicateIndexes: []
      };
      
      // Find unused indexes (0 operations or very low usage)
      const unusedIndexes = stats.filter(stat => 
        stat.accesses && stat.accesses.ops === 0
      );
      
      if (unusedIndexes.length > 0) {
        suggestions[collection].unusedIndexes = unusedIndexes.map(idx => ({
          name: idx.name,
          key: idx.key
        }));
      }
      
      // Find potential duplicate indexes (more complex - would need index definitions)
      // This is a simplified approach
      const indexInfo = await getIndexInfo();
      const collectionIndexes = indexInfo[collection] || [];
      
      // Check for indexes that might be supersets of others
      for (let i = 0; i < collectionIndexes.length; i++) {
        const indexA = collectionIndexes[i];
        
        for (let j = 0; j < collectionIndexes.length; j++) {
          if (i === j) continue;
          
          const indexB = collectionIndexes[j];
          
          // Check if indexA has all fields from indexB in the same order
          if (isSubsetIndex(indexA.key, indexB.key)) {
            suggestions[collection].duplicateIndexes.push({
              index: indexA.name,
              possibleDuplicateOf: indexB.name,
              keyA: indexA.key,
              keyB: indexB.key
            });
          }
        }
      }
    }
    
    return suggestions;
  } catch (error) {
    logger.error('Error getting index optimization suggestions:', error);
    return {};
  }
};

/**
 * Determines if indexB is a subset of indexA
 * @param {Object} indexAKeys - Keys from index A
 * @param {Object} indexBKeys - Keys from index B
 * @returns {boolean} True if indexB is a subset of indexA
 */
const isSubsetIndex = (indexAKeys, indexBKeys) => {
  // Convert BSON objects to plain JavaScript objects
  const keysA = {};
  const keysB = {};
  
  Object.entries(indexAKeys).forEach(([key, value]) => {
    keysA[key] = value;
  });
  
  Object.entries(indexBKeys).forEach(([key, value]) => {
    keysB[key] = value;
  });
  
  // Get keys from both indexes
  const fieldsA = Object.keys(keysA);
  const fieldsB = Object.keys(keysB);
  
  // If B has more fields than A, it can't be a subset
  if (fieldsB.length > fieldsA.length) {
    return false;
  }
  
  // Check if all fields in B are in A in the same order
  for (let i = 0; i < fieldsB.length; i++) {
    if (fieldsB[i] !== fieldsA[i] || keysB[fieldsB[i]] !== keysA[fieldsA[i]]) {
      return false;
    }
  }
  
  return true;
};

module.exports = {
  createAllIndexes,
  analyzeIndexes,
  getSlowQueries,
  getIndexInfo,
  getIndexStats,
  getIndexOptimizationSuggestions
}; 