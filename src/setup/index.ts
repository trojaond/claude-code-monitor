import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { HOOK_EVENTS, PACKAGE_NAME } from '../constants.js';
import { askConfirmation } from '../utils/prompt.js';

const CLAUDE_DIR = join(homedir(), '.claude');
const SETTINGS_FILE = join(CLAUDE_DIR, 'settings.json');

/** Environment variable key to disable Claude Code terminal title override */
const DISABLE_TITLE_ENV_KEY = 'CLAUDE_CODE_DISABLE_TERMINAL_TITLE';

/** Environment variable key to track if Ghostty setting was asked */
const GHOSTTY_ASKED_ENV_KEY = 'CLAUDE_CODE_NAVIGATOR_GHOSTTY_ASKED';

/** @internal */
interface HookConfig {
  type: 'command';
  command: string;
}

/** @internal */
interface HookEntry {
  matcher?: string;
  hooks: HookConfig[];
}

/** @internal */
export interface Settings {
  hooks?: Record<string, HookEntry[]>;
  env?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Check if a command string is a ccn hook command for the given event
 * @internal
 */
function isCcnHookCommand(command: string, eventName: string): boolean {
  return command === `ccn hook ${eventName}` || command === `npx ${PACKAGE_NAME} hook ${eventName}`;
}

/**
 * Check if the ccn hook is already configured for the given event
 * @internal
 */
function hasCcnHookForEvent(entries: HookEntry[] | undefined, eventName: string): boolean {
  if (!entries) return false;
  return entries.some((entry) => entry.hooks.some((h) => isCcnHookCommand(h.command, eventName)));
}

/**
 * Check if ccn command is in PATH and return the appropriate command
 */
function getCcnCommand(): string {
  const result = spawnSync('which', ['ccn'], { encoding: 'utf-8' });
  if (result.status === 0) {
    return 'ccn';
  }
  return `npx ${PACKAGE_NAME}`;
}

/**
 * Check if Ghostty is installed
 * @internal
 */
function isGhosttyInstalled(): boolean {
  // Check if Ghostty.app exists
  if (existsSync('/Applications/Ghostty.app')) {
    return true;
  }
  // Check if ghostty command is in PATH
  const result = spawnSync('which', ['ghostty'], { encoding: 'utf-8' });
  return result.status === 0;
}

/**
 * Check if the Ghostty terminal title setting has been asked
 * @internal
 */
function hasGhosttySettingAsked(settings: Settings): boolean {
  return settings.env?.[GHOSTTY_ASKED_ENV_KEY] === '1';
}

/**
 * Apply the Ghostty terminal title setting
 * @param settings - Settings object to modify
 * @param enabled - true to enable the env var, false to just mark as asked
 * @internal
 */
function applyGhosttyTitleSetting(settings: Settings, enabled: boolean): void {
  if (!settings.env) {
    settings.env = {};
  }

  // Mark as asked so we don't prompt again
  settings.env[GHOSTTY_ASKED_ENV_KEY] = '1';

  // Only set disable title env var if user chose to enable
  if (enabled) {
    settings.env[DISABLE_TITLE_ENV_KEY] = '1';
  }
}

/**
 * Create a hook entry for the given event
 * @internal
 */
function createHookEntry(eventName: string, baseCommand: string): HookEntry {
  const entry: HookEntry = {
    hooks: [
      {
        type: 'command',
        command: `${baseCommand} hook ${eventName}`,
      },
    ],
  };
  // Events other than UserPromptSubmit require a matcher
  if (eventName !== 'UserPromptSubmit') {
    entry.matcher = '';
  }
  return entry;
}

/**
 * Load existing settings.json or return empty settings
 */
function loadSettings(): Settings {
  if (!existsSync(SETTINGS_FILE)) {
    return {};
  }
  try {
    const content = readFileSync(SETTINGS_FILE, 'utf-8');
    return JSON.parse(content) as Settings;
  } catch {
    console.error('Warning: Failed to parse existing settings.json, creating new one');
    return {};
  }
}

/**
 * Determine which hooks need to be added or skipped
 * @internal
 */
function categorizeHooks(settings: Settings): { toAdd: string[]; toSkip: string[] } {
  const toAdd: string[] = [];
  const toSkip: string[] = [];

  for (const eventName of HOOK_EVENTS) {
    if (hasCcnHookForEvent(settings.hooks?.[eventName], eventName)) {
      toSkip.push(eventName);
    } else {
      toAdd.push(eventName);
    }
  }

  return { toAdd, toSkip };
}

/**
 * Display setup preview to the user
 */
function showSetupPreview(
  hooksToAdd: string[],
  hooksToSkip: string[],
  settingsExist: boolean
): void {
  console.log(`Target file: ${SETTINGS_FILE}`);
  console.log(settingsExist ? '(file exists, will be modified)' : '(file will be created)');
  console.log('');
  console.log('The following hooks will be added:');
  for (const eventName of hooksToAdd) {
    console.log(`  [add]  ${eventName}`);
  }
  if (hooksToSkip.length > 0) {
    console.log('');
    console.log('Already configured (will be skipped):');
    for (const eventName of hooksToSkip) {
      console.log(`  [skip] ${eventName}`);
    }
  }
  console.log('');
}

/**
 * Apply hooks to settings and save to file
 */
function applyHooks(settings: Settings, hooksToAdd: string[], baseCommand: string): void {
  if (!settings.hooks) {
    settings.hooks = {};
  }

  for (const eventName of hooksToAdd) {
    const existing = settings.hooks[eventName];
    if (!existing) {
      settings.hooks[eventName] = [createHookEntry(eventName, baseCommand)];
    } else {
      existing.push(createHookEntry(eventName, baseCommand));
    }
  }

  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
}

/**
 * Check if hooks are already configured
 */
export function isHooksConfigured(): boolean {
  if (!existsSync(SETTINGS_FILE)) {
    return false;
  }

  try {
    const content = readFileSync(SETTINGS_FILE, 'utf-8');
    const settings = JSON.parse(content) as Settings;

    if (!settings.hooks) {
      return false;
    }

    // Check if all hook events are configured
    for (const eventName of HOOK_EVENTS) {
      if (!hasCcnHookForEvent(settings.hooks[eventName], eventName)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

export async function setupHooks(): Promise<void> {
  console.log('Claude Code Navigator Setup');
  console.log('============================');
  console.log('');

  const baseCommand = getCcnCommand();
  console.log(`Using command: ${baseCommand}`);
  console.log('');

  // Ensure .claude directory exists
  if (!existsSync(CLAUDE_DIR)) {
    mkdirSync(CLAUDE_DIR, { recursive: true });
  }

  const settingsExist = existsSync(SETTINGS_FILE);
  const settings = loadSettings();
  const { toAdd: hooksToAdd, toSkip: hooksToSkip } = categorizeHooks(settings);

  // Check for Ghostty and terminal title env
  const ghosttyInstalled = isGhosttyInstalled();
  const needsGhosttyPrompt = ghosttyInstalled && !hasGhosttySettingAsked(settings);

  // No changes needed
  if (hooksToAdd.length === 0 && !needsGhosttyPrompt) {
    console.log('All hooks already configured. No changes needed.');
    console.log('');
    console.log(`Start monitoring with: ${baseCommand} watch`);
    return;
  }

  let hooksApplied = false;
  let envApplied = false;

  // Step 1: Hook setup
  if (hooksToAdd.length > 0) {
    showSetupPreview(hooksToAdd, hooksToSkip, settingsExist);

    const confirmed = await askConfirmation('Do you want to apply these changes?');
    if (confirmed) {
      applyHooks(settings, hooksToAdd, baseCommand);
      hooksApplied = true;
      console.log('');
      console.log(`Added ${hooksToAdd.length} hook(s) to ${SETTINGS_FILE}`);
    } else {
      console.log('');
      console.log('Hook setup skipped.');
    }
    console.log('');
  }

  // Step 2: Ghostty-specific setup (separate confirmation)
  if (needsGhosttyPrompt) {
    console.log('Ghostty detected.');
    console.log('For reliable tab focus, Claude Code terminal title override should be disabled.');
    console.log('');
    const envConfirmed = await askConfirmation('Add CLAUDE_CODE_DISABLE_TERMINAL_TITLE setting?');
    // Save decision so we don't ask again
    applyGhosttyTitleSetting(settings, envConfirmed);
    writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
    if (envConfirmed) {
      envApplied = true;
      console.log('');
      console.log('Ghostty setting added.');
    } else {
      console.log('');
      console.log('Ghostty setting skipped (will not ask again).');
    }
    console.log('');
  }

  // Summary
  if (hooksApplied || envApplied) {
    console.log('Setup complete!');
    console.log('');
    console.log(`Start monitoring with: ${baseCommand} watch`);
  } else {
    console.log('No changes were made.');
  }
}

/**
 * Prompt for Ghostty setting if needed (called from ccn command when hooks are already configured)
 */
export async function promptGhosttySettingIfNeeded(): Promise<void> {
  const ghosttyInstalled = isGhosttyInstalled();
  if (!ghosttyInstalled) return;

  const settings = loadSettings();
  if (hasGhosttySettingAsked(settings)) return;

  console.log('');
  console.log('Ghostty detected.');
  console.log('For reliable tab focus, Claude Code terminal title override should be disabled.');
  console.log('');
  const envConfirmed = await askConfirmation('Add CLAUDE_CODE_DISABLE_TERMINAL_TITLE setting?');

  applyGhosttyTitleSetting(settings, envConfirmed);
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });

  if (envConfirmed) {
    console.log('');
    console.log('Ghostty setting added.');
  } else {
    console.log('');
    console.log('Ghostty setting skipped (will not ask again).');
  }
  console.log('');
}
