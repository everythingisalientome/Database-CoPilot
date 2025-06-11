import * as vscode from 'vscode';

import Logger from './utilities/logUtils';
import { activateProcessCopilotAgent } from './copilottool/ProcessCoPilotAgent';

export function activate(context: vscode.ExtensionContext) {
	activateProcessCopilotAgent(context);
}

// This method is called when your extension is deactivated
export function deactivate():void {
	Logger.log('Process Copilot Agent has been deactivated.');
}
