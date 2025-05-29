/**
 * Extended Type Definitions
 * 
 * This file contains extended types for the application that build upon
 * the base types defined in other files.
 */
import { Task, TraceGroup } from './traceParser';

// Extended task interface with additional properties
export interface ExtendedTask extends Task {
  _direction?: 'incoming' | 'outgoing';
  _groupId?: string;
}

// Extended trace group interface with additional properties
export interface ExtendedTraceGroup extends TraceGroup {
  _preventGlobalComplete?: boolean;
}

// Window interface extensions for global state
declare global {
  interface Window {
    __processingComplete?: boolean;
    __killAllProcessing?: () => void;
    __activeTimers?: any[];
    __activeIntervals?: any[];
    __hasSetupGlobalDeadSwitch?: boolean;
    __nodeUpdateCounter?: number;
  }
}

/**
 * Type assertion helper to cast a Task to ExtendedTask
 */
export function asExtendedTask(task: Task): ExtendedTask {
  return task as ExtendedTask;
}

/**
 * Type assertion helper to cast a TraceGroup to ExtendedTraceGroup
 */
export function asExtendedTraceGroup(traceGroup: TraceGroup): ExtendedTraceGroup {
  return traceGroup as ExtendedTraceGroup;
}
