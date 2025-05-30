/**
 * Agent configuration utility
 * 
 * This module provides a centralized way to access agent configuration values
 * like agent IDs and alias IDs, pulling them from environment variables,
 * local configuration files, or other runtime sources.
 * 
 * It also provides mappings between agent IDs and their types to avoid
 * hardcoding sensitive IDs throughout the application.
 */

// Agent type constants
export const AGENT_TYPES = {
  ROUTING_CLASSIFIER: 'ROUTING_CLASSIFIER',
  SUPERVISOR: 'Supervisor',
  PRODUCT_RECOMMENDATION: 'ProductRecommendation',
  TROUBLESHOOT: 'Troubleshoot',
  PERSONALIZATION: 'Personalization',
  ORDER_MANAGEMENT: 'OrderManagement'
};

interface AgentConfig {
  routingClassifier: {
    agentId: string;
    agentAliasId: string;
  };
}

// No hardcoded agent IDs - they're considered bad practice

/**
 * Gets agent type based on agent name patterns
 * This avoids using hardcoded agent IDs which is bad practice
 * @param name The name to analyze for agent type matching
 * @returns The corresponding agent type or undefined if not found
 */
export const getAgentTypeFromName = (name?: string): string | undefined => {
  if (!name) return undefined;
  
  const normalizedName = name.toLowerCase();
  
  // Use pattern matching instead of hardcoded IDs
  if (normalizedName.includes('supervisor') || 
      normalizedName.includes('unknown') || 
      normalizedName.includes('main') || 
      normalizedName.includes('orchestrator')) {
    return AGENT_TYPES.SUPERVISOR;
  }
  
  if (normalizedName.includes('routing') || 
      normalizedName.includes('classifier') || 
      normalizedName.includes('router')) {
    return AGENT_TYPES.ROUTING_CLASSIFIER;
  }
  
  if (normalizedName.includes('product') || 
      normalizedName.includes('recommendation') || 
      normalizedName.includes('recommend')) {
    return AGENT_TYPES.PRODUCT_RECOMMENDATION;
  }
  
  if (normalizedName.includes('trouble') || 
      normalizedName.includes('issue') || 
      normalizedName.includes('support')) {
    return AGENT_TYPES.TROUBLESHOOT;
  }
  
  if (normalizedName.includes('personal') || 
      normalizedName.includes('preference')) {
    return AGENT_TYPES.PERSONALIZATION;
  }
  
  if (normalizedName.includes('order') || 
      normalizedName.includes('management') || 
      normalizedName.includes('shipping')) {
    return AGENT_TYPES.ORDER_MANAGEMENT;
  }
  
  return undefined;
};

// Define required configuration keys for better type safety and documentation
export const CONFIG_KEYS = {
  ROUTING_CLASSIFIER_AGENT_ID: 'VITE_ROUTING_CLASSIFIER_AGENT_ID',
  ROUTING_CLASSIFIER_ALIAS_ID: 'VITE_ROUTING_CLASSIFIER_ALIAS_ID',
} as const;

/**
 * Attempts to load config from a local file for development environments
 * This allows developers to set up their local configs without env vars
 */
const loadLocalDevConfig = (): Record<string, string> => {
  try {
    // Only attempt to load local config in development mode
    if (import.meta.env.DEV) {
      // Dynamic import to prevent bundling in production
      // This would typically load from a local file like .env.local or dev-config.json
      // that's gitignored but contains developer-specific settings
      const localConfig = localStorage.getItem('dev-agent-config');
      if (localConfig) {
        try {
          return JSON.parse(localConfig);
        } catch (e) {
          console.warn('Failed to parse local dev config', e);
        }
      }
    }
  } catch (e) {
    console.debug('No local dev config available');
  }
  
  return {};
};

/**
 * Load agent configuration from environment variables or local development config
 * 
 * This function prioritizes:
 * 1. Environment variables (injected at build time by deployment pipeline)
 * 2. Local development configuration (for developer environments)
 * 3. If neither is available, it provides clear error messages instead of fallbacks
 */
const loadAgentConfig = (): AgentConfig => {
  // Try to load from environment variables (injected at build time)
  const envConfig: Record<string, string | undefined> = {
    [CONFIG_KEYS.ROUTING_CLASSIFIER_AGENT_ID]: import.meta.env.VITE_ROUTING_CLASSIFIER_AGENT_ID,
    [CONFIG_KEYS.ROUTING_CLASSIFIER_ALIAS_ID]: import.meta.env.VITE_ROUTING_CLASSIFIER_ALIAS_ID,
  };

  // Load local development config if available
  const localDevConfig = loadLocalDevConfig();

  // Combine configurations with environment variables taking precedence
  const combinedConfig = { ...localDevConfig, ...envConfig };
  
  // Check for missing required configuration values
  const missingKeys: string[] = [];
  if (!combinedConfig[CONFIG_KEYS.ROUTING_CLASSIFIER_AGENT_ID]) {
    missingKeys.push(CONFIG_KEYS.ROUTING_CLASSIFIER_AGENT_ID);
  }
  
  if (!combinedConfig[CONFIG_KEYS.ROUTING_CLASSIFIER_ALIAS_ID]) {
    missingKeys.push(CONFIG_KEYS.ROUTING_CLASSIFIER_ALIAS_ID);
  }

  // In development, provide guidance if values are missing
  if (missingKeys.length > 0) {
    const errorMsg = `Missing required agent configuration: ${missingKeys.join(', ')}`;
    
    if (import.meta.env.DEV) {

      // For development, we'll return placeholder values
      // in production we'd typically want to throw an error
      return {
        routingClassifier: {
          agentId: `missing-${CONFIG_KEYS.ROUTING_CLASSIFIER_AGENT_ID}`,
          agentAliasId: `missing-${CONFIG_KEYS.ROUTING_CLASSIFIER_ALIAS_ID}`
        }
      };
    } else {
      // In production, fail fast if required configuration is missing
      throw new Error(errorMsg);
    }
  }

  return {
    routingClassifier: {
      agentId: combinedConfig[CONFIG_KEYS.ROUTING_CLASSIFIER_AGENT_ID] as string,
      agentAliasId: combinedConfig[CONFIG_KEYS.ROUTING_CLASSIFIER_ALIAS_ID] as string
    }
  };
};

// Export the configuration singleton
export const agentConfig = loadAgentConfig();

/**
 * Helper function to set up development environment configuration
 * Use this in the browser console during development to configure agent IDs
 */
export const setDevAgentConfig = (config: Partial<Record<keyof typeof CONFIG_KEYS, string>>) => {
  if (!import.meta.env.DEV) {
    console.error('Development configuration can only be set in development mode');
    return false;
  }

  try {
    const existingConfig = JSON.parse(localStorage.getItem('dev-agent-config') || '{}');
    const newConfig = { ...existingConfig, ...config };
    localStorage.setItem('dev-agent-config', JSON.stringify(newConfig));
    console.log('Development configuration updated. Reload the page to apply changes.');
    return true;
  } catch (e) {
    console.error('Failed to save development configuration', e);
    return false;
  }
};

/**
 * Helper to check if a trace matches the routing classifier
 * Use this instead of hardcoding IDs in other files
 */
export const isRoutingClassifierAgent = (
  agentId?: string,
  agentAliasId?: string
): boolean => {
  if (!agentId && !agentAliasId) return false;
  
  return (
    agentId === agentConfig.routingClassifier.agentId ||
    agentAliasId === agentConfig.routingClassifier.agentAliasId
  );
};
