import NetInfo from "@react-native-community/netinfo";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { enqueue as queueSave, peek as queueRead, remove as queueRemove } from "@/lib/offline-queue";
import { VoiceButton } from "@/components/VoiceButton";

type Msg = { id: string; role: "user" | "assistant"; content: string; queued?: boolean };

export default function Chat() {
  const { me, signOut } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [convId, setConvId] = useState<string | null>(null);
  const listRef = useRef<FlatList<Msg>>(null);
  const nextId = useRef(0);

  // Watch connectivity. When it flips from offline to online, auto-replay.
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const connected = !!state.isConnected && state.isInternetReachable !== false;
      setOnline((prev) => {
        if (!prev && connected) {
          // just came back online — try to drain the queue
          void drain();
        }
        return connected;
      });
    });
    // initial snapshot
    NetInfo.fetch().then((s) => setOnline(!!s.isConnected && s.isInternetReachable !== false));
    // initial queued count from prior sessions
    queueRead().then((q) => setQueuedCount(q.length));
    return () => unsub();
  }, []);

  const refreshQueued = useCallback(async () => {
    const q = await queueRead();
    setQueuedCount(q.length);
  }, []);

  async function stream(text: string, forConvId: string | null): Promise<void> {
    const token = await getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const es = new EventSource(`${apiUrl()}/api/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: text, conversationId: forConvId, stream: true }),
      pollingInterval: 0,
    });

    return new Promise((resolve, reject) => {
      let resolved = false;

      es.addEventListener("message", (event: { data?: string | null }) => {
        const payload = event.data;
        if (!payload || payload === "[DONE]") {
          if (!resolved) {
            resolved = true;
            es.close();
            resolve();
          }
          return;
        }
        try {
          const ev = JSON.parse(payload) as { type: string; content?: string };
          if (ev.type === "token" && typeof ev.content === "string") {
            setMessages((m) => {
              const last = m[m.length - 1];
              if (!last || last.role !== "assistant") return m;
              return [...m.slice(0, -1), { ...last, content: last.content + ev.content }];
            });
          }
        } catch {
          // ignore
        }
      });

      es.addEventListener("error", () => {
        if (!resolved) {
          resolved = true;
          es.close();
          reject(new Error("stream error"));
        }
      });
    });
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);

    const userMsg: Msg = {
      id: String(++nextId.current),
      role: "user",
      content: text,
      queued: !online,
    };
    const assistantMsg: Msg = { id: String(++nextId.current), role: "assistant", content: "" };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 20);

    if (!online) {
      // Save and wait for connectivity; drop the placeholder assistant bubble.
      await queueSave({ conversationId: convId, text });
      await refreshQueued();
      setMessages((m) => m.filter((x) => x.id !== assistantMsg.id));
      setBusy(false);
      return;
    }

    try {
      await stream(text, convId);
    } catch {
      // Network failed mid-send — enqueue for retry.
      await queueSave({ conversationId: convId, text });
      await refreshQueued();
      setMessages((m) =>
        m.map((x) => (x.id === userMsg.id ? { ...x, queued: true } : x)).filter((x) => x.id !== assistantMsg.id),
      );
    } finally {
      setBusy(false);
    }
  }

  async function drain() {
    const items = await queueRead();
    if (!items.length) return;
    for (const item of items) {
      try {
        // Show a placeholder bubble to confirm the replay is happening.
        const ph: Msg = { id: String(++nextId.current), role: "assistant", content: "" };
        setMessages((m) => [...m, ph]);
        await stream(item.text, item.conversationId);
        await queueRemove(item.id);
      } catch {
        // bail on first failure; leave remaining in queue
        break;
      }
    }
    await refreshQueued();
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
        <View className="flex-row items-center gap-2">
          {!online && (
            <View className="px-2 py-1 rounded bg-amber-900/40 border border-amber-800">
              <Text className="text-amber-300 text-xs">offline</Text>
            </View>
          )}
          {queuedCount > 0 && (
            <Pressable
              onPress={() => void drain()}
              className="px-2 py-1 rounded border border-amber-700 active:opacity-80"
            >
              <Text className="text-amber-300 text-xs">{queuedCount} queued · retry</Text>
            </Pressable>
          )}
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
                  ? item.queued
                    ? "bg-amber-900/40 border border-amber-800 px-3 py-2 rounded-lg max-w-[80%]"
                    : "bg-blue-600 px-3 py-2 rounded-lg max-w-[80%]"
                  : "bg-neutral-800 px-3 py-2 rounded-lg max-w-[80%]"
              }
            >
              <Text className={item.role === "user" ? "text-white" : "text-neutral-100"}>
                {item.content || (busy && item.role === "assistant" ? "…" : "")}
              </Text>
              {item.queued && (
                <Text className="text-amber-300 text-xs mt-1">waiting for network</Text>
              )}
            </View>
          </View>
        )}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      <View className="flex-row gap-2 p-3 border-t border-neutral-800">
        <VoiceButton
          onTranscribed={(text) =>
            setInput((prev) => (prev ? `${prev.trimEnd()} ${text}` : text))
          }
        />
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={online ? "Ask Axon anything..." : "Offline — message will send when back online"}
          placeholderTextColor="#737373"
          className="flex-1 bg-neutral-900 text-white px-4 py-3 rounded-lg border border-neutral-800"
          editable={!busy}
          onSubmitEditing={send}
          returnKeyType="send"
          multiline
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
