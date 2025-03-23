import { signInWithRedirect } from '@aws-amplify/auth';

export const handleSignIn = async () => {
    try {
        await signInWithRedirect();
    } catch (error) {
        console.error('Error signing in:', error);
        throw error;
    }
};