export interface Chat {
  id: string;
  title: string;
  repo_id: string;
  sandbox_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface Message {
  id: string;
  chat_id: string;
  role: "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[] | null;
  tool_call_id?: string | null;
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
