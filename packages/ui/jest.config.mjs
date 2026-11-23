import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  dir: '../../apps/web',
})

const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/src/__tests__/setup.ts'],
}

export default createJestConfig(config)
