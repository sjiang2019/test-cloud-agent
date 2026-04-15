export interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ChatDetail extends Chat {
  messages: Message[];
}

export interface Repo {
  id: string;
  url: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
}
