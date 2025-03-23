import React from 'react';
import Icon from '@cloudscape-design/components/icon';
import Button from '@cloudscape-design/components/button';

interface HamburgerButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

const HamburgerButton: React.FC<HamburgerButtonProps> = ({ onClick, isOpen }) => {
  return (
    <Button
      variant="icon"
      onClick={onClick}
      iconName={isOpen ? "close" : "menu"}
      ariaLabel={isOpen ? "Close model selection" : "Open model selection"}
    />
  );
};

export default HamburgerButton;