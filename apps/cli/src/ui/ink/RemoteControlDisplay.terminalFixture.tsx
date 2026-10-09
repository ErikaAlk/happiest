import React from 'react';
import { render } from 'ink';

import { MessageBuffer } from './messageBuffer';
import { RemoteControlDisplay } from './RemoteControlDisplay';

const messages = new MessageBuffer();
messages.addMessage('S12_HISTORY_USER', 'user');
messages.addMessage('S12_HISTORY_ASSISTANT', 'assistant');
const display = render(<RemoteControlDisplay providerName="Codex" messageBuffer={messages} />, {
    exitOnCtrlC: false,
});
await new Promise(resolve => setTimeout(resolve, 100));
messages.addMessage('S12_LIVE_USER', 'user');
messages.addMessage('S12_LIVE_ASSISTANT', 'assistant');
await new Promise(resolve => setTimeout(resolve, 100));
display.unmount();
