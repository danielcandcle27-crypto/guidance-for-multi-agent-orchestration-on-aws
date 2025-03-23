import { InputSection } from './InputSection';
import HistoryPanel from './HistoryPanel';
import { useAtom } from 'jotai';
import { showHistoryPanelAtom } from '../atoms/ChatHistoryAtom';
import '../styles/main-layout.css';

interface MainLayoutProps {
    sessionId: string;
    agentId?: string;
    aliasId?: string;
    websocketId?: string;
    onSessionIdChange: (value: string) => void;
    onAgentIdChange: (value: string) => void;
    onAliasIdChange: (value: string) => void;
    onWebsocketIdChange: (value: string) => void;
}

export const MainLayout = ({
    sessionId,
    agentId,
    aliasId,
    websocketId,
    onSessionIdChange,
    onAgentIdChange,
    onAliasIdChange,
    onWebsocketIdChange,
}: MainLayoutProps) => {
    const [showHistoryPanel] = useAtom(showHistoryPanelAtom);

    return (
        <div className="main-container" style={{ width: '100%', maxWidth: '100%' }}>
            <InputSection style={{ width: '100%', maxWidth: '100%' }} />
            {showHistoryPanel && <HistoryPanel style={{ width: '100%', maxWidth: '100%' }} />}
        </div>
    );
};