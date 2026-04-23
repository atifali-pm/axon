import NetInfo from "@react-native-community/netinfo";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import EventSource from "react-native-sse";
import { useAuth } from "@/lib/auth-context";
import { api, apiUrl, getToken } from "@/lib/api";
import { enqueue as queueSave, peek as queueRead, remove as queueRemove } from "@/lib/offline-queue";
import { VoiceButton } from "@/components/VoiceButton";

type Template = { id: string; name: string; slug: string; description: string | null };

type Msg = {
  id: string; // client-side id, always set
  role: "user" | "assistant";
  content: string;
  queued?: boolean;
  serverId?: string; // populated from SSE user_message / assistant_message frames
  rating?: 1 | -1 | null;
};

export default function Chat() {
  const { me, signOut } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [convId, setConvId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);
  const nextId = useRef(0);

  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );

  useEffect(() => {
    api.agents().then((d) => setTemplates(d.templates ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const connected = !!state.isConnected && state.isInternetReachable !== false;
      setOnline((prev) => {
        if (!prev && connected) void drain();
        return connected;
      });
    });
    NetInfo.fetch().then((s) => setOnline(!!s.isConnected && s.isInternetReachable !== false));
    queueRead().then((q) => setQueuedCount(q.length));
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshQueued = useCallback(async () => {
    const q = await queueRead();
    setQueuedCount(q.length);
  }, []);

  async function stream(
    text: string,
    forConvId: string | null,
    forTemplateId: string | null,
    userMsgClientId: string | null,
    assistantMsgClientId: string,
  ): Promise<void> {
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
      body: JSON.stringify({
        message: text,
        conversationId: forConvId,
        templateId: forTemplateId ?? undefined,
        stream: true,
      }),
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
          const ev = JSON.parse(payload) as {
            type: string;
            content?: string;
            id?: string;
          };
          if (ev.type === "token" && typeof ev.content === "string") {
            setMessages((m) =>
              m.map((x) =>
                x.id === assistantMsgClientId ? { ...x, content: x.content + ev.content } : x,
              ),
            );
          } else if (ev.type === "user_message" && ev.id && userMsgClientId) {
            const sid = ev.id;
            setMessages((m) =>
              m.map((x) => (x.id === userMsgClientId ? { ...x, serverId: sid } : x)),
            );
          } else if (ev.type === "assistant_message" && ev.id) {
            const sid = ev.id;
            setMessages((m) =>
              m.map((x) => (x.id === assistantMsgClientId ? { ...x, serverId: sid } : x)),
            );
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
    const assistantMsg: Msg = {
      id: String(++nextId.current),
      role: "assistant",
      content: "",
    };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 20);

    if (!online) {
      await queueSave({ conversationId: convId, templateId, text });
      await refreshQueued();
      setMessages((m) => m.filter((x) => x.id !== assistantMsg.id));
      setBusy(false);
      return;
    }

    try {
      await stream(text, convId, templateId, userMsg.id, assistantMsg.id);
    } catch {
      await queueSave({ conversationId: convId, templateId, text });
      await refreshQueued();
      setMessages((m) =>
        m
          .map((x) => (x.id === userMsg.id ? { ...x, queued: true } : x))
          .filter((x) => x.id !== assistantMsg.id),
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
        const ph: Msg = {
          id: String(++nextId.current),
          role: "assistant",
          content: "",
        };
        setMessages((m) => [...m, ph]);
        await stream(item.text, item.conversationId, item.templateId, null, ph.id);
        await queueRemove(item.id);
      } catch {
        break;
      }
    }
    await refreshQueued();
  }

  async function rate(msg: Msg, rating: 1 | -1) {
    if (!msg.serverId) return;
    const serverId = msg.serverId;
    setMessages((m) => m.map((x) => (x.id === msg.id ? { ...x, rating } : x)));
    try {
      if (msg.rating === rating) {
        await api.unrateMessage(serverId);
        setMessages((m) => m.map((x) => (x.id === msg.id ? { ...x, rating: null } : x)));
      } else {
        await api.rateMessage(serverId, rating);
      }
    } catch {
      setMessages((m) =>
        m.map((x) => (x.id === msg.id ? { ...x, rating: msg.rating ?? null } : x)),
      );
    }
  }

  return (
    <View className="flex-1 bg-neutral-950">
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-neutral-800">
        <View className="flex-1 mr-2">
          <Text className="text-white text-lg font-semibold">Chat</Text>
          <Text className="text-neutral-500 text-xs" numberOfLines={1}>
            {me?.organization?.name ?? "no org"} · {activeTemplate?.name ?? "Default agent"}
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
              <Text className="text-amber-300 text-xs">{queuedCount} queued</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => setPickerOpen(true)}
            className="px-3 py-1 rounded border border-neutral-700 active:bg-neutral-900"
          >
            <Text className="text-neutral-300 text-sm">Agent</Text>
          </Pressable>
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
            <Text className="text-neutral-300 text-sm">Out</Text>
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
            {item.role === "assistant" && item.serverId && item.content && (
              <View className="flex-row gap-2 mt-1">
                <Pressable
                  onPress={() => void rate(item, 1)}
                  className={
                    item.rating === 1
                      ? "px-2 py-0.5 rounded border border-emerald-700 bg-emerald-900/40"
                      : "px-2 py-0.5 rounded border border-neutral-700 active:bg-neutral-900"
                  }
                >
                  <Text className={item.rating === 1 ? "text-emerald-300" : "text-neutral-400"}>👍</Text>
                </Pressable>
                <Pressable
                  onPress={() => void rate(item, -1)}
                  className={
                    item.rating === -1
                      ? "px-2 py-0.5 rounded border border-red-800 bg-red-900/40"
                      : "px-2 py-0.5 rounded border border-neutral-700 active:bg-neutral-900"
                  }
                >
                  <Text className={item.rating === -1 ? "text-red-300" : "text-neutral-400"}>👎</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      <View className="flex-row gap-2 p-3 border-t border-neutral-800">
        <VoiceButton
          onTranscribed={(text) => setInput((prev) => (prev ? `${prev.trimEnd()} ${text}` : text))}
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

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/70 justify-center p-6"
          onPress={() => setPickerOpen(false)}
        >
          <View className="bg-neutral-950 border border-neutral-800 rounded-lg p-4">
            <Text className="text-white text-lg font-semibold mb-3">Pick an agent</Text>
            <Pressable
              onPress={() => {
                setTemplateId(null);
                setMessages([]);
                setConvId(null);
                setPickerOpen(false);
              }}
              className={
                templateId === null
                  ? "p-3 rounded border border-emerald-700 bg-emerald-900/30 mb-2"
                  : "p-3 rounded border border-neutral-800 mb-2 active:bg-neutral-900"
              }
            >
              <Text className="text-white font-medium">Default agent</Text>
              <Text className="text-neutral-500 text-xs">Built-in system prompt + all tools</Text>
            </Pressable>
            {templates.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => {
                  setTemplateId(t.id);
                  setMessages([]);
                  setConvId(null);
                  setPickerOpen(false);
                }}
                className={
                  templateId === t.id
                    ? "p-3 rounded border border-emerald-700 bg-emerald-900/30 mb-2"
                    : "p-3 rounded border border-neutral-800 mb-2 active:bg-neutral-900"
                }
              >
                <Text className="text-white font-medium">{t.name}</Text>
                {t.description && (
                  <Text className="text-neutral-500 text-xs" numberOfLines={2}>
                    {t.description}
                  </Text>
                )}
              </Pressable>
            ))}
            {templates.length === 0 && (
              <Text className="text-neutral-500 text-xs text-center py-4">
                No templates yet. Create one from the web app at /agents.
              </Text>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
