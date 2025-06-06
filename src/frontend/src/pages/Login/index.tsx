import { Authenticator } from "@aws-amplify/ui-react";

const Login = () => {
    return (
        <Authenticator
            hideSignUp={true} // Prevent sign up, allowing only existing users to log in
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
