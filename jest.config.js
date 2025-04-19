module.exports = {
    // Test environment
    testEnvironment: 'node',
    
    // File patterns
    testMatch: [
      '**/__tests__/**/*.test.[jt]s?(x)',
      '**/?(*.)+(spec|test).[jt]s?(x)'
    ],
    
    // Coverage configuration
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov'],
    collectCoverageFrom: [
      'src/**/*.{js,jsx,ts,tsx}',
      '!src/**/*.d.ts',
      '!src/index.tsx',
      '!src/serviceWorker.ts'
    ],
    
    // Module file extensions
    moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],
    
    // Module name mapper for aliases and static files
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/src/$1',
      '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
      '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js'
    },
    
    // Transform configuration
    transform: {
      '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
    },
    
    // Setup files
    setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
    
    // Test timeout
    testTimeout: 10000,
    
    // Ignore patterns
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    
    // Global setup
    globalSetup: '<rootDir>/test/setup/globalSetup.js',
    globalTeardown: '<rootDir>/test/setup/globalTeardown.js'
  };