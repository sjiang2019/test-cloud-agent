export interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: Date;
}

export interface Message {
  id: string;
  chatId: string;
  content: string;
  sender: "user" | "assistant";
  timestamp: Date;
}
