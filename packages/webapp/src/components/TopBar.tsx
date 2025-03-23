// src/components/TopBar.tsx
import TopNavigation from '@cloudscape-design/components/top-navigation';
import type { ButtonDropdownProps } from '@cloudscape-design/components/button-dropdown';

import { Mode } from '@cloudscape-design/global-styles';
import { useAtom } from 'jotai';
import { appName, themeAtom, toggleThemeAtom } from '../atoms/AppAtoms';
import Favicon from '../assets/favicon.png';
import { useEffect, useMemo } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import '../styles/topbar.css';

export default function TopBar() {
  const [theme] = useAtom(themeAtom);
  const [, toggleTheme] = useAtom(toggleThemeAtom);
  
  const { user, signOut } = useAuthenticator((context) => [context.user]);

  

  const userName = useMemo(() => {
      return user.username;
  }, [user]);

  async function handleSignOut() {
    try {
      await signOut();
    } catch (error) {
      console.log('error signing out: ', error);
    }
  }

  const handleSettingsClick = (detail: ButtonDropdownProps.ItemClickDetails) => {
    if (detail.id === 'switch-theme') {
      toggleTheme();
    }
  };

  const handleMenuItemClick = (detail: ButtonDropdownProps.ItemClickDetails) => {
    if (detail.id === 'signout') {
      handleSignOut();
    }
  };

  return (
    <TopNavigation
      identity={{
        href: '/',
        title: appName,
        logo: {
          src: Favicon,
          alt: appName,
        },
        
      }}
      utilities={[
        {
          type: 'button',
          iconName: 'notification',
          title: 'Notifications',
          ariaLabel: 'Notifications (unread)',
          badge: false,
          disableUtilityCollapse: false,
        },
        {
          type: 'menu-dropdown',
          iconName: 'settings',
          ariaLabel: 'Settings',
          title: 'Settings',
          onItemClick: (event: any) => handleSettingsClick(event.detail),
          items: [
            {
              id: 'switch-theme',
              text: theme === Mode.Light ? '🌙  Dark Theme' : '💡 Light Theme',
            },
          ],
        },
        {
          type: 'menu-dropdown',
          text: userName,
          iconName: 'user-profile',
          items: [
            {
              id: 'support-group',
              text: 'Support',
              items: [
                {
                  id: 'documentation',
                  text: 'Documentation',
                  href: 'https://aws.amazon.com/bedrock/',
                  external: true,
                  externalIconAriaLabel: ' (opens in new tab)',
                },
                {
                  id: 'feedback',
                  text: 'Feedback',
                  href: 'https://aws.amazon.com/contact-us/?cmpid=docs_headercta_contactus',
                  external: true,
                  externalIconAriaLabel: ' (opens in new tab)',
                },
              ],
            },
            { id: 'signout', text: 'Sign out' },
          ],
          onItemClick: (event: any) => handleMenuItemClick(event.detail),
        },
      ]}
      i18nStrings={{
        searchIconAriaLabel: 'Search',
        searchDismissIconAriaLabel: 'Close search',
        overflowMenuTriggerText: 'More',
        overflowMenuTitleText: 'All',
        overflowMenuBackIconAriaLabel: 'Back',
        overflowMenuDismissIconAriaLabel: 'Close menu',
      }}
    />
  );
}
