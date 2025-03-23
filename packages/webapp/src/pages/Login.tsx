import { Box, Button, Checkbox } from "../components/cloudscape-imports";
import { Link, Modal, TextContent } from "../components/cloudscape-imports";
import { handleSignIn } from "../auth/cognito";

import BotLogo from "../assets/bot_logo.png"
import { appName, termsAtom } from "../atoms/AppAtoms"
import { useAtom } from "jotai"
import { useState } from "react"

export const Login = () => {
    const [agreeTerms, setAgreeTerms] = useAtom(termsAtom)
    const [termsModal, setTermsModal] = useState(false)
    
    const onSignIn = async () => {
        await handleSignIn();
    }

    return (
        <>
            <Box padding={{ top: "xxxl" }} variant="h1" textAlign="center">
                {appName}
            </Box>
            <Box
                color="text-body-secondary"
                textAlign="center"
                fontWeight="bold"
                fontSize="heading-xl"
                padding={{ bottom: "xl", top: "xl" }}
            >
                <img src={BotLogo} alt="Logo" height={250} width={200} />
            </Box>
            <Box padding={{ top: "xxxl", bottom: 'm' }} variant="h1" textAlign="center">
                <Button disabled={!agreeTerms} onClick={onSignIn} variant="primary">Sign In</Button>
            </Box>
            <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <Box padding={{ horizontal: 'xs' }} variant="h1" textAlign="center">
                    <Checkbox
                        onChange={({ detail }: { detail: { checked: boolean } }) =>
                            setAgreeTerms(detail.checked)
                        }
                        checked={agreeTerms}
                    >
                    </Checkbox>
                </Box>
                <TextContent>
                    Agree to <Link onClick={() => setTermsModal(true)} variant="primary">
                        Terms and Conditions
                    </Link>
                </TextContent>
            </div>

            <Modal
                onDismiss={() => setTermsModal(false)}
                visible={termsModal}
                header="Demo Portal Terms of Use"
                footer={<Box float="right">
                    <Button variant="link" onClick={() => setTermsModal(false)}>Close</Button>
                    <Button variant="primary" onClick={() => {
                        setAgreeTerms(true)
                        setTermsModal(false)
                    }}>Agree</Button>
                </Box>}
            >
                <TextContent>
                    <p>The Terms of Use provided below are designed to promote the safe and secure use of demos hosted on the AWS Demo Portal. Because inappropriate use of these demos can expose AWS, and Amazon generally, to security, compliance, and legal risks, and loss of customer trust, please familiarize yourself with the following:</p>
                    <br />
                    <p>
                        <strong>For Event Facilitators (individuals running events using AWS Demo Portal):</strong>
                    </p>
                    <p>
                        <ul>
                            <li>
                                Demo audiences are permitted only to view the demonstration being conducted by an AWS Employee.
                                <ul>
                                    <li>
                                        Consumption of demo content, its code, or engineering artifacts, directly by customer is strictly prohibited. However, AWS Employees are permitted to use these projects as inspiration for their work with customers.
                                    </li>
                                </ul>
                            </li>
                            <li>
                                Exercise caution by refraining from using any customer-specific data, including in-scope for regulation under PII, HIPAA, GDPR, or CCPA when running a given demo. Use purely fictional examples as provided in the demo itself.
                            </li>
                            <li>Use security best-practices and recommendations.</li>
                            <li>
                                Protect information from unauthorized access or misuse. See the AWS Private Information Protocols for more information on how we protect information at AWS.
                            </li>
                            <li>Once an event is completed, promptly exit the demo and remove any associated data.</li>
                            <li>Do not run multiple concurrent demos</li>
                        </ul>
                    </p>
                    <p>
                        <strong>All users must not:</strong>
                    </p>
                    <p>
                        <ul>
                            <li>
                                Under any circumstances, permit any non-AWS employee to directly access the demo in any way.
                                <ul>
                                    <li>At this time these demos are intended only for live or recorded presentations or demonstrations by AWS employees.</li>
                                </ul>
                            </li>
                            <li>Attempt to access data that they are not authorized to use or access.</li>
                            <li>Perform any unauthorized changes or store unapproved company data within demo content.</li>
                            <li>Provide static passwords, such as default or actual passwords.</li>
                            <li>Change or modify limits out of band for accounts.</li>
                            <li>
                                Transfer data or software to any person or organization outside AWS without the permission of AWS AppSec and AWS Legal.
                            </li>
                            <li>
                                Use any material or information, including images, logos, or photographs in any manner that violates copyright, trademark, or intellectual property laws.
                            </li>
                            <li>
                                Share data about a demo participant's usage of third-party products/services/models (e.g., third-party models on Amazon Bedrock) during an event with first party AWS Service Teams.
                            </li>
                            <li>
                                Use information/data about a demo participant's usage of third-party products/services/models (e.g., third party models on Amazon Bedrock) during a an event to compete against those third-party products/services/models.
                            </li>
                        </ul>
                    </p>
                    <p>
                        AWS Demo Portal users should follow the above steps and take all necessary precautions to protect customer data and Amazon Confidential Information. Please see the AWS Private Information Protocols for more information on AWS guidelines for using, accessing, storing, and sharing non-public information we have about AWS, our customers, or third parties. Misuse of AWS Demo Portal may result in the suspension of access to AWS Demo Portal, or escalation to your manager and AWS Security.
                    </p>

                </TextContent>
            </Modal>

        </>
    )
}