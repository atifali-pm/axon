import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import EventSource from "react-native-sse";
import { useAuth } from "@/lib/auth-context";
import { apiUrl, getToken } from "@/lib/api";

type Msg = { id: string; role: "user" | "assistant"; content: string };

export default function Chat() {
  const { me, signOut } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const listRef = useRef<FlatList<Msg>>(null);
  const nextId = useRef(0);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const token = await getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setInput("");
    setBusy(true);

    const userMsg: Msg = { id: String(++nextId.current), role: "user", content: text };
    const assistantMsg: Msg = { id: String(++nextId.current), role: "assistant", content: "" };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 20);

    const es = new EventSource(`${apiUrl()}/api/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: text, conversationId: convId, stream: true }),
      pollingInterval: 0,
    });

    es.addEventListener("message", (event: { data?: string | null }) => {
      const payload = event.data;
      if (!payload || payload === "[DONE]") return;
      try {
        const ev = JSON.parse(payload) as { type: string; content?: string };
        if (ev.type === "token" && typeof ev.content === "string") {
          setMessages((m) => {
            const last = m[m.length - 1];
            if (!last || last.role !== "assistant") return m;
            const updated: Msg = { ...last, content: last.content + ev.content };
            return [...m.slice(0, -1), updated];
          });
        }
      } catch {
        // ignore
      }
    });

    es.addEventListener("error", () => {
      setBusy(false);
      es.close();
    });

    es.addEventListener("close", () => {
      setBusy(false);
    });
  }

  return (
    <View className="flex-1 bg-neutral-950">
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-neutral-800">
        <View>
          <Text className="text-white text-lg font-semibold">Chat</Text>
          <Text className="text-neutral-500 text-xs">
            {me?.organization?.name ?? "no org"} · {me?.user?.email}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => router.push("/documents")}
            className="px-3 py-1 rounded border border-neutral-700 active:bg-neutral-900"
          >
            <Text className="text-neutral-300 text-sm">Docs</Text>
          </Pressable>
          <Pressable
            onPress={async () => {
              await signOut();
              router.replace("/login");
            }}
            className="px-3 py-1 rounded border border-neutral-700 active:bg-neutral-900"
          >
            <Text className="text-neutral-300 text-sm">Sign out</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <View className={item.role === "user" ? "items-end" : "items-start"}>
            <View
              className={
                item.role === "user"
                  ? "bg-blue-600 px-3 py-2 rounded-lg max-w-[80%]"
                  : "bg-neutral-800 px-3 py-2 rounded-lg max-w-[80%]"
              }
            >
              <Text className={item.role === "user" ? "text-white" : "text-neutral-100"}>
                {item.content || (busy && item.role === "assistant" ? "…" : "")}
              </Text>
            </View>
          </View>
        )}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      <View className="flex-row gap-2 p-3 border-t border-neutral-800">
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask Axon anything..."
          placeholderTextColor="#737373"
          className="flex-1 bg-neutral-900 text-white px-4 py-3 rounded-lg border border-neutral-800"
          editable={!busy}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Pressable
          onPress={send}
          disabled={busy || !input.trim()}
          className="bg-white rounded-lg px-4 justify-center disabled:opacity-50"
        >
          {busy ? <ActivityIndicator color="#000" /> : <Text className="text-black font-semibold">Send</Text>}
        </Pressable>
      </View>
    </View>
  );
}
