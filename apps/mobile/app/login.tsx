import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useAuth } from "@/lib/auth-context";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
      } else {
        await signUp(name.trim(), email.trim(), password);
      }
      router.replace("/chat");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 justify-center p-6 bg-neutral-950">
      <Text className="text-4xl font-bold text-white mb-2">Axon</Text>
      <Text className="text-neutral-400 mb-8">
        {mode === "signin" ? "Sign in to continue" : "Create your account"}
      </Text>

      {mode === "signup" && (
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name"
          placeholderTextColor="#737373"
          className="bg-neutral-900 text-white px-4 py-3 rounded-lg mb-3 border border-neutral-800"
          autoCapitalize="words"
        />
      )}
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor="#737373"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        className="bg-neutral-900 text-white px-4 py-3 rounded-lg mb-3 border border-neutral-800"
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password (min 10 chars)"
        placeholderTextColor="#737373"
        secureTextEntry
        autoCapitalize="none"
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        className="bg-neutral-900 text-white px-4 py-3 rounded-lg mb-4 border border-neutral-800"
      />

      {error && (
        <Text className="text-red-400 text-sm mb-3">{error}</Text>
      )}

      <Pressable
        onPress={onSubmit}
        disabled={busy}
        className="bg-white rounded-lg py-3 active:opacity-80 disabled:opacity-50"
      >
        {busy ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text className="text-black text-center font-semibold">
            {mode === "signin" ? "Sign in" : "Create account"}
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-6"
      >
        <Text className="text-neutral-400 text-center text-sm">
          {mode === "signin"
            ? "Don't have an account? Sign up"
            : "Already have an account? Sign in"}
        </Text>
      </Pressable>
    </View>
  );
}
