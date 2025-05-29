/**
 * @jest-environment jsdom
 */
import { CONFIG_KEYS } from '../agentConfig';

// Mock the import.meta.env
jest.mock('import.meta', () => ({
  env: {
    DEV: true,
    VITE_ROUTING_CLASSIFIER_AGENT_ID: undefined,
    VITE_ROUTING_CLASSIFIER_ALIAS_ID: undefined
  }
}), { virtual: true });

describe('agentConfig', () => {
  let localStorageMock: { [key: string]: string } = {};
  
  // Create mocks before importing the module under test
  // This ensures our mocks are in place before the module initializes
  beforeEach(() => {
    jest.resetModules();
    
    // Mock localStorage
    localStorageMock = {};
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(
      (key: string) => localStorageMock[key] || null
    );
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(
      (key: string, value: string) => { localStorageMock[key] = value; }
    );
    
    // Mock console methods
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should provide placeholder values in dev mode when no configuration is available', () => {
    // Use our mocked environment with DEV=true and no config values
    const { agentConfig } = require('../agentConfig');
    
    expect(agentConfig.routingClassifier.agentId).toContain('missing-');
    expect(agentConfig.routingClassifier.agentAliasId).toContain('missing-');
    expect(console.error).toHaveBeenCalled();
  });

  it('should load config from localStorage in development mode', () => {
    const testAgentId = 'test-agent-id';
    const testAliasId = 'test-alias-id';
    
    // Setup localStorage with dev config
    localStorageMock['dev-agent-config'] = JSON.stringify({
      [CONFIG_KEYS.ROUTING_CLASSIFIER_AGENT_ID]: testAgentId,
      [CONFIG_KEYS.ROUTING_CLASSIFIER_ALIAS_ID]: testAliasId
    });
    
    // Re-import with our localStorage mock in place
    const { agentConfig } = require('../agentConfig');
    
    expect(agentConfig.routingClassifier.agentId).toBe(testAgentId);
    expect(agentConfig.routingClassifier.agentAliasId).toBe(testAliasId);
  });

  it('should prioritize environment variables over localStorage config', () => {
    const envAgentId = 'env-agent-id';
    const envAliasId = 'env-alias-id';
    const localAgentId = 'local-agent-id';
    const localAliasId = 'local-alias-id';
    
    // Mock with environment variables set
    jest.doMock('import.meta', () => ({
      env: {
        DEV: true,
        VITE_ROUTING_CLASSIFIER_AGENT_ID: envAgentId,
        VITE_ROUTING_CLASSIFIER_ALIAS_ID: envAliasId
      }
    }), { virtual: true });
    
    // Setup localStorage with dev config
    localStorageMock['dev-agent-config'] = JSON.stringify({
      [CONFIG_KEYS.ROUTING_CLASSIFIER_AGENT_ID]: localAgentId,
      [CONFIG_KEYS.ROUTING_CLASSIFIER_ALIAS_ID]: localAliasId
    });
    
    // Re-import to get fresh module with updated mocks
    const { agentConfig } = require('../agentConfig');
    
    // Environment variables should take precedence
    expect(agentConfig.routingClassifier.agentId).toBe(envAgentId);
    expect(agentConfig.routingClassifier.agentAliasId).toBe(envAliasId);
  });

  it('should throw an error in production mode when configuration is missing', () => {
    // Mock production environment
    jest.doMock('import.meta', () => ({
      env: {
        DEV: false,
        VITE_ROUTING_CLASSIFIER_AGENT_ID: undefined,
        VITE_ROUTING_CLASSIFIER_ALIAS_ID: undefined
      }
    }), { virtual: true });
    
    // Re-import should throw an error in production mode with missing config
    expect(() => {
      jest.isolateModules(() => {
        require('../agentConfig');
      });
    }).toThrow('Missing required agent configuration');
  });

  it('should correctly update development configuration with setDevAgentConfig', () => {
    const newAgentId = 'new-test-agent-id';
    
    // Re-import to get fresh setDevAgentConfig function
    const { setDevAgentConfig } = require('../agentConfig');
    
    // Update only the agent ID
    const result = setDevAgentConfig({
      [CONFIG_KEYS.ROUTING_CLASSIFIER_AGENT_ID]: newAgentId
    });
    
    expect(result).toBe(true);
    expect(JSON.parse(localStorageMock['dev-agent-config'])[CONFIG_KEYS.ROUTING_CLASSIFIER_AGENT_ID]).toBe(newAgentId);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Development configuration updated'));
  });

  it('should not allow setting dev config in production mode', () => {
    // Mock production environment
    jest.doMock('import.meta', () => ({
      env: {
        DEV: false,
        VITE_ROUTING_CLASSIFIER_AGENT_ID: undefined,
        VITE_ROUTING_CLASSIFIER_ALIAS_ID: undefined
      }
    }), { virtual: true });
    
    // Re-import to get fresh setDevAgentConfig function with production env
    const { setDevAgentConfig } = require('../agentConfig');
    
    const result = setDevAgentConfig({
      [CONFIG_KEYS.ROUTING_CLASSIFIER_AGENT_ID]: 'test'
    });
    
    expect(result).toBe(false);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Development configuration can only be set in development mode'));
    expect(localStorageMock['dev-agent-config']).toBeUndefined();
  });

  it('should correctly identify a routing classifier agent', () => {
    const testAgentId = 'test-agent-id';
    const testAliasId = 'test-alias-id';
    
    // Setup localStorage with dev config
    localStorageMock['dev-agent-config'] = JSON.stringify({
      [CONFIG_KEYS.ROUTING_CLASSIFIER_AGENT_ID]: testAgentId,
      [CONFIG_KEYS.ROUTING_CLASSIFIER_ALIAS_ID]: testAliasId
    });
    
    // Re-import to get fresh module with our mocked localStorage
    const { isRoutingClassifierAgent } = require('../agentConfig');
    
    // Match by agent ID
    expect(isRoutingClassifierAgent(testAgentId, undefined)).toBe(true);
    
    // Match by alias ID
    expect(isRoutingClassifierAgent(undefined, testAliasId)).toBe(true);
    
    // Both IDs match
    expect(isRoutingClassifierAgent(testAgentId, testAliasId)).toBe(true);
    
    // No IDs provided
    expect(isRoutingClassifierAgent(undefined, undefined)).toBe(false);
    
    // Non-matching IDs
    expect(isRoutingClassifierAgent('OTHER_ID', 'OTHER_ALIAS')).toBe(false);
  });
});
