import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/lib/auth-context";

export default function Index() {
  const { loading, me } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-950">
        <ActivityIndicator color="#f5f5f5" />
      </View>
    );
  }

  if (!me) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/chat" />;
}
