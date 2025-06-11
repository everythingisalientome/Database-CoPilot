function log(message?: unknown, ...optionalParams: unknown[]): void {
    console.log('ProcessCoPilotAgent: ${message}', optionalParams);
}

function error(message?: unknown, ...optionalParams: unknown[]): void {
    console.error('ProcessCoPilotAgent: ${message}', optionalParams);
}

function warn(message?: unknown, ...optionalParams: unknown[]): void {
    console.warn('ProcessCoPilotAgent: ${message}', optionalParams);
}

function debug(message?: unknown, ...optionalParams: unknown[]): void {
    console.debug('ProcessCoPilotAgent: ${message}', optionalParams);
}

const Logger ={
    log,
    error,
    warn,
    debug
};

export default Logger;
// This module provides logging utilities for the Process Copilot Agent.