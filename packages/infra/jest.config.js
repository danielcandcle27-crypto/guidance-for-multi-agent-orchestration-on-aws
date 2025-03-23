module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
      isolatedModules: true,
      diagnostics: {
        ignoreCodes: [2688, 2304, 2503]
      }
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@babel|jest|uuid|yargs-parser)/)'
  ]
};
