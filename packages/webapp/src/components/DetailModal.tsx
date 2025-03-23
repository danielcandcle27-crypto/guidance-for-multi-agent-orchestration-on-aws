import { Box, Button, ColumnLayout, FormField, Modal, SpaceBetween, Textarea } from "./cloudscape-imports"
import { useAtom } from "jotai"
import ImagePlaceHolder from "../assets/image_placeholder.png"
import { DetailsModalAtom } from "../atoms/AppAtoms"
import { useGetProductImage } from "../hooks/useStorage"
export const DetailModal = () => {
    const [detailModal, setDetailModal] = useAtom(DetailsModalAtom)
    const { data: productImage } = useGetProductImage(detailModal.item ? detailModal.item.category + "/" + detailModal.item.imageKey : ""
    )


    return (
        <Modal
            onDismiss={() => setDetailModal({
                ...detailModal,
                visible: false
            })}
            visible={detailModal.visible}
            footer={<Box float="right">
                <SpaceBetween direction="horizontal" size="xs">
                    <Button variant="primary" onClick={() => setDetailModal({
                        ...detailModal,
                        visible: false
                    })}>Close</Button>

                </SpaceBetween>
            </Box>}
            header="Execution Details"
        >
            <span>
                <Box textAlign="center" variant="h5">Product Image</Box>
                <Box textAlign="center" padding={{ bottom: "l" }}>
                    <img src={productImage?.url ?? ImagePlaceHolder} alt={productImage?.imageName ?? ""} width={"30%"} />
                </Box>
                <SpaceBetween size="xl">
                    <ColumnLayout columns={2}>
                        <FormField
                            label="Attribute"
                            stretch={true}
                        >
                            <SpaceBetween size="l">
                                {detailModal.item && detailModal.item.editedAttributes.map(attribute =>
                                    <Textarea key={attribute.name} value={attribute.name} readOnly rows={2} />

                                )}
                            </SpaceBetween>
                        </FormField>
                        <FormField
                            label="Description"

                            stretch={true}
                        >
                            <SpaceBetween size="l">
                                {detailModal.item && detailModal.item.editedAttributes.map(attribute =>
                                    <Textarea key={attribute.description} value={attribute.description} readOnly rows={2} />

                                )}
                            </SpaceBetween>
                        </FormField>
                    </ColumnLayout>

                    <FormField label="Target Demographics">
                        <Textarea
                            readOnly
                            value={detailModal.item?.demographics ?? ""}
                            rows={5}
                        />
                    </FormField>
                    <FormField label="Brand Voice Messaging">
                        <Textarea
                            readOnly
                            value={detailModal.item?.brandMessaging ?? ""}
                            rows={5}
                        />
                    </FormField>
                    <FormField label="Generated Text">
                        <Textarea
                            readOnly
                            value={detailModal.item?.generatedDescription ?? ""}
                            rows={5}
                        />
                    </FormField>
                </SpaceBetween>
            </span>
        </Modal>
    )
}