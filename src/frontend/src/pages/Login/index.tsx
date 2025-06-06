import { Authenticator } from "@aws-amplify/ui-react";

const Login = () => {
    return (
        <Authenticator
            hideSignUp={true} // Hide sign up option - users must be pre-created
            variation="modal"
            components={{
                SignIn: {
                    Header: () => {
                        return null;
                    },
                },
                // SignUp: {
                //     FormFields() {
                //         return (
                //             <>
                //                 <Authenticator.SignUp.FormFields />
                //             </>
                //         );
                //     },
                // },
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
