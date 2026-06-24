import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { UpperInput } from "../components/UpperInput";
import { LinearGradient } from "expo-linear-gradient";
import axios from "axios";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../types";
import { API_URL } from "../constants/api";
import { useTheme } from "../hooks/useTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Chat">;
  route: RouteProp<RootStackParamList, "Chat">;
};

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "¿Cómo inspecciono un extintor PQS?",
  "¿Cada cuánto se hace prueba hidrostática?",
  "¿Cómo solicito vacaciones?",
  "¿Qué dice la NOM-002-STPS?",
];

export default function ChatScreen({ navigation, route }: Props) {
  const T = useTheme();
  const { userEmail, userName } = route.params;
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");

    const newMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await axios.post<{ text: string; error?: string }>(
        `${API_URL}/mobile/ai`,
        { messages: newMessages.slice(-10) }
      );
      if (res.data.error) throw new Error(res.data.error);
      setMessages([...newMessages, { role: "assistant", content: res.data.text }]);
    } catch {
      setMessages([...newMessages, {
        role: "assistant",
        content: "No pude conectarme al asistente. Verifica tu conexión e intenta de nuevo.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const cardBg = T.isDark ? "#1A2740" : "#fff";
  const textC  = T.isDark ? "#E6EDF3" : "#1A2740";
  const subC   = T.isDark ? "#4A6A90" : "#6B84A8";

  return (
    <LinearGradient
      colors={T.isDark ? ["#050C1A", "#0D1B3E"] : ["#F0F4FA", "#E8EFF8"]}
      style={{ flex: 1 }}
    >
      {/* Nav */}
      <LinearGradient colors={["#0D1B3E", "#122B60"]} style={[s.nav, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.navTitle}>MASI-IA</Text>
          <Text style={s.navSub}>Asistente de Seguridad Industrial</Text>
        </View>
        <View style={s.aiDot} />
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Welcome */}
          {messages.length === 0 && (
            <View style={[s.welcomeCard, { backgroundColor: cardBg, borderColor: T.isDark ? "#243556" : "#E2E8F5" }]}>
              <Text style={{ fontSize: 32, marginBottom: 10 }}>🤖</Text>
              <Text style={[s.welcomeTitle, { color: textC }]}>Hola, {userName.split(" ")[0]}</Text>
              <Text style={[s.welcomeSub, { color: subC }]}>
                Soy MASI-IA. Puedo ayudarte con inspecciones, normativas NOM, solicitudes de RH y uso del sistema.
              </Text>
              <View style={s.suggestionsWrap}>
                {SUGGESTIONS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles2.chip, { borderColor: T.isDark ? "#2D4A70" : "#C5D5EA" }]}
                    onPress={() => send(s)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles2.chipText, { color: T.isDark ? "#60A5FA" : "#1D4ED8" }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Messages */}
          {messages.map((msg, idx) => (
            <View
              key={idx}
              style={[
                s.bubble,
                msg.role === "user"
                  ? s.bubbleUser
                  : [s.bubbleAI, { backgroundColor: cardBg, borderColor: T.isDark ? "#243556" : "#E2E8F5" }],
              ]}
            >
              {msg.role === "assistant" && (
                <Text style={[s.bubbleLabel, { color: subC }]}>MASI-IA</Text>
              )}
              <Text style={[
                s.bubbleText,
                { color: msg.role === "user" ? "#fff" : textC },
              ]}>
                {msg.content}
              </Text>
            </View>
          ))}

          {loading && (
            <View style={[s.bubble, s.bubbleAI, { backgroundColor: cardBg, borderColor: T.isDark ? "#243556" : "#E2E8F5" }]}>
              <Text style={[s.bubbleLabel, { color: subC }]}>MASI-IA</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator size="small" color="#3B82F6" />
                <Text style={{ color: subC, fontSize: 13 }}>Pensando...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View style={[s.inputRow, {
          backgroundColor: T.isDark ? "#0D1B3E" : "#fff",
          borderTopColor: T.isDark ? "#1D3050" : "#E2E8F0",
          paddingBottom: Math.max(insets.bottom, 12),
        }]}>
          <UpperInput
            style={[s.input, {
              backgroundColor: T.isDark ? "rgba(255,255,255,0.06)" : "#F0F4FB",
              borderColor: T.isDark ? "rgba(255,255,255,0.09)" : "#D5DCF0",
              color: textC,
            }]}
            value={input}
            onChangeText={setInput}
            placeholder="Escribe tu pregunta..."
            placeholderTextColor={subC}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => send()}
          />
          <TouchableOpacity
            onPress={() => send()}
            disabled={!input.trim() || loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={input.trim() && !loading ? ["#1D4ED8", "#3B82F6"] : ["#374151", "#4B5563"]}
              style={s.sendBtn}
            >
              <Text style={s.sendIcon}>↑</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  nav:          { paddingBottom: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" },
  backBtn:      { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backArrow:    { color: "#fff", fontSize: 22, fontWeight: "700" },
  navTitle:     { color: "#fff", fontSize: 16, fontWeight: "900" },
  navSub:       { color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 1 },
  aiDot:        { width: 10, height: 10, borderRadius: 5, backgroundColor: "#34D399" },
  welcomeCard:  { borderRadius: 18, padding: 24, borderWidth: 1, alignItems: "center", marginBottom: 16 },
  welcomeTitle: { fontSize: 20, fontWeight: "900", marginBottom: 6 },
  welcomeSub:   { fontSize: 13, lineHeight: 19, textAlign: "center", marginBottom: 18 },
  suggestionsWrap: { width: "100%", gap: 8 },
  bubble:       { borderRadius: 16, padding: 12, marginBottom: 10, maxWidth: "90%" },
  bubbleUser:   { backgroundColor: "#1D4ED8", alignSelf: "flex-end" },
  bubbleAI:     { borderWidth: 1, alignSelf: "flex-start" },
  bubbleLabel:  { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  bubbleText:   { fontSize: 14, lineHeight: 20 },
  inputRow:     { flexDirection: "row", alignItems: "flex-end", padding: 12, borderTopWidth: 1, gap: 10 },
  input:        { flex: 1, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
  sendBtn:      { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  sendIcon:     { color: "#fff", fontSize: 20, fontWeight: "900" },
});

const styles2 = StyleSheet.create({
  chip:     { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 12, fontWeight: "600" },
});
