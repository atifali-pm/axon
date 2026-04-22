import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { api } from "@/lib/api";

type Doc = { id: string; title: string; chunkCount: number; createdAt: string };

export default function Documents() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  return (
    <View className="flex-1 bg-neutral-950">
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-neutral-800">
        <View>
          <Text className="text-white text-lg font-semibold">Documents</Text>
          <Text className="text-neutral-500 text-xs">{docs.length} uploaded</Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          className="px-3 py-1 rounded border border-neutral-700 active:bg-neutral-900"
        >
          <Text className="text-neutral-300 text-sm">Back</Text>
        </Pressable>
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
                No documents yet. Upload from the web app at /documents.{"\n"}
                Mobile upload coming in Phase 9 part 2.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="bg-neutral-900 rounded-lg p-4 border border-neutral-800">
              <Text className="text-white font-medium" numberOfLines={1}>
                {item.title}
              </Text>
              <View className="flex-row mt-1 gap-3">
                <Text className="text-neutral-500 text-xs">
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
