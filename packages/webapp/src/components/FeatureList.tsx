import { useMemo } from "react";
import { AttributeEditor, Input, Textarea } from "./cloudscape-imports"
import { setEditedAttributesAtom, transactionAtom } from "../atoms/AppAtoms";
import { useAtom, useSetAtom } from "jotai";
const ATTRIBUTE_LIMIT = 15
const i18nStrings = {
    addButtonText: 'Add new item',
    removeButtonText: 'Remove',
    empty: 'No tags associated to the resource',
};
export const FeatureList = () => {
    const [transaction] = useAtom(transactionAtom)
    const setAttributeList = useSetAtom(setEditedAttributesAtom)
    const additionalInfo = useMemo(() => <span>You can add {ATTRIBUTE_LIMIT - transaction.editedAttributes.length} more attributes.</span>, [transaction.editedAttributes.length]);

    return (
        <AttributeEditor
            {...i18nStrings}
            onAddButtonClick={() => setAttributeList([
                ...transaction.editedAttributes,
                {
                    name: "",
                    description: ""
                }])}
            onRemoveButtonClick={({
                detail: { itemIndex }
            }) => {
                const tmpItems = [...transaction.editedAttributes];
                tmpItems.splice(itemIndex, 1);
                setAttributeList(tmpItems);
            }}
            items={transaction.editedAttributes}
            addButtonText="Add new item"
            definition={[
                {
                    label: "Attribute",
                    control: (item: { name: string; description: string }, itemIndex: number) => (
                        <Input
                            value={item.name}
                            placeholder="Enter key"
                            onChange={(event: { detail: { value: string } }) => {
                                const tmpAttributes = [...transaction.editedAttributes];
                                tmpAttributes[itemIndex].name = event.detail.value;
                                setAttributeList(tmpAttributes)
                            }}
                        />
                    ),
                },
                {
                    label: "Description",
                    control: (item: { name: string; description: string }, itemIndex: number) => (
                        <Textarea
                            value={item.description}
                            placeholder="Add product details"
                            rows={3}
                            onChange={(event: { detail: { value: string } }) => {
                                const tmpAttributes = [...transaction.editedAttributes];
                                tmpAttributes[itemIndex].description = event.detail.value;
                                setAttributeList(tmpAttributes)
                            }}
                        />
                    )
                }
            ]}
            empty="No items associated with the resource."
            disableAddButton={transaction.editedAttributes.length >= ATTRIBUTE_LIMIT}
            additionalInfo={additionalInfo}
        />
    )
}