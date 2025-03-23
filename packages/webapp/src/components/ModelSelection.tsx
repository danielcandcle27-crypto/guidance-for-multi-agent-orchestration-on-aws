// import React from 'react';
// import Box from '@cloudscape-design/components/box';
// import Select from '@cloudscape-design/components/select';
// import Icon from '@cloudscape-design/components/icon';
// import '../styles/model-selection.css';

// export const supervisorModelOptions = [
//   { label: 'Nova Pro', value: 'amazon.nova-pro-v1:0' },
//   { label: 'Sonnet 3.5 V1', value: 'anthropic.claude-3-5-sonnet-20240620-v1:0' }
// ];

// export const subAgentModelOptions = [
//   { label: 'Nova Micro', value: 'amazon.nova-micro-v1:0' },
//   { label: 'Nova Lite', value: 'amazon.nova-lite-v1:0' },
//   { label: 'Nova Pro', value: 'amazon.nova-pro-v1:0' },
//   { label: 'Sonnet 3.5 V1', value: 'anthropic.claude-3-5-sonnet-20240620-v1:0' },
//   { label: 'Haiku 3.5 V1', value: 'amazon.haiku-3_5_v1:0' },
// ];

// interface ModelSelectionProps {
//   mainModel: string;
//   orderModel: string;
//   personalModel: string;
//   recommendModel: string;
//   troubleModel: string;
//   onModelChange: (agentKey: string, newModel: string) => void;
// }

// export const ModelSelection: React.FC<ModelSelectionProps> = ({
//   mainModel,
//   orderModel,
//   personalModel,
//   recommendModel,
//   troubleModel,
//   onModelChange
// }) => {
//   return (
//     <Box className="model-selection-container">
//       <h2 className="model-selection-title">Agent Model Selection</h2>

//       <div className="model-selection-grid">
//         {/* Supervisor */}
//         <div className="model-agent-row">
//           <div className="agent-info">
//             <span className="agent-icon">
//               <Icon name="user-profile" size="medium" />
//             </span>
//             <span className="agent-name">Supervisor Agent</span>
//           </div>
//           <div className="model-selector">
//             <Select
//               options={supervisorModelOptions}
//               selectedOption={
//                 supervisorModelOptions.find(o => o.value === mainModel) 
//                 || supervisorModelOptions[0]
//               }
//               onChange={({ detail }) => 
//                 onModelChange('main', detail.selectedOption.value ?? 'amazon.nova-pro-v1:0')
//               }
//             />
//           </div>
//         </div>

//         {/* Order */}
//         <div className="model-agent-row">
//           <div className="agent-info">
//             <span className="agent-icon">
//               <Icon name="settings" size="medium" />
//             </span>
//             <span className="agent-name">Order Mgmt</span>
//           </div>
//           <div className="model-selector">
//             <Select
//               options={subAgentModelOptions}
//               selectedOption={
//                 subAgentModelOptions.find(o => o.value === orderModel) 
//                 || subAgentModelOptions[0]
//               }
//               onChange={({ detail }) => 
//                 onModelChange('order', detail.selectedOption.value ?? 'amazon.nova-micro-v1:0')
//               }
//             />
//           </div>
//         </div>

//         {/* Personalization */}
//         <div className="model-agent-row">
//           <div className="agent-info">
//             <span className="agent-icon">
//               <Icon name="user-profile" size="medium" />
//             </span>
//             <span className="agent-name">Personalization</span>
//           </div>
//           <div className="model-selector">
//             <Select
//               options={subAgentModelOptions}
//               selectedOption={
//                 subAgentModelOptions.find(o => o.value === personalModel)
//                 || subAgentModelOptions[0]
//               }
//               onChange={({ detail }) => 
//                 onModelChange('personal', detail.selectedOption.value ?? 'amazon.nova-lite-v1:0')
//               }
//             />
//           </div>
//         </div>

//         {/* Recommendation */}
//         <div className="model-agent-row">
//           <div className="agent-info">
//             <span className="agent-icon">
//               <Icon name="status-positive" size="medium" />
//             </span>
//             <span className="agent-name">Recommend Agent</span>
//           </div>
//           <div className="model-selector">
//             <Select
//               options={subAgentModelOptions}
//               selectedOption={
//                 subAgentModelOptions.find(o => o.value === recommendModel)
//                 || subAgentModelOptions[0]
//               }
//               onChange={({ detail }) => 
//                 onModelChange('recommend', detail.selectedOption.value ?? 'amazon.nova-pro-v1:0')
//               }
//             />
//           </div>
//         </div>

//         {/* Troubleshoot */}
//         <div className="model-agent-row">
//           <div className="agent-info">
//             <span className="agent-icon">
//               <Icon name="status-warning" size="medium" />
//             </span>
//             <span className="agent-name">Troubleshoot</span>
//           </div>
//           <div className="model-selector">
//             <Select
//               options={subAgentModelOptions}
//               selectedOption={
//                 subAgentModelOptions.find(o => o.value === troubleModel)
//                 || subAgentModelOptions[0]
//               }
//               onChange={({ detail }) => 
//                 onModelChange('troubleshoot', detail.selectedOption.value ?? 'amazon.nova-pro-v1:0')
//               }
//             />
//           </div>
//         </div>
//       </div>
//     </Box>
//   );
// };

// export default ModelSelection;
