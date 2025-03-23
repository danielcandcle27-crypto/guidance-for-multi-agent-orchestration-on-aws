// src/App.tsx
import { useEffect } from 'react';
import { Amplify } from 'aws-amplify';
import {
  Authenticator,
  Heading,
  useAuthenticator,
  useTheme,
  View,
  Text,
  Flex,
} from '@aws-amplify/ui-react';
import { signInWithRedirect } from 'aws-amplify/auth';

// Cloudscape subpath imports
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';

import cartLogo from './assets/machines.png';
import { AppBase } from './pages/AppBase';
import { normalizeUrl } from './utils/url-helpers';
import { Login } from './pages/Login';

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(
      /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
    )
);

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_CONFIG_COGNITO_USERPOOL_ID,
      userPoolClientId: import.meta.env.VITE_CONFIG_COGNITO_APPCLIENT_ID,
      identityPoolId: import.meta.env.VITE_CONFIG_COGNITO_IDENTITYPOOL_ID,
      allowGuestAccess: false,
      loginWith: {
        oauth: {
          domain: import.meta.env.VITE_CONFIG_COGNITO_DOMAIN,
          scopes: ['openid'],
          redirectSignIn: isLocalhost
            ? ['http://localhost:3000']
            : [normalizeUrl(import.meta.env.VITE_CONFIG_COGNITO_CALLBACK_URL)],
          redirectSignOut: isLocalhost
            ? ['http://localhost:3000']
            : [normalizeUrl(import.meta.env.VITE_CONFIG_COGNITO_CALLBACK_URL)],
          responseType: 'code',
        },
      },
    },
  },
  API: {
    REST: {
      'http-api': {
        endpoint: import.meta.env.VITE_CONFIG_HTTP_API_URL,
        region: import.meta.env.VITE_REGION,
      },
      'rest-api': {
        endpoint: String(import.meta.env.VITE_CONFIG_REST_API_URL).slice(0, -1),
        region: import.meta.env.VITE_REGION,
      },
    },
  },
  Storage: {
    S3: {
      region: import.meta.env.VITE_REGION,
      bucket: import.meta.env.VITE_CONFIG_S3_DATA_BUCKET_NAME,
    },
  },
});

function App() {
  const { route, authStatus } = useAuthenticator((context) => [
    context.route,
    context.authStatus,
  ]);

  useEffect(() => {
    // Just showing route & authStatus
    console.log('Authenticator route:', route, 'status:', authStatus);
  }, [route, authStatus]);

  const { tokens } = useTheme();

  const components = {
    Header() {
      return (
        <View
          as="div"
          ariaLabel="View example"
          borderRadius="2vw"
          textAlign="center"
          padding={tokens.space.medium}
        >
          <Flex direction="column" textAlign="center" alignItems="center">
            {/* Instead of <Box padding="1rem">, use a <div> */}
            <div
              style={{
                textAlign: 'center',
                padding: '1rem',
                color: 'var(--color-white)',
                fontSize: '2rem',
                fontWeight: 'bold',
                background: 'var(--gradient-primary)',
                borderRadius: 'var(--border-radius-md)',
                boxShadow: 'var(--shadow-md)',
                backdropFilter: 'blur(5px)',
                animation: 'fadeIn 0.5s ease-out',
                marginBottom: '1rem',
              }}
            >
              Multi-agent Collaboration Platform
            </div>

            <img
              src={cartLogo}
              alt="Logo"
              height={'50%'}
              width={'50%'}
              style={{
                borderRadius: '1vw',
              }}
            />

            <Flex
              direction={'row'}
              width={'100%'}
              paddingTop={'1vh'}
              paddingBottom={'1vh'}
            >
              <div
                style={{
                  flexGrow: 1,
                  height: '2px',
                  backgroundColor: 'rgb(131,58,180)',
                }}
              />
            </Flex>
            <div
              style={{
                color: 'var(--color-dark)',
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: '1.2rem',
                marginTop: '1rem',
              }}
            >
            </div>
          </Flex>
        </View>
      );
    },
    Footer() {
      return (
        <View textAlign="center" padding={tokens.space.large}>
          <Text>&copy; 2024 AWS Gen-AI Labs Team</Text>
        </View>
      );
    },
    SignIn: {
      Header() {
        return (
          <Heading level={6} style={{ textAlign: 'center', marginTop: '1rem' }}>
            Login with Amazon Cognito
          </Heading>
        );
      },
      Footer() {
        const { toForgotPassword } = useAuthenticator();
        return (
          <View textAlign="center">
            <Button onClick={toForgotPassword} variant="link">
              Reset Password
            </Button>
          </View>
        );
      },
    },
  };

  const formFields = {
    signIn: {
      username: {
        isRequired: true,
        label: 'Email:',
        placeholder: 'Enter your email',
      },
    },
    resetPassword: {
      username: {
        type: 'email',
        isRequired: true,
        label: 'Email:',
        placeholder: 'Enter your email',
      },
    },
  };

  return (
    <div
      style={{
        background: 'var(--gradient-primary)',
        minHeight: '100vh',
        overflow: 'hidden',
        backgroundSize: '200% 200%',
        animation: 'gradientShift 15s ease infinite',
        transition: 'all var(--transition-normal)',
        transform: 'translateZ(0)',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        backdropFilter: 'blur(10px)',
      }}
    >
      <Authenticator formFields={formFields} hideSignUp={true} components={components}>
        {() => <AppBase />}
      </Authenticator>
    </div>
  );
}

export default App;
