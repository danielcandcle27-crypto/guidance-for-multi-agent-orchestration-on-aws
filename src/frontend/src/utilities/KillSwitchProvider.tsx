/**
 * Kill Switch Provider Component
 * 
 * This component can be included in the application to initialize the kill switch system.
 * It sets up the necessary event listeners and provides a consistent way to
 * manage the kill switch functionality throughout the application.
 */
import React, { useEffect, useState } from 'react';
import { setupGlobalKillSwitch } from './killSwitch';
import { FinalMessageKillSwitchListener } from './finalMessageKillSwitch';

interface KillSwitchProviderProps {
  children?: React.ReactNode;
  onKillSwitchActivated?: () => void;
}

/**
 * Kill Switch Provider Component
 * 
 * Provides global kill switch functionality for the application.
 * Include this component near the root of your application.
 * 
 * Example usage:
 * ```jsx
 * <KillSwitchProvider onKillSwitchActivated={() => console.log('Kill switch activated!')}>
 *   <App />
 * </KillSwitchProvider>
 * ```
 */
export const KillSwitchProvider: React.FC<KillSwitchProviderProps> = ({ 
  children, 
  onKillSwitchActivated 
}) => {
  const [isKillSwitchActive, setIsKillSwitchActive] = useState(false);
  
  useEffect(() => {
    // Set up the kill switch system
    console.log('Initializing global kill switch system');
    setupGlobalKillSwitch();
    
    // Listen for kill switch activation
    const handleKillSwitch = () => {
      console.log('Kill switch activated - notifying application');
      setIsKillSwitchActive(true);
      
      if (onKillSwitchActivated) {
        onKillSwitchActivated();
      }
    };
    
    document.addEventListener('globalProcessingKilled', handleKillSwitch);
    
    return () => {
      document.removeEventListener('globalProcessingKilled', handleKillSwitch);
    };
  }, [onKillSwitchActivated]);
  
  return (
    <>
      {/* Include the kill switch listener component */}
      <FinalMessageKillSwitchListener />
      
      {/* Render children */}
      {children}
      
      {/* Optional debug overlay for development */}
      {process.env.NODE_ENV === 'development' && isKillSwitchActive && (
        <div 
          style={{ 
            position: 'fixed', 
            bottom: 10, 
            right: 10, 
            background: 'rgba(255, 0, 0, 0.2)', 
            padding: '5px 10px', 
            borderRadius: 4,
            fontSize: 12,
            color: '#FF0000',
            zIndex: 9999
          }}
        >
          Kill Switch Activated
        </div>
      )}
    </>
  );
};

export default KillSwitchProvider;
