import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { api } from "@/lib/api";

type Doc = { id: string; title: string; chunkCount: number; createdAt: string };

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/html",
];

export default function Documents() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      const r = await api.documents();
      setDocs(r.documents);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function onUpload() {
    if (uploading) return;
    setError(null);
    const picked = await DocumentPicker.getDocumentAsync({
      type: ACCEPTED_TYPES,
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];

    setUploading(true);
    try {
      const resp = await api.uploadDocument({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? null,
      });
      Alert.alert("Uploaded", `${resp.document.title} is being indexed.`);
      // Optimistically insert at top with chunkCount 0 ("indexing...") and reload shortly.
      setDocs((prev) => [
        { id: resp.document.id, title: resp.document.title, chunkCount: 0, createdAt: new Date().toISOString() },
        ...prev,
      ]);
      setTimeout(load, 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <View className="flex-1 bg-neutral-950">
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-neutral-800">
        <View>
          <Text className="text-white text-lg font-semibold">Documents</Text>
          <Text className="text-neutral-500 text-xs">{docs.length} uploaded</Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={onUpload}
            disabled={uploading}
            className="px-3 py-1 rounded bg-white active:opacity-80 disabled:opacity-50"
          >
            {uploading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text className="text-black text-sm font-semibold">Upload</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            className="px-3 py-1 rounded border border-neutral-700 active:bg-neutral-900"
          >
            <Text className="text-neutral-300 text-sm">Back</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color="#f5f5f5" />
        </View>
      ) : (
        <FlatList
          data={docs}
          keyExtractor={(d) => d.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor="#f5f5f5"
            />
          }
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={
            <View className="py-16 items-center">
              <Text className="text-neutral-500 text-sm text-center">
                No documents yet. Tap Upload to add a PDF, DOCX, TXT, MD, or HTML file.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="bg-neutral-900 rounded-lg p-4 border border-neutral-800">
              <Text className="text-white font-medium" numberOfLines={1}>
                {item.title}
              </Text>
              <View className="flex-row mt-1 gap-3">
                <Text className={item.chunkCount === 0 ? "text-amber-400 text-xs" : "text-neutral-500 text-xs"}>
                  {item.chunkCount === 0 ? "indexing…" : `${item.chunkCount} chunk${item.chunkCount === 1 ? "" : "s"}`}
                </Text>
                <Text className="text-neutral-600 text-xs">
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      {error && (
        <View className="mx-4 mb-4 rounded border border-red-800 bg-red-900/30 p-3">
          <Text className="text-red-300 text-sm">{error}</Text>
        </View>
      )}
    </View>
  );
}
