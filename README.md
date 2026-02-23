# Claude Code Monitor

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![macOS](https://img.shields.io/badge/platform-macOS-lightgrey.svg)](https://www.apple.com/macos/)

<<<<<<< HEAD
**Monitor multiple Claude Code sessions in real-time from your terminal or smartphone.**

### Terminal UI
Table view with real-time session monitoring with focus feature which takes you directly to the Claude session you want

<p align="center">
  <img src="https://github.com/user-attachments/assets/1d8ace16-006c-4ea9-86f5-36b83e7e70fa" alt="Terminal UI" width="800">
=======
**Monitor multiple Claude Code sessions in real-time from your terminal.**

<p align="center">
  <img src="https://raw.githubusercontent.com/onikan27/claude-code-monitor/main/docs/ccm-screenshot.png" alt="Terminal UI" width="800">
>>>>>>> 3041331 (Modification)
</p>

---

## ✨ Features

- 📊 **Columnar table view** with real-time session monitoring
- ⌨️ **Quick tab focus** with keyboard shortcuts
- 🧭 **Vim-style navigation** (j/k, Enter, 1-9)
- 📋 **Task detail view** per session
- 🔌 **Serverless** - File-based state management, no API server required
- ⚡ **Easy Setup** - One command `ccm` for automatic setup and launch
- 🔒 **Secure** - No external data transmission

---

## 📋 Requirements

> **Note**: This tool is **macOS only** due to its use of AppleScript for terminal control.

- **macOS**
- **Node.js** >= 18.0.0
- **Claude Code** installed

---

## 🚀 Quick Start

### Install from GitHub

```bash
npm install -g github:trojaond/claude-code-monitor
ccm
```

On first run, it automatically sets up hooks and launches the monitor.

<<<<<<< HEAD
### Mobile Access

The mobile web server is off by default. Enable it with `--server`:

```bash
ccm --server
```

1. Press `h` to show QR code (default port: 3456)
2. Scan with your smartphone (same Wi-Fi required)

> If port 3456 is in use, an available port is automatically selected.

### Remote Access with Tailscale

Access from anywhere using [Tailscale](https://tailscale.com/) (secure VPN).

**Prerequisites:**
1. Install Tailscale on your Mac and smartphone
2. Sign in with the same Tailscale account on both devices
3. Ensure Tailscale is connected (check menu bar icon)

```bash
# Start with Tailscale IP
npx claude-code-monitor -t

# Or if installed globally
ccm -t
```

With `-t` option, the QR code URL uses your Tailscale IP (100.x.x.x), allowing access from any device in your Tailnet - even outside your local network.

> **Security**: Tailscale uses WireGuard encryption. Communication is secure even over public networks.

=======
>>>>>>> 3041331 (Modification)
---

## 📖 Usage

### Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `ccm` | - | Launch monitor (auto-setup if needed) |
| `ccm watch` | `ccm w` | Launch monitor |
| `ccm setup` | - | Configure Claude Code hooks |
| `ccm list` | `ccm ls` | List sessions |
| `ccm clear` | - | Clear all sessions |

<<<<<<< HEAD
### Options

| Option | Description |
|--------|-------------|
| `--server` | Enable mobile web server for phone access (off by default) |
| `--qr` | Show QR code on startup (implies `--server`) |
| `-t, --tailscale` | Prefer Tailscale IP for mobile access |
| `-p, --port <port>` | Specify port (serve command only) |

=======
>>>>>>> 3041331 (Modification)
### Keybindings

| Key | Action |
|-----|--------|
| `↑` / `k` | Move up |
| `↓` / `j` | Move down |
| `Enter` / `f` | Focus selected session |
| `s` | View tasks for selected session |
| `m` | Mark/unmark selected session |
| `1-9` | Quick select & focus |
<<<<<<< HEAD
| `h` | Show/Hide QR code (requires `--server`) |
=======
>>>>>>> 3041331 (Modification)
| `c` | Clear all sessions |
| `q` / `Esc` | Quit |

### Status Icons

| Icon | Status | Description |
|------|--------|-------------|
| `●` | Running | Claude Code is processing |
| `◐` | Waiting | Waiting for user input |
| `✓` | Done | Session ended |

---

## 🖥️ Supported Terminals

| Terminal | Focus Support | Notes |
|----------|--------------|-------|
| iTerm2 | ✅ Full | TTY-based window/tab targeting via AppleScript |
| Terminal.app | ✅ Full | TTY-based window/tab targeting via AppleScript |
| Ghostty | ✅ Full | Title-based window targeting via Window menu |
| VSCode | ✅ Full | IPC socket via CCM Terminal Bridge extension |

> Other terminals can use monitoring, but focus feature is not supported.

### Focus Feature

The focus feature (`Enter`/`f` key or mobile tap) raises the correct terminal window and tab for a given session. The focus strategy tries terminals in order: **iTerm2 → Terminal.app → Ghostty → VSCode**.

For native terminals (iTerm2, Terminal.app, Ghostty), focus uses AppleScript and requires Accessibility permission (System Preferences > Privacy & Security > Accessibility).

For VSCode, focus uses a Unix socket IPC protocol via the **CCM Terminal Bridge** extension (see below).

### Ghostty Users

For reliable focus functionality with multiple tabs, `ccm` or `ccm setup` will prompt you to add the following setting:

```json
// ~/.claude/settings.json
{
  "env": {
    "CLAUDE_CODE_DISABLE_TERMINAL_TITLE": "1"
  }
}
```

This prevents Claude Code from overwriting terminal titles, which is necessary for tab identification in Ghostty.

If you skipped this during setup and want to enable it later, add the setting manually or delete `CLAUDE_CODE_MONITOR_GHOSTTY_ASKED` from your settings and run `ccm` again.

### VSCode Extension: CCM Terminal Bridge

To enable focus support for VSCode terminals, install the **CCM Terminal Bridge** extension. It creates a local Unix socket that allows `ccm` to locate and raise the correct VSCode terminal tab.

**Installation:**

```bash
cd vscode-extension
npm install && npm run compile
```

Then in VSCode: **Extensions > ... > Install from VSIX...** and select the generated `.vsix` file.

**How it works:**

1. The extension activates on VSCode startup and creates a Unix socket at `/tmp/ccm-vscode-{pid}.sock`
2. When `ccm` focuses a session running in VSCode, it discovers the socket and sends a focus request with the TTY path
3. The extension resolves the TTY to the correct terminal tab using `lsof` and brings it to focus
4. The response includes the workspace name so `ccm` can raise the correct VSCode window

No configuration is needed — the extension works automatically once installed.

---

## 🔧 Troubleshooting

### Sessions not showing

1. Run `ccm setup` to verify hook configuration
2. Check `~/.claude/settings.json` for hook settings
3. Restart Claude Code

### Focus not working

1. Verify you're using a supported terminal
2. Check System Preferences > Privacy & Security > Accessibility
   - Ensure your terminal app has Accessibility permission

### Reset data

```bash
ccm clear
```

---

## 🔒 Security

- **No data sent to external servers** - All data stays on your machine
- Hook registration modifies `~/.claude/settings.json`
- Focus feature uses AppleScript for terminal control

---

## 📦 Programmatic Usage

```typescript
import { getSessions, focusSession } from 'claude-code-monitor';

const sessions = getSessions();
if (sessions[0]?.tty) {
  focusSession(sessions[0].tty);
}
```

---

## ⚠️ Disclaimer

This is an unofficial community tool and is not affiliated with Anthropic.
"Claude" and "Claude Code" are trademarks of Anthropic.

---

## 🐛 Issues

Found a bug? [Open an issue](https://github.com/onikan27/claude-code-monitor/issues)

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a PR.

---

## 📝 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for details.

---

## 📄 License

MIT

---

<p align="center">Made with ❤️ for the Claude Code community</p>
