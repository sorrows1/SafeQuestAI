import { Box } from "@mui/material";
import { MessageBubble } from "@/components/messaging/MessageBubble";
import { SelectableMessage } from "./SelectableMessage";
import type { ScenarioSkinProps } from "./types";
export function ChatSkin({ messages, detectiveMode, highlightedMessageIds, onToggleMessage }: ScenarioSkinProps) { return <Box aria-label="Chat scenario" sx={{ maxWidth: 760, mx: "auto", py: 2 }}>{messages.map((message, index) => <SelectableMessage key={message.id} messageId={message.id} selectable={detectiveMode} selected={highlightedMessageIds.includes(message.id)} onToggle={onToggleMessage}><MessageBubble content={message.content} speakerLabel={message.speaker_label} side={index % 2 ? "right" : "left"} pace={message.pace} selectable={detectiveMode} /></SelectableMessage>)}</Box>; }
