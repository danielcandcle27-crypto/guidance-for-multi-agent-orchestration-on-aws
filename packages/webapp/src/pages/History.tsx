import { useSetAtom } from "jotai"
import { DetailModal } from "../components/DetailModal"
import { HistoryTable } from "../components/HistoryTable"
import { infoDrawerAtom } from "../atoms/AppAtoms"
import { useEffect } from "react"

export const History = () => {

    const setInfoDrawer = useSetAtom(infoDrawerAtom)

    useEffect(() => {
        setInfoDrawer(false)
    }, [])

    return (
        <>
            <HistoryTable />
            <DetailModal />
        </>
    )
}