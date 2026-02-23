import * as readline from 'node:readline';
/**
 * Ask for user confirmation with Y/n prompt
 * @param message - The message to display
 * @returns true if user confirms (Enter, 'y', or 'yes'), false otherwise
 */
export async function askConfirmation(message) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(`${message} [Y/n]: `, (answer) => {
            rl.close();
            const normalized = answer.trim().toLowerCase();
            // Accept: Enter only, 'y', or 'yes'
            resolve(normalized === '' || normalized === 'y' || normalized === 'yes');
        });
    });
}
