// Jest setup file
// Configure test environment

// Set test timeout to 10 seconds
jest.setTimeout(10000);

// Mock console.log in tests to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: console.error // Keep error logging
};

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
