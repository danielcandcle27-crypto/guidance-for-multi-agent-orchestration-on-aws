import { Authenticator } from "@aws-amplify/ui-react";

const Login = () => {
    return (
        <Authenticator
            hideSignUp={false} // Allow sign up for standard Cognito auth
            variation="modal"
            components={{
                SignIn: {
                    Header: () => {
                        // Removed Midway sign-in button
                        return null;
                    },
                },
            }}
        />
    );
};

export default Login;
