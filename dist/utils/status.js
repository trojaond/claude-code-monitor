export function getStatusDisplay(status) {
    switch (status) {
        case 'running':
            return { symbol: '●', color: 'gray', label: 'Running' };
        case 'waiting_input':
            return { symbol: '◐', color: 'yellow', label: 'Waiting' };
        case 'stopped':
            return { symbol: '✓', color: 'green', label: 'Done' };
    }
}
