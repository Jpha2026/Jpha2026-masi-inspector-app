import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView,
  Platform, Animated, Image,
} from "react-native";
import { UpperInput } from "../components/UpperInput";
import { LinearGradient } from "expo-linear-gradient";
import * as SecureStore from "expo-secure-store";
import axios from "axios";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types";
import { API_URL } from "../constants/api";
import { useTheme } from "../hooks/useTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, "Login"> };

type Tab  = "inspector" | "taller" | "vendedor" | "empleado";
type Step = "main" | "staff" | "cliente";

export default function LoginScreen({ navigation }: Props) {
  const T = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep]              = useState<Step>("main");
  const [tab, setTab]                = useState<Tab>("inspector");

  // Password login (inspector/taller/vendedor)
  const [inspEmail, setInspEmail]    = useState("");
  const [inspPass, setInspPass]      = useState("");
  const [showPass, setShowPass]      = useState(false);

  // Empleado self-password flow
  const [empStep, setEmpStep]        = useState<"email" | "setup" | "login">("email");
  const [empEmail, setEmpEmail]      = useState("");
  const [empPass, setEmpPass]        = useState("");
  const [empShowPass, setEmpShowPass] = useState(false);
  const [empOtp, setEmpOtp]          = useState("");
  const [empNewPass, setEmpNewPass]  = useState("");
  const [empConfPass, setEmpConfPass] = useState("");
  const [empShowNew, setEmpShowNew]  = useState(false);


  const [loading, setLoading]        = useState(false);

  const goBack = () => {
    setStep("main");
    setTab("inspector");
    setInspEmail("");
    setInspPass("");
    setEmpStep("email");
    setEmpEmail("");
    setEmpPass("");
    setEmpOtp("");
    setEmpNewPass("");
    setEmpConfPass("");
  };

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 9, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 9, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleInspectorLogin = async () => {
    if (!inspEmail.trim() || !inspPass.trim()) {
      Alert.alert("Campos requeridos", "Ingresa tu correo y contraseña.");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/mobile/inspector-login`, {
        email: inspEmail.trim().toLowerCase(),
        password: inspPass,
      });
      const data = res.data;
      if (data.token) {
        await SecureStore.setItemAsync("masi_token", data.token);
        axios.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
      }
      await SecureStore.setItemAsync("masi_user", JSON.stringify(data));
      if (data.role === "cliente") {
        navigation.replace("ClienteHome", { user: data });
      } else if (data.role === "vendedor") {
        navigation.replace("VendedorHome", { user: data });
      } else if (data.role === "taller" || data.role === "ventas") {
        navigation.replace("Taller", { inspectorId: data.inspector_id ?? data.id, userName: data.name });
      } else {
        if (data.inspector_id != null) {
          await SecureStore.setItemAsync("inspector_id", data.inspector_id);
        }
        await SecureStore.setItemAsync("inspector_name", data.name);
        navigation.replace("Home", { inspectorId: data.inspector_id ?? data.id });
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : "Correo o contraseña incorrectos.";
      Alert.alert("Acceso denegado", msg);
    } finally { setLoading(false); }
  };

  const handleEmployeeInit = async () => {
    if (!empEmail.trim()) {
      Alert.alert("Correo requerido", "Ingresa tu correo electrónico.");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/mobile/employee-init`, { email: empEmail.trim().toLowerCase() });
      const status = res.data?.status;
      if (status === "needs_setup") {
        setEmpStep("setup");
      } else if (status === "has_password") {
        setEmpStep("login");
      } else {
        Alert.alert("No encontrado", "No se encontró una cuenta de empleado con ese correo. Contacta a RH.");
      }
    } catch {
      Alert.alert("Error", "No se pudo verificar el correo. Intenta de nuevo.");
    } finally { setLoading(false); }
  };

  const handleEmployeeSetup = async () => {
    if (!empOtp.trim() || !empNewPass.trim()) {
      Alert.alert("Campos requeridos", "Ingresa el código y tu nueva contraseña.");
      return;
    }
    if (empNewPass !== empConfPass) {
      Alert.alert("Contraseñas no coinciden", "Las contraseñas ingresadas no son iguales.");
      return;
    }
    if (empNewPass.length < 6) {
      Alert.alert("Contraseña muy corta", "Debe tener al menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/mobile/employee-setup`, {
        email: empEmail.trim().toLowerCase(),
        otp: empOtp.trim(),
        password: empNewPass,
      });
      const data = res.data;
      if (data.token) {
        await SecureStore.setItemAsync("masi_token", data.token);
        axios.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
      }
      await SecureStore.setItemAsync("masi_user", JSON.stringify(data));
      navigation.replace("EmpleadoHome", { user: data });
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : "Código incorrecto o expirado.";
      Alert.alert("Error", msg);
    } finally { setLoading(false); }
  };

  const handleEmployeeLogin = async () => {
    if (!empEmail.trim() || !empPass.trim()) {
      Alert.alert("Campos requeridos", "Ingresa tu correo y contraseña.");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/mobile/inspector-login`, {
        email: empEmail.trim().toLowerCase(),
        password: empPass,
      });
      const data = res.data;
      if (data.token) {
        await SecureStore.setItemAsync("masi_token", data.token);
        axios.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
      }
      await SecureStore.setItemAsync("masi_user", JSON.stringify(data));
      navigation.replace("EmpleadoHome", { user: data });
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : "Correo o contraseña incorrectos.";
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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <Animated.View style={[s.header, { paddingTop: insets.top + 16, opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }]}>
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

            {/* ── Paso 1: selección de tipo ── */}
            {step === "main" ? (
              <>
                <Text style={{ color: T.isDark ? "#8B949E" : "#5A6E8C", fontSize: 12, fontWeight: "700", textAlign: "center", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 20 }}>
                  ¿Cómo deseas ingresar?
                </Text>

                <TouchableOpacity onPress={() => setStep("staff")} activeOpacity={0.85}
                  style={{ backgroundColor: "#0D1B3E", borderRadius: 18, padding: 22, marginBottom: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(100,140,220,0.25)" }}
                >
                  <Text style={{ fontSize: 36, marginBottom: 6 }}>🛡️</Text>
                  <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: 2 }}>MASI</Text>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 5 }}>Inspector · Taller · Vendedor · Empleado</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setStep("cliente")} activeOpacity={0.85}
                  style={{ backgroundColor: "#064E3B", borderRadius: 18, padding: 22, alignItems: "center", borderWidth: 1, borderColor: "rgba(16,185,129,0.25)" }}
                >
                  <Text style={{ fontSize: 36, marginBottom: 6 }}>🏢</Text>
                  <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: 2 }}>Portal Cliente</Text>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 5 }}>Acceso exclusivo para clientes MASI</Text>
                </TouchableOpacity>
              </>

            ) : step === "staff" ? (
              <>
                {/* Back + 4 tabs */}
                <TouchableOpacity onPress={goBack} style={{ marginBottom: 14 }}>
                  <Text style={{ color: T.isDark ? "#5A7A9A" : "#9BACC8", fontSize: 13, fontWeight: "600" }}>← Regresar</Text>
                </TouchableOpacity>

                <View style={[s.tabRow, { backgroundColor: T.isDark ? "rgba(255,255,255,0.05)" : "#F0F4FB", flexDirection: "row" }]}>
                  {([
                    { key: "inspector", icon: "🔍", label: "Inspector", bg: "#122B60" },
                    { key: "taller",    icon: "🔧", label: "Taller",    bg: "#D97706" },
                    { key: "vendedor",  icon: "💼", label: "Vendedor",  bg: "#1D4ED8" },
                    { key: "empleado",  icon: "👤", label: "Empleado",  bg: "#122B60" },
                  ] as { key: Tab; icon: string; label: string; bg: string }[]).map((t) => (
                    <TouchableOpacity key={t.key}
                      style={[s.tabBtn, { flex: 1 }, tab === t.key && { backgroundColor: t.bg }]}
                      onPress={() => { setTab(t.key); setInspEmail(""); setInspPass(""); setEmpStep("email"); setEmpEmail(""); setEmpPass(""); setEmpOtp(""); setEmpNewPass(""); setEmpConfPass(""); }}
                    >
                      <Text style={[s.tabText, { color: tab === t.key ? "#fff" : (T.isDark ? "#5A7A9A" : "#6B84A8") }]}>
                        {t.icon}{"\n"}{t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {(tab === "inspector" || tab === "taller" || tab === "vendedor") ? (
                  <>
                    <Text style={[s.cardTitle, {
                      color: tab === "vendedor" ? "#3B82F6" : tab === "taller" ? "#D97706" : (T.isDark ? "#60A5FA" : "#122B60"),
                      marginTop: 18,
                    }]}>
                      {tab === "vendedor" ? "Acceso Vendedor" : tab === "taller" ? "Acceso Taller" : "Acceso Inspector"}
                    </Text>

                {/* Email */}
                <View style={[s.inputWrap, {
                  backgroundColor: T.isDark ? "rgba(255,255,255,0.05)" : "#F0F4FB",
                  borderColor: T.isDark ? "rgba(255,255,255,0.09)" : "#D5DCF0",
                  marginBottom: 12,
                }]}>
                  <Text style={s.inputIcon}>✉️</Text>
                  <UpperInput
                    style={[s.searchInput, { color: T.isDark ? "#E6EDF3" : "#1A2740" }]}
                    value={inspEmail}
                    onChangeText={setInspEmail}
                    placeholder="Correo electrónico"
                    placeholderTextColor={T.isDark ? "#3D4E68" : "#9BACC8"}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                  />
                </View>

                {/* Password */}
                <View style={[s.inputWrap, {
                  backgroundColor: T.isDark ? "rgba(255,255,255,0.05)" : "#F0F4FB",
                  borderColor: T.isDark ? "rgba(255,255,255,0.09)" : "#D5DCF0",
                  marginBottom: 24,
                }]}>
                  <Text style={s.inputIcon}>🔒</Text>
                  <UpperInput
                    style={[s.searchInput, { color: T.isDark ? "#E6EDF3" : "#1A2740" }]}
                    value={inspPass}
                    onChangeText={setInspPass}
                    placeholder="Contraseña"
                    placeholderTextColor={T.isDark ? "#3D4E68" : "#9BACC8"}
                    secureTextEntry={!showPass}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={() => setShowPass(v => !v)}>
                    <Text style={{ fontSize: 16, opacity: 0.6 }}>{showPass ? "🙈" : "👁"}</Text>
                  </TouchableOpacity>
                </View>

                <LinearGradient
                  colors={tab === "vendedor" ? ["#1D4ED8", "#3B82F6"] : tab === "taller" ? ["#B45309", "#D97706"] : ["#CE0D0D", "#EF4444"]}
                  style={s.btn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <TouchableOpacity style={s.btnInner} onPress={handleInspectorLogin} disabled={loading} activeOpacity={0.85}>
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.btnText}>Ingresar</Text>
                    }
                  </TouchableOpacity>
                </LinearGradient>
              </>
            ) : (
              /* ── Empleado: email → OTP+setup  ó  email+password ── */
              <>
                {empStep === "email" && (
                  <>
                    <Text style={[s.cardTitle, { color: T.isDark ? "#60A5FA" : "#122B60", marginTop: 18 }]}>
                      Acceso Empleado
                    </Text>
                    <View style={[s.inputWrap, {
                      backgroundColor: T.isDark ? "rgba(255,255,255,0.05)" : "#F0F4FB",
                      borderColor: T.isDark ? "rgba(255,255,255,0.09)" : "#D5DCF0",
                    }]}>
                      <Text style={s.inputIcon}>✉️</Text>
                      <UpperInput
                        style={[s.searchInput, { color: T.isDark ? "#E6EDF3" : "#1A2740" }]}
                        value={empEmail}
                        onChangeText={setEmpEmail}
                        placeholder="Correo electrónico"
                        placeholderTextColor={T.isDark ? "#3D4E68" : "#9BACC8"}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                      />
                    </View>
                    <View style={{ height: 20 }} />
                    <LinearGradient colors={["#122B60", "#1D4ED8"]} style={s.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <TouchableOpacity style={s.btnInner} onPress={handleEmployeeInit} disabled={loading} activeOpacity={0.85}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Continuar</Text>}
                      </TouchableOpacity>
                    </LinearGradient>
                  </>
                )}

                {empStep === "setup" && (
                  <>
                    <Text style={[s.cardTitle, { color: T.isDark ? "#60A5FA" : "#122B60", marginTop: 18 }]}>
                      Primer acceso — Crea tu contraseña
                    </Text>
                    <Text style={{ color: T.isDark ? "#5A7A9A" : "#9BACC8", fontSize: 12, marginBottom: 14 }}>
                      Revisaste tu correo y recibiste un código de 6 dígitos. Úsalo para crear tu contraseña personal.
                    </Text>
                    {/* OTP */}
                    <View style={[s.inputWrap, {
                      backgroundColor: T.isDark ? "rgba(255,255,255,0.05)" : "#F0F4FB",
                      borderColor: T.isDark ? "rgba(255,255,255,0.09)" : "#D5DCF0",
                      marginBottom: 12,
                    }]}>
                      <Text style={s.inputIcon}>🔑</Text>
                      <UpperInput
                        style={[s.searchInput, { color: T.isDark ? "#E6EDF3" : "#1A2740", letterSpacing: 8, fontSize: 22, fontWeight: "800" }]}
                        value={empOtp}
                        onChangeText={setEmpOtp}
                        placeholder="000000"
                        placeholderTextColor={T.isDark ? "#3D4E68" : "#9BACC8"}
                        keyboardType="number-pad"
                        maxLength={6}
                        autoFocus
                      />
                    </View>
                    {/* New password */}
                    <View style={[s.inputWrap, {
                      backgroundColor: T.isDark ? "rgba(255,255,255,0.05)" : "#F0F4FB",
                      borderColor: T.isDark ? "rgba(255,255,255,0.09)" : "#D5DCF0",
                      marginBottom: 12,
                    }]}>
                      <Text style={s.inputIcon}>🔒</Text>
                      <UpperInput
                        style={[s.searchInput, { color: T.isDark ? "#E6EDF3" : "#1A2740" }]}
                        value={empNewPass}
                        onChangeText={setEmpNewPass}
                        placeholder="Nueva contraseña"
                        placeholderTextColor={T.isDark ? "#3D4E68" : "#9BACC8"}
                        secureTextEntry={!empShowNew}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity onPress={() => setEmpShowNew(v => !v)}>
                        <Text style={{ fontSize: 16, opacity: 0.6 }}>{empShowNew ? "🙈" : "👁"}</Text>
                      </TouchableOpacity>
                    </View>
                    {/* Confirm password */}
                    <View style={[s.inputWrap, {
                      backgroundColor: T.isDark ? "rgba(255,255,255,0.05)" : "#F0F4FB",
                      borderColor: T.isDark ? "rgba(255,255,255,0.09)" : "#D5DCF0",
                      marginBottom: 24,
                    }]}>
                      <Text style={s.inputIcon}>🔒</Text>
                      <UpperInput
                        style={[s.searchInput, { color: T.isDark ? "#E6EDF3" : "#1A2740" }]}
                        value={empConfPass}
                        onChangeText={setEmpConfPass}
                        placeholder="Confirmar contraseña"
                        placeholderTextColor={T.isDark ? "#3D4E68" : "#9BACC8"}
                        secureTextEntry={!empShowNew}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                    <TouchableOpacity onPress={() => { setEmpStep("email"); setEmpOtp(""); setEmpNewPass(""); setEmpConfPass(""); }} style={{ marginBottom: 12, alignSelf: "center" }}>
                      <Text style={{ color: T.isDark ? "#5A7A9A" : "#9BACC8", fontSize: 12 }}>← Cambiar correo</Text>
                    </TouchableOpacity>
                    <LinearGradient colors={["#122B60", "#1D4ED8"]} style={s.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <TouchableOpacity style={s.btnInner} onPress={handleEmployeeSetup} disabled={loading} activeOpacity={0.85}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Crear contraseña y entrar</Text>}
                      </TouchableOpacity>
                    </LinearGradient>
                  </>
                )}

                {empStep === "login" && (
                  <>
                    <Text style={[s.cardTitle, { color: T.isDark ? "#60A5FA" : "#122B60", marginTop: 18 }]}>
                      Acceso Empleado
                    </Text>
                    {/* Email locked */}
                    <View style={[s.inputWrap, {
                      backgroundColor: T.isDark ? "rgba(255,255,255,0.03)" : "#F5F7FC",
                      borderColor: "rgba(16,185,129,0.4)",
                      marginBottom: 12,
                    }]}>
                      <Text style={s.inputIcon}>✉️</Text>
                      <Text style={[s.searchInput, { color: T.isDark ? "#94A3B8" : "#6B84A8" }]}>{empEmail.toLowerCase()}</Text>
                      <Text style={{ color: "#10B981", fontSize: 18 }}>✓</Text>
                    </View>
                    {/* Password */}
                    <View style={[s.inputWrap, {
                      backgroundColor: T.isDark ? "rgba(255,255,255,0.05)" : "#F0F4FB",
                      borderColor: T.isDark ? "rgba(255,255,255,0.09)" : "#D5DCF0",
                      marginBottom: 24,
                    }]}>
                      <Text style={s.inputIcon}>🔒</Text>
                      <UpperInput
                        style={[s.searchInput, { color: T.isDark ? "#E6EDF3" : "#1A2740" }]}
                        value={empPass}
                        onChangeText={setEmpPass}
                        placeholder="Contraseña"
                        placeholderTextColor={T.isDark ? "#3D4E68" : "#9BACC8"}
                        secureTextEntry={!empShowPass}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoFocus
                      />
                      <TouchableOpacity onPress={() => setEmpShowPass(v => !v)}>
                        <Text style={{ fontSize: 16, opacity: 0.6 }}>{empShowPass ? "🙈" : "👁"}</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => { setEmpStep("email"); setEmpPass(""); }} style={{ marginBottom: 12, alignSelf: "center" }}>
                      <Text style={{ color: T.isDark ? "#5A7A9A" : "#9BACC8", fontSize: 12 }}>← Cambiar correo</Text>
                    </TouchableOpacity>
                    <LinearGradient colors={["#122B60", "#1D4ED8"]} style={s.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <TouchableOpacity style={s.btnInner} onPress={handleEmployeeLogin} disabled={loading} activeOpacity={0.85}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Ingresar</Text>}
                      </TouchableOpacity>
                    </LinearGradient>
                  </>
                )}

              </>
            )}
          </>

        ) : (
          /* ── Paso 2b: Portal Cliente — contraseña asignada por admin ── */
          <>
            <TouchableOpacity onPress={goBack} style={{ marginBottom: 16 }}>
              <Text style={{ color: T.isDark ? "#5A7A9A" : "#9BACC8", fontSize: 13, fontWeight: "600" }}>← Regresar</Text>
            </TouchableOpacity>

            <Text style={[s.cardTitle, { color: "#065F46", marginTop: 4 }]}>Acceso Cliente</Text>

            {/* Email */}
            <View style={[s.inputWrap, {
              backgroundColor: T.isDark ? "rgba(255,255,255,0.05)" : "#F0FFF4",
              borderColor: "#A7F3D0",
              marginBottom: 12,
            }]}>
              <Text style={s.inputIcon}>✉️</Text>
              <UpperInput
                style={[s.searchInput, { color: T.isDark ? "#E6EDF3" : "#1A2740" }]}
                value={inspEmail}
                onChangeText={setInspEmail}
                placeholder="Correo electrónico"
                placeholderTextColor={T.isDark ? "#3D4E68" : "#9BACC8"}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </View>

            {/* Password */}
            <View style={[s.inputWrap, {
              backgroundColor: T.isDark ? "rgba(255,255,255,0.05)" : "#F0FFF4",
              borderColor: "#A7F3D0",
              marginBottom: 24,
            }]}>
              <Text style={s.inputIcon}>🔒</Text>
              <UpperInput
                style={[s.searchInput, { color: T.isDark ? "#E6EDF3" : "#1A2740" }]}
                value={inspPass}
                onChangeText={setInspPass}
                placeholder="Contraseña"
                placeholderTextColor={T.isDark ? "#3D4E68" : "#9BACC8"}
                secureTextEntry={!showPass}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPass(v => !v)}>
                <Text style={{ fontSize: 16, opacity: 0.6 }}>{showPass ? "🙈" : "👁"}</Text>
              </TouchableOpacity>
            </View>

            <LinearGradient colors={["#065F46", "#059669"]} style={s.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <TouchableOpacity style={s.btnInner} onPress={handleInspectorLogin} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Ingresar</Text>}
              </TouchableOpacity>
            </LinearGradient>
          </>
        )}
          </Animated.View>

          <Animated.View style={[s.footer, { opacity: fadeAnim }]}>
            <Text style={s.footerLine}>Multiservicios y Artículos de Seguridad Industrial</Text>
            <Text style={s.footerLine}>RFC MAS900706QH1 · Monterrey, N.L.</Text>
            <Text style={[s.footerLine, { marginTop: 6, color: "rgba(255,255,255,0.15)" }]}>v1.2.25</Text>
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
  header:          { alignItems: "center", paddingBottom: 12 },
  logoImage:       { width: 72, height: 72, marginBottom: 8, backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 14, padding: 4 },
  tagPill:         { marginTop: 14, paddingHorizontal: 18, paddingVertical: 7, borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  tagText:         { color: "rgba(255,255,255,0.7)", fontSize: 11, letterSpacing: 0.3 },
  card:            { marginHorizontal: 16, borderRadius: 26, padding: 26, borderWidth: 1, elevation: 24, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
  tabRow:          { borderRadius: 14, padding: 4 },
  tabBtn:          { width: 72, paddingVertical: 9, borderRadius: 11, alignItems: "center", marginRight: 4 },
  tabActive:       { backgroundColor: "#122B60" },
  tabText:         { fontSize: 11, fontWeight: "700", textAlign: "center" },
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
