import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import type { NonCancelableCustomEvent } from "@cloudscape-design/components";
import { transactionAtom } from "../atoms/AppAtoms"
import { addToChatHistory } from '../atoms/ChatHistoryAtom';
import { useAtom } from "jotai"

interface InputSectionProps {
    style?: React.CSSProperties;
}

export const InputSection = ({ style }: InputSectionProps) => {
    const [transaction, setTransaction] = useAtom(transactionAtom)

    return (
        <div className="input-section-wrapper" style={style}>
            <div className="left-panel">
            </div>
            <ColumnLayout columns={1}>
                <FormField label="Target Demographics">
                    <Input
                        multiline
                        onChange={(event: NonCancelableCustomEvent<{ value: string }>) => setTransaction({
                            ...transaction, demographics: event.detail.value
                        })}
                        value={transaction.demographics}
                        placeholder="Enter target demographic information"
                        rows={5}
                    />
                </FormField>
                <FormField label="Brand Voice Messaging">
                    <Input
                        multiline
                        onChange={(event: NonCancelableCustomEvent<{ value: string }>) => setTransaction({
                            ...transaction, brandMessaging: event.detail.value
                        })}
                        value={transaction.brandMessaging}
                        placeholder="Enter brand voice messaging"
                        rows={5}
                        onBlur={() => {
                            if (transaction.demographics && transaction.brandMessaging) {
                                addToChatHistory(
                                    `Demographics: ${transaction.demographics}\nBrand Messaging: ${transaction.brandMessaging}`,
                                    "Response will appear here"
                                );
                            }
                        }}
                    />
                </FormField>
            </ColumnLayout>
        </div>
    )
}