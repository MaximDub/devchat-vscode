// src/contributes/commandsBase.ts

import { runCommand } from "../util/commonUtil";
import { logger } from "../util/logger";


export function checkDevChatDependency(pythonCommand: string): boolean {
	try {
		const binPath = getPipxEnvironmentPath(pythonCommand);

		if (binPath) {
			updateEnvironmentPath(binPath);
		} else {
			logger.channel()?.info(`Failed to obtain the pipx environment path.`);
		}
	} catch (error) {
		// DevChat dependency check failed
		// log out detail error message
		logger.channel()?.info(`Failed to check DevChat dependency due to error: ${error}`);
	}

	try {
		// Check if DevChat is installed
		runCommand('devchat --help');
		return true;
	} catch(error) {
		logger.channel()?.error(`Failed to check DevChat dependency due to error: ${error}`);
		return false;
	}
}

export function getValidPythonCommand(): string | undefined {
	try {
		runCommand('python3 -V');
		return 'python3';
	} catch (error) {
		try {
			const version = runCommand('python -V');
			if (version.includes('Python 3')) {
				return 'python';
			}
			return undefined;
		} catch (error) {
			return undefined;
		}
	}
}

export function getPipxEnvironmentPath(pythonCommand: string): string | null {
	// Get pipx environment
	const pipxEnvOutput = runCommand(`${pythonCommand} -m pipx environment`).toString();
	const binPathRegex = /PIPX_BIN_DIR=\s*(.*)/;

	// Get BIN path from pipx environment
	const match = pipxEnvOutput.match(binPathRegex);
	if (match && match[1]) {
		return match[1];
	} else {
		return null;
	}
}

function updateEnvironmentPath(binPath: string): void {
	// Add BIN path to PATH
	process.env.PATH = `${binPath}:${process.env.PATH}`;
}