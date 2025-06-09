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
  supervisor: {
    agentId: string;
    agentAliasId: string;
  };
  productRecommendation: {
    agentId: string;
    agentAliasId: string;
  };
  personalization: {
    agentId: string;
    agentAliasId: string;
  };
  troubleshoot: {
    agentId: string;
    agentAliasId: string;
  };
  orderManagement: {
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
  SUPERVISOR_AGENT_ID: 'VITE_SUPERVISOR_AGENT_ID',
  SUPERVISOR_ALIAS_ID: 'VITE_SUPERVISOR_ALIAS_ID',
  PRODUCT_RECOMMENDATION_AGENT_ID: 'VITE_PRODUCT_RECOMMENDATION_AGENT_ID',
  PRODUCT_RECOMMENDATION_ALIAS_ID: 'VITE_PRODUCT_RECOMMENDATION_ALIAS_ID',
  PERSONALIZATION_AGENT_ID: 'VITE_PERSONALIZATION_AGENT_ID',
  PERSONALIZATION_ALIAS_ID: 'VITE_PERSONALIZATION_ALIAS_ID',
  TROUBLESHOOT_AGENT_ID: 'VITE_TROUBLESHOOT_AGENT_ID',
  TROUBLESHOOT_ALIAS_ID: 'VITE_TROUBLESHOOT_ALIAS_ID',
  ORDER_MANAGEMENT_AGENT_ID: 'VITE_ORDER_MANAGEMENT_AGENT_ID',
  ORDER_MANAGEMENT_ALIAS_ID: 'VITE_ORDER_MANAGEMENT_ALIAS_ID',
} as const;

// Dynamic agent ID to agent name mapping
// This will be populated as we encounter agent IDs in trace data
const agentIdToNameMap = new Map<string, string>();

/**
 * Get agent name from agent ID
 * Uses both static environment variable mapping and dynamic discovery
 */
export const getAgentNameFromId = (agentId: string): string => {
  if (!agentId) return AGENT_TYPES.SUPERVISOR;
  
  // Check static mapping from environment variables
  if (agentId === agentConfig.routingClassifier.agentId) {
    return AGENT_TYPES.ROUTING_CLASSIFIER;
  }
  if (agentId === agentConfig.supervisor.agentId) {
    return AGENT_TYPES.SUPERVISOR;
  }
  if (agentId === agentConfig.productRecommendation.agentId) {
    return AGENT_TYPES.PRODUCT_RECOMMENDATION;
  }
  if (agentId === agentConfig.personalization.agentId) {
    return AGENT_TYPES.PERSONALIZATION;
  }
  if (agentId === agentConfig.troubleshoot.agentId) {
    return AGENT_TYPES.TROUBLESHOOT;
  }
  if (agentId === agentConfig.orderManagement.agentId) {
    return AGENT_TYPES.ORDER_MANAGEMENT;
  }
  
  // Check dynamic mapping
  if (agentIdToNameMap.has(agentId)) {
    return agentIdToNameMap.get(agentId)!;
  }
  
  // Default to Supervisor for unknown agent IDs
  return AGENT_TYPES.SUPERVISOR;
};

/**
 * Register an agent ID to name mapping dynamically
 * This allows us to learn agent names from trace data
 */
export const registerAgentMapping = (agentId: string, agentName: string): void => {
  if (agentId && agentName) {
    agentIdToNameMap.set(agentId, agentName);
  }
};

/**
 * Get all known agent ID to name mappings
 */
export const getAllAgentMappings = (): Record<string, string> => {
  const mappings: Record<string, string> = {};
  
  // Add static mappings
  mappings[agentConfig.routingClassifier.agentId] = AGENT_TYPES.ROUTING_CLASSIFIER;
  mappings[agentConfig.supervisor.agentId] = AGENT_TYPES.SUPERVISOR;
  mappings[agentConfig.productRecommendation.agentId] = AGENT_TYPES.PRODUCT_RECOMMENDATION;
  mappings[agentConfig.personalization.agentId] = AGENT_TYPES.PERSONALIZATION;
  mappings[agentConfig.troubleshoot.agentId] = AGENT_TYPES.TROUBLESHOOT;
  mappings[agentConfig.orderManagement.agentId] = AGENT_TYPES.ORDER_MANAGEMENT;
  
  // Add dynamic mappings
  agentIdToNameMap.forEach((name, id) => {
    mappings[id] = name;
  });
  
  return mappings;
};

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
    [CONFIG_KEYS.SUPERVISOR_AGENT_ID]: import.meta.env.VITE_SUPERVISOR_AGENT_ID,
    [CONFIG_KEYS.SUPERVISOR_ALIAS_ID]: import.meta.env.VITE_SUPERVISOR_ALIAS_ID,
    [CONFIG_KEYS.PRODUCT_RECOMMENDATION_AGENT_ID]: import.meta.env.VITE_PRODUCT_RECOMMENDATION_AGENT_ID,
    [CONFIG_KEYS.PRODUCT_RECOMMENDATION_ALIAS_ID]: import.meta.env.VITE_PRODUCT_RECOMMENDATION_ALIAS_ID,
    [CONFIG_KEYS.PERSONALIZATION_AGENT_ID]: import.meta.env.VITE_PERSONALIZATION_AGENT_ID,
    [CONFIG_KEYS.PERSONALIZATION_ALIAS_ID]: import.meta.env.VITE_PERSONALIZATION_ALIAS_ID,
    [CONFIG_KEYS.TROUBLESHOOT_AGENT_ID]: import.meta.env.VITE_TROUBLESHOOT_AGENT_ID,
    [CONFIG_KEYS.TROUBLESHOOT_ALIAS_ID]: import.meta.env.VITE_TROUBLESHOOT_ALIAS_ID,
    [CONFIG_KEYS.ORDER_MANAGEMENT_AGENT_ID]: import.meta.env.VITE_ORDER_MANAGEMENT_AGENT_ID,
    [CONFIG_KEYS.ORDER_MANAGEMENT_ALIAS_ID]: import.meta.env.VITE_ORDER_MANAGEMENT_ALIAS_ID,
  };

  // Load local development config if available
  const localDevConfig = loadLocalDevConfig();

  // Combine configurations with environment variables taking precedence
  const combinedConfig = { ...localDevConfig, ...envConfig };
  
  // For development, provide default values if missing to avoid build failures
  if (import.meta.env.DEV) {
    // Fill in any missing values with placeholders
    Object.keys(CONFIG_KEYS).forEach(key => {
      const configKey = CONFIG_KEYS[key as keyof typeof CONFIG_KEYS];
      if (!combinedConfig[configKey]) {
        combinedConfig[configKey] = `dev-placeholder-${configKey.toLowerCase().replace('vite_', '')}`;
      }
    });
  }

  return {
    routingClassifier: {
      agentId: combinedConfig[CONFIG_KEYS.ROUTING_CLASSIFIER_AGENT_ID] as string,
      agentAliasId: combinedConfig[CONFIG_KEYS.ROUTING_CLASSIFIER_ALIAS_ID] as string
    },
    supervisor: {
      agentId: combinedConfig[CONFIG_KEYS.SUPERVISOR_AGENT_ID] as string,
      agentAliasId: combinedConfig[CONFIG_KEYS.SUPERVISOR_ALIAS_ID] as string
    },
    productRecommendation: {
      agentId: combinedConfig[CONFIG_KEYS.PRODUCT_RECOMMENDATION_AGENT_ID] as string,
      agentAliasId: combinedConfig[CONFIG_KEYS.PRODUCT_RECOMMENDATION_ALIAS_ID] as string
    },
    personalization: {
      agentId: combinedConfig[CONFIG_KEYS.PERSONALIZATION_AGENT_ID] as string,
      agentAliasId: combinedConfig[CONFIG_KEYS.PERSONALIZATION_ALIAS_ID] as string
    },
    troubleshoot: {
      agentId: combinedConfig[CONFIG_KEYS.TROUBLESHOOT_AGENT_ID] as string,
      agentAliasId: combinedConfig[CONFIG_KEYS.TROUBLESHOOT_ALIAS_ID] as string
    },
    orderManagement: {
      agentId: combinedConfig[CONFIG_KEYS.ORDER_MANAGEMENT_AGENT_ID] as string,
      agentAliasId: combinedConfig[CONFIG_KEYS.ORDER_MANAGEMENT_ALIAS_ID] as string
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
