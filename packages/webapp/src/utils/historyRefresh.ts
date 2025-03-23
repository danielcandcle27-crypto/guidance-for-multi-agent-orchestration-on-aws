// Utility to trigger chat history refresh
export const triggerHistoryRefresh = () => {
  window.dispatchEvent(new Event('chatHistoryRefresh'));
};