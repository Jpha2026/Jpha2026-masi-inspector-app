import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView,
  Platform, Animated, Dimensions, Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList, Inspector, AppUser } from "../types";
import { API_URL } from "../constants/api";
import { useTheme } from "../hooks/useTheme";

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, "Login"> };

const { width } = Dimensions.get("window");

type Tab = "inspector" | "empleado";

export default function LoginScreen({ navigation }: Props) {
  const T = useTheme();
  const [tab, setTab]                = useState<Tab>("inspector");

  // Inspector tab
  const [query, setQuery]            = useState("");
  const [inspectors, setInspectors]  = useState<Inspector[]>([]);
  const [selected, setSelected]      = useState<Inspector | null>(null);
  const [fetching, setFetching]      = useState(false);

  // Employee tab — OTP flow
  const [email, setEmail]            = useState("");
  const [codeSent, setCodeSent]      = useState(false);
  const [code, setCode]              = useState("");

  const [loading, setLoading]        = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    fetchInspectors();
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 9, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 9, useNativeDriver: true }),
    ]).start();
  }, []);

  const fetchInspectors = async () => {
    setFetching(true);
    try {
      const res = await axios.get<Inspector[]>(`${API_URL}/inspectors`);
      setInspectors(Array.isArray(res.data) ? res.data : []);
    } catch {
      Alert.alert("Sin conexión", "No se pudo obtener la lista de inspectores.", [
        { text: "Reintentar", onPress: fetchInspectors }, { text: "Cancelar" },
      ]);
    } finally { setFetching(false); }
  };

  const safeInspectors = Array.isArray(inspectors) ? inspectors : [];
  const filtered = query.trim()
    ? safeInspectors.filter((i) =>
        i.email.toLowerCase().includes(query.toLowerCase()) ||
        i.name.toLowerCase().includes(query.toLowerCase())
      )
    : safeInspectors;

  const handleInspectorLogin = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await AsyncStorage.setItem("inspector_id", selected.id);
      await AsyncStorage.setItem("inspector_name", selected.name);
      navigation.replace("Home", { inspectorId: selected.id });
    } catch {
      Alert.alert("Error", "No se pudo guardar la sesión.");
    } finally { setLoading(false); }
  };

  const handleSendCode = async () => {
    if (!email.trim()) {
      Alert.alert("Correo requerido", "Ingresa tu correo electrónico.");
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/mobile/send-code`, { email: email.trim() });
      setCodeSent(true);
      setCode("");
    } catch {
      Alert.alert("Error", "No se pudo enviar el código. Verifica tu correo.");
    } finally { setLoading(false); }
  };

  const handleVerifyCode = async () => {
    if (!code.trim()) {
      Alert.alert("Código requerido", "Ingresa el código que recibiste.");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post<AppUser>(`${API_URL}/mobile/verify-code`, { email: email.trim(), code: code.trim() });
      const user = res.data;
      await AsyncStorage.setItem("masi_user", JSON.stringify(user));
      if (user.inspector_id) {
        await AsyncStorage.setItem("inspector_id", user.inspector_id);
        await AsyncStorage.setItem("inspector_name", user.name);
        navigation.replace("Home", { inspectorId: user.inspector_id });
      } else {
        navigation.replace("EmpleadoHome", { user });
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : "Código incorrecto o expirado.";
      Alert.alert("Acceso denegado", msg);
    } finally { setLoading(false); }
  };

  return (
    <LinearGradient
      colors={T.isDark
        ? ["#050C1A", "#0D1B3E", "#122B60", "#1a0a1e"]
        : ["#0D1B3E", "#122B60", "#1a3575", "#0a1a40"]}
      locations={[0, 0.35, 0.7, 1]}
      style={{ flex: 1 }}
    >
      <View style={s.orb1} pointerEvents="none" />
      <View style={s.orb2} pointerEvents="none" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <Animated.View style={[s.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }]}>
            <Image
              source={require("../assets/icon.png")}
              style={s.logoImage}
              resizeMode="contain"
            />
            <LinearGradient colors={["rgba(255,255,255,0.12)", "rgba(255,255,255,0.05)"]} style={s.tagPill}>
              <Text style={s.tagText}>Seguridad Industrial · NOM-154-SCFI-2005</Text>
            </LinearGradient>
          </Animated.View>

          {/* Card */}
          <Animated.View style={[s.card, {
            backgroundColor: T.isDark ? "rgba(13,17,23,0.92)" : "rgba(255,255,255,0.96)",
            borderColor: T.isDark ? "rgba(255,255,255,0.07)" : "rgba(18,43,96,0.12)",
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }]}>

            {/* Tab selector */}
            <View style={[s.tabRow, { backgroundColor: T.isDark ? "rgba(255,255,255,0.05)" : "#F0F4FB" }]}>
              <TouchableOpacity
                style={[s.tabBtn, tab === "inspector" && s.tabActive]}
                onPress={() => setTab("inspector")}
              >
                <Text style={[s.tabText, { color: tab === "inspector" ? "#fff" : (T.isDark ? "#5A7A9A" : "#6B84A8") }]}>
                  🔍 Inspector / Técnico
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.tabBtn, tab === "empleado" && s.tabActive]}
                onPress={() => setTab("empleado")}
              >
                <Text style={[s.tabText, { color: tab === "empleado" ? "#fff" : (T.isDark ? "#5A7A9A" : "#6B84A8") }]}>
                  👤 Empleado
                </Text>
              </TouchableOpacity>
            </View>

            {tab === "inspector" ? (
              <>
                <Text style={[s.cardTitle, { color: T.isDark ? "#60A5FA" : "#122B60", marginTop: 18 }]}>
                  Seleccionar inspector
                </Text>
                <View style={[s.searchWrap, {
                  backgroundColor: T.isDark ? "rgba(255,255,255,0.05)" : "#F0F4FB",
                  borderColor: T.isDark ? "rgba(255,255,255,0.09)" : "#D5DCF0",
                }]}>
                  <Text style={s.searchIcon}>🔍</Text>
                  <TextInput
                    style={[s.searchInput, { color: T.isDark ? "#E6EDF3" : "#1A2740" }]}
                    value={query}
                    onChangeText={(t) => { setQuery(t); setSelected(null); }}
                    placeholder="Buscar por nombre o correo…"
                    placeholderTextColor={T.isDark ? "#3D4E68" : "#9BACC8"}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <View style={s.list}>
                  {fetching ? (
                    <View style={s.centered}>
                      <ActivityIndicator size="large" color="#3B82F6" />
                      <Text style={[s.fetchingText, { color: T.isDark ? "#3D4E68" : "#9BACC8" }]}>Conectando…</Text>
                    </View>
                  ) : filtered.length === 0 ? (
                    <View style={s.centered}>
                      <Text style={{ fontSize: 34, marginBottom: 8 }}>👤</Text>
                      <Text style={[s.emptyText, { color: T.isDark ? "#3D4E68" : "#9BACC8" }]}>
                        {query ? "Sin resultados" : "Sin inspectores"}
                      </Text>
                    </View>
                  ) : (
                    filtered.map((insp, idx) => {
                      const isSel = selected?.id === insp.id;
                      return (
                        <TouchableOpacity
                          key={insp.id}
                          style={[s.row, {
                            marginTop: idx === 0 ? 0 : 8,
                            borderColor: isSel ? "#3B82F6" : (T.isDark ? "rgba(255,255,255,0.07)" : "#E2E8F5"),
                          }]}
                          onPress={() => setSelected(insp)}
                          activeOpacity={0.75}
                        >
                          {isSel ? (
                            <LinearGradient colors={["#1E3A5F", "#3B82F6"]} style={s.avatar}>
                              <Text style={s.avatarText}>{insp.name.charAt(0).toUpperCase()}</Text>
                            </LinearGradient>
                          ) : (
                            <View style={[s.avatar, { backgroundColor: T.isDark ? "#1A2740" : "#E8EDF8" }]}>
                              <Text style={[s.avatarText, { color: T.isDark ? "#60A5FA" : "#122B60" }]}>
                                {insp.name.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={[s.rowName, {
                              color: isSel ? (T.isDark ? "#93C5FD" : "#1D4ED8") : (T.isDark ? "#E6EDF3" : "#1A2740"),
                            }]}>
                              {insp.name}
                            </Text>
                            <Text style={[s.rowEmail, { color: T.isDark ? "#3D4E68" : "#9BACC8" }]}>{insp.email}</Text>
                          </View>
                          {isSel && (
                            <LinearGradient colors={["#2563EB", "#3B82F6"]} style={s.checkCircle}>
                              <Text style={s.checkText}>✓</Text>
                            </LinearGradient>
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
                {selected ? (
                  <LinearGradient colors={["#CE0D0D", "#EF4444"]} style={s.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <TouchableOpacity style={s.btnInner} onPress={handleInspectorLogin} disabled={loading} activeOpacity={0.85}>
                      {loading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={s.btnText}>Ingresar como {selected.name.split(" ")[0]}</Text>
                      }
                    </TouchableOpacity>
                  </LinearGradient>
                ) : (
                  <View style={[s.btn, { backgroundColor: T.isDark ? "#1E293B" : "#C5D0E8" }]}>
                    <View style={s.btnInner}>
                      <Text style={[s.btnText, { opacity: 0.5 }]}>Selecciona un inspector</Text>
                    </View>
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={[s.cardTitle, { color: T.isDark ? "#60A5FA" : "#122B60", marginTop: 18 }]}>
                  {codeSent ? "Ingresa tu código" : "Acceso por correo"}
                </Text>

                {/* Email input — siempre visible */}
                <View style={[s.inputWrap, {
                  backgroundColor: T.isDark ? "rgba(255,255,255,0.05)" : "#F0F4FB",
                  borderColor: codeSent ? "rgba(16,185,129,0.4)" : (T.isDark ? "rgba(255,255,255,0.09)" : "#D5DCF0"),
                }]}>
                  <Text style={s.inputIcon}>✉️</Text>
                  <TextInput
                    style={[s.searchInput, { color: T.isDark ? "#E6EDF3" : "#1A2740" }]}
                    value={email}
                    onChangeText={(t) => { setEmail(t); setCodeSent(false); setCode(""); }}
                    placeholder="Correo electrónico"
                    placeholderTextColor={T.isDark ? "#3D4E68" : "#9BACC8"}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    editable={!codeSent}
                  />
                  {codeSent && <Text style={{ color: "#10B981", fontSize: 18 }}>✓</Text>}
                </View>

                {codeSent ? (
                  <>
                    <View style={[s.inputWrap, {
                      backgroundColor: T.isDark ? "rgba(255,255,255,0.05)" : "#F0F4FB",
                      borderColor: T.isDark ? "rgba(255,255,255,0.09)" : "#D5DCF0",
                      marginTop: 12,
                    }]}>
                      <Text style={s.inputIcon}>🔑</Text>
                      <TextInput
                        style={[s.searchInput, { color: T.isDark ? "#E6EDF3" : "#1A2740", letterSpacing: 8, fontSize: 22, fontWeight: "800" }]}
                        value={code}
                        onChangeText={setCode}
                        placeholder="000000"
                        placeholderTextColor={T.isDark ? "#3D4E68" : "#9BACC8"}
                        keyboardType="number-pad"
                        maxLength={6}
                        autoFocus
                      />
                    </View>
                    <TouchableOpacity onPress={() => { setCodeSent(false); setCode(""); }} style={{ marginTop: 10, alignSelf: "center" }}>
                      <Text style={{ color: T.isDark ? "#5A7A9A" : "#9BACC8", fontSize: 12 }}>
                        ← Cambiar correo o reenviar código
                      </Text>
                    </TouchableOpacity>
                    <View style={{ height: 16 }} />
                    <LinearGradient colors={["#1D4ED8", "#3B82F6"]} style={s.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <TouchableOpacity style={s.btnInner} onPress={handleVerifyCode} disabled={loading} activeOpacity={0.85}>
                        {loading
                          ? <ActivityIndicator color="#fff" />
                          : <Text style={s.btnText}>Verificar y entrar</Text>
                        }
                      </TouchableOpacity>
                    </LinearGradient>
                  </>
                ) : (
                  <>
                    <View style={{ height: 20 }} />
                    <LinearGradient colors={["#1D4ED8", "#3B82F6"]} style={s.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <TouchableOpacity style={s.btnInner} onPress={handleSendCode} disabled={loading} activeOpacity={0.85}>
                        {loading
                          ? <ActivityIndicator color="#fff" />
                          : <Text style={s.btnText}>Enviar código al correo</Text>
                        }
                      </TouchableOpacity>
                    </LinearGradient>
                  </>
                )}
              </>
            )}
          </Animated.View>

          <Animated.View style={[s.footer, { opacity: fadeAnim }]}>
            <Text style={s.footerLine}>Multiservicios y Artículos de Seguridad Industrial</Text>
            <Text style={s.footerLine}>RFC MAS900706QH1 · Monterrey, N.L.</Text>
            <Text style={[s.footerLine, { marginTop: 6, color: "rgba(255,255,255,0.15)" }]}>v2.1 · {API_URL}</Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  container:       { paddingBottom: 40 },
  orb1:            { position: "absolute", top: -100, left: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: "rgba(59,130,246,0.12)" },
  orb2:            { position: "absolute", bottom: 60, right: -80, width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(206,13,13,0.1)" },
  header:          { alignItems: "center", paddingTop: 44, paddingBottom: 20 },
  logoImage:       { width: 110, height: 110, marginBottom: 12, backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 20, padding: 6 },
  tagPill:         { marginTop: 14, paddingHorizontal: 18, paddingVertical: 7, borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  tagText:         { color: "rgba(255,255,255,0.7)", fontSize: 11, letterSpacing: 0.3 },
  card:            { marginHorizontal: 16, borderRadius: 26, padding: 26, borderWidth: 1, elevation: 24, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
  tabRow:          { flexDirection: "row", borderRadius: 14, padding: 4, gap: 4 },
  tabBtn:          { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: "center" },
  tabActive:       { backgroundColor: "#122B60" },
  tabText:         { fontSize: 12, fontWeight: "700" },
  cardTitle:       { fontSize: 13, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 18 },
  searchWrap:      { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 18 },
  inputWrap:       { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 11 },
  searchIcon:      { fontSize: 16, marginRight: 8 },
  inputIcon:       { fontSize: 16, marginRight: 8 },
  searchInput:     { flex: 1, fontSize: 15 },
  list:            { marginBottom: 22, minHeight: 60 },
  centered:        { paddingVertical: 28, alignItems: "center" },
  fetchingText:    { marginTop: 10, fontSize: 13 },
  emptyText:       { fontSize: 14 },
  row:             { flexDirection: "row", alignItems: "center", borderRadius: 15, padding: 13, borderWidth: 1.5, backgroundColor: "transparent" },
  avatar:          { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", marginRight: 13 },
  avatarText:      { fontWeight: "800", fontSize: 19 },
  rowName:         { fontSize: 15, fontWeight: "700" },
  rowEmail:        { fontSize: 12, marginTop: 2 },
  checkCircle:     { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  checkText:       { color: "#fff", fontSize: 14, fontWeight: "900" },
  btn:             { borderRadius: 17, overflow: "hidden", elevation: 5, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  btnInner:        { paddingVertical: 18, alignItems: "center", justifyContent: "center" },
  btnText:         { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },
  footer:          { alignItems: "center", marginTop: 28, gap: 3 },
  footerLine:      { color: "rgba(255,255,255,0.35)", fontSize: 11 },
});
