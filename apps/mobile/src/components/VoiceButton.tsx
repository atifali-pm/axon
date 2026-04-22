/**
 * Hold-to-record voice input button. Tap-hold to start capture via expo-av,
 * release to stop and transcribe. The parent owns the input string and
 * receives transcribed text via onTranscribed().
 *
 * Works in Expo Go on Android + iOS; uses the HIGH_QUALITY preset which
 * saves as m4a on iOS and 3gp on Android. Groq Whisper accepts both.
 */
import { Audio } from "expo-av";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text } from "react-native";
import { transcribeAudio } from "@/lib/transcribe";

type Props = {
  onTranscribed: (text: string) => void;
};

export function VoiceButton({ onTranscribed }: Props) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  async function start() {
    if (recording || busy) return;
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Mic access denied", "Enable microphone permissions to use voice.");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      recordingRef.current = rec;
      setRecording(true);
    } catch (err) {
      Alert.alert("Mic error", (err as Error).message);
    }
  }

  async function stopAndTranscribe() {
    const rec = recordingRef.current;
    if (!rec) return;
    setRecording(false);
    setBusy(true);
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recordingRef.current = null;
      if (!uri) throw new Error("no audio captured");
      const text = await transcribeAudio(uri);
      if (text) onTranscribed(text);
    } catch (err) {
      Alert.alert("Transcription failed", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable
      onPressIn={start}
      onPressOut={stopAndTranscribe}
      disabled={busy}
      className={
        recording
          ? "bg-red-600 rounded-lg px-3 justify-center"
          : "bg-neutral-800 border border-neutral-700 rounded-lg px-3 justify-center"
      }
    >
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text className={recording ? "text-white text-xl" : "text-neutral-300 text-xl"}>
          {recording ? "●" : "🎙"}
        </Text>
      )}
    </Pressable>
  );
}
