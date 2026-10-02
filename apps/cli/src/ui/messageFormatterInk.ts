import type { SDKMessage, SDKAssistantMessage, SDKResultMessage, SDKSystemMessage, SDKUserMessage } from '@/backends/claude/sdk'
import type { MessageBuffer } from './ink/messageBuffer'
import { logger } from './logger'

export type OnAssistantResultInkCallback = (result: SDKResultMessage, messageBuffer: MessageBuffer) => void | Promise<void>

const ASSISTANT_HEADER = '🤖 Assistant:'

function isShownSinceLastPrompt(messageBuffer: MessageBuffer, text: string): boolean {
    const messages = messageBuffer.getMessages()
    let lastPromptIndex = -1
    messages.forEach((entry, index) => {
        if (entry.type === 'user') lastPromptIndex = index
    })
    return messages.slice(lastPromptIndex + 1).some((entry) => entry.type === 'assistant' && entry.content.trim() === text)
}

/**
 * Formats Claude SDK messages for Ink display
 */
export function formatClaudeMessageForInk(
    message: SDKMessage,
    messageBuffer: MessageBuffer,
    onAssistantResult?: OnAssistantResultInkCallback
): void {
    logger.debugLargeJson('[CLAUDE INK] Message from remote mode:', message)

    switch (message.type) {
        case 'system': {
            const sysMsg = message as SDKSystemMessage
            if (sysMsg.subtype === 'init') {
                messageBuffer.addMessage(`🚀 Session ${sysMsg.session_id} · ${sysMsg.model} · ${sysMsg.cwd}`, 'system')
            }
            break
        }

        case 'user': {
            const userMsg = message as SDKUserMessage
            if (userMsg.message && typeof userMsg.message === 'object' && 'content' in userMsg.message) {
                const content = userMsg.message.content
                
                if (typeof content === 'string') {
                    messageBuffer.addMessage(`👤 User: ${content}`, 'user')
                } 
                else if (Array.isArray(content)) {
                    for (const block of content) {
                        if (block.type === 'text') {
                            messageBuffer.addMessage(`👤 User: ${block.text}`, 'user')
                        } else if (block.type === 'tool_result') {
                            messageBuffer.addMessage(`✅ Tool Result (ID: ${block.tool_use_id})`, 'result')
                            if (block.content) {
                                const outputStr = typeof block.content === 'string' 
                                    ? block.content 
                                    : JSON.stringify(block.content, null, 2)
                                const maxLength = 200
                                if (outputStr.length > maxLength) {
                                    messageBuffer.addMessage(outputStr.substring(0, maxLength) + '... (truncated)', 'result')
                                } else {
                                    messageBuffer.addMessage(outputStr, 'result')
                                }
                            }
                        }
                    }
                }
                else {
                    messageBuffer.addMessage(`👤 User: ${JSON.stringify(content, null, 2)}`, 'user')
                }
            }
            break
        }

        case 'assistant': {
            const assistantMsg = message as SDKAssistantMessage
            const displayable = (assistantMsg.message?.content ?? []).filter(
                (block) => (block.type === 'text' && Boolean(block.text)) || block.type === 'tool_use',
            )
            if (displayable.length > 0) {
                messageBuffer.addMessage(ASSISTANT_HEADER, 'assistant')

                for (const block of displayable) {
                    if (block.type === 'text') {
                        messageBuffer.addMessage(block.text ?? '', 'assistant')
                    } else if (block.type === 'tool_use') {
                        messageBuffer.addMessage(`🔧 Tool: ${block.name}`, 'tool')
                        if (block.input) {
                            const inputStr = JSON.stringify(block.input, null, 2)
                            const maxLength = 500
                            if (inputStr.length > maxLength) {
                                messageBuffer.addMessage(`Input: ${inputStr.substring(0, maxLength)}... (truncated)`, 'tool')
                            } else {
                                messageBuffer.addMessage(`Input: ${inputStr}`, 'tool')
                            }
                        }
                    }
                }
            }
            break
        }

        case 'result': {
            const resultMsg = message as SDKResultMessage
            if (resultMsg.subtype === 'success') {
                // With streamed output the assistant messages can arrive without their text; the
                // result carries the final reply, shown unless an assistant message already showed it.
                const reply = 'result' in resultMsg && typeof resultMsg.result === 'string' ? resultMsg.result.trim() : ''
                if (reply && !isShownSinceLastPrompt(messageBuffer, reply)) {
                    messageBuffer.addMessage(ASSISTANT_HEADER, 'assistant')
                    messageBuffer.addMessage(reply, 'assistant')
                }

                if (resultMsg.usage) {
                    const turns = `${resultMsg.num_turns} turn${resultMsg.num_turns === 1 ? '' : 's'}`
                    const seconds = `${(resultMsg.duration_ms / 1000).toFixed(1)}s`
                    messageBuffer.addMessage(`✓ Done · ${turns} · ${seconds} · $${resultMsg.total_cost_usd.toFixed(4)}`, 'status')

                    if (onAssistantResult) {
                        Promise.resolve(onAssistantResult(resultMsg, messageBuffer)).catch(err => {
                            logger.debug('Error in onAssistantResult callback:', err)
                        })
                    }
                }
            } else if (resultMsg.subtype === 'error_max_turns') {
                messageBuffer.addMessage('❌ Error: Maximum turns reached', 'result')
                messageBuffer.addMessage(`Completed ${resultMsg.num_turns} turns`, 'status')
            } else if (resultMsg.subtype === 'error_during_execution') {
                messageBuffer.addMessage('❌ Error during execution', 'result')
                messageBuffer.addMessage(`Completed ${resultMsg.num_turns} turns before error`, 'status')
                logger.debugLargeJson('[RESULT] Error during execution', resultMsg)
            }
            break
        }

        default: {
            if (process.env.DEBUG) {
                messageBuffer.addMessage(`[Unknown message type: ${message.type}]`, 'status')
            }
        }
    }
}
