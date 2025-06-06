import { Authenticator } from "@aws-amplify/ui-react";

const Login = () => {
    return (
        <Authenticator
            hideSignUp={false} // Enable sign up with username
            variation="modal"
            components={{
                SignIn: {
                    Header: () => {
                        // Removed Midway sign-in button
                        return null;
                    },
                },
                SignUp: {
                    FormFields() {
                        return (
                            <>
                                <Authenticator.SignUp.FormFields />
                            </>
                        );
                    },
                },
            }}
            services={{
                async validateCustomSignUp(formData) {
                    if (!formData.username) {
                        return {
                            username: "Username is required",
                        };
                    }
                    return {};
                },
            }}
        />
    );
};

export default Login;
