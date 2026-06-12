import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Animated, Alert, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../types";
import { API_URL } from "../constants/api";
import { useTheme } from "../hooks/useTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useJornada } from "../hooks/useJornada";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "VendedorHome">;
  route: RouteProp<RootStackParamList, "VendedorHome">;
};

type CotStats = { total: number; borrador: number; enviada: number; aceptada: number };

export default function VendedorHomeScreen({ navigation, route }: Props) {
  const T = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = route.params;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [cotStats, setCotStats] = useState<CotStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [jornadaLoading, setJornadaLoading] = useState(false);

  const { active: jornada, start: startJornada, end: endJornada, formatElapsed } = useJornada(user.id, null);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await axios.get<CotStats>(`${API_URL}/mobile/cot-stats`, {
        params: { user_id: user.id },
      });
      setCotStats(res.data);
    } catch {
      // Stats not critical
    } finally {
      setLoading(false);
    }
  };

  const handleJornada = async () => {
    if (jornada) {
      Alert.alert("Finalizar jornada", `¿Terminar jornada? (${formatElapsed()})`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Finalizar", style: "destructive", onPress: async () => {
          setJornadaLoading(true);
          try { await endJornada(); } catch { Alert.alert("Error", "No se pudo finalizar la jornada."); }
          finally { setJornadaLoading(false); }
        }},
      ]);
    } else {
      setJornadaLoading(true);
      try {
        await startJornada();
      } catch (e: unknown) {
        const code = (e as { code?: string })?.code;
        if (code === "GPS_PERMISSION_DENIED") Alert.alert("GPS requerido", "Activa el permiso de ubicación para iniciar la jornada.");
        else if (code === "GPS_NOT_AVAILABLE") Alert.alert("GPS no disponible", "Espera unos segundos y vuelve a intentar.");
        else Alert.alert("Error", "No se pudo iniciar la jornada.");
      } finally {
        setJornadaLoading(false);
      }
    }
  };

  const handleLogout = async () => {
    Alert.alert("Cerrar sesión", "¿Seguro que quieres salir?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir", style: "destructive",
        onPress: async () => {
          await AsyncStorage.multiRemove(["masi_user", "inspector_id", "inspector_name"]);
          navigation.replace("Login");
        },
      },
    ]);
  };

  const bg = T.isDark
    ? ["#050C1A", "#0D1B3E", "#122B60"] as const
    : ["#0D1B3E", "#122B60", "#1a3575"] as const;

  return (
    <LinearGradient colors={bg} locations={[0, 0.4, 1]} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[s.container, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[s.header, { opacity: fadeAnim }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>¡Hola, {user.name.split(" ")[0]}! 👋</Text>
            <Text style={s.subtitle}>Módulo de Ventas · MASI®</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={s.logoutBtn}>
            <Text style={s.logoutText}>Salir</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Stats */}
        {loading ? (
          <ActivityIndicator color="#3B82F6" style={{ marginVertical: 20 }} />
        ) : cotStats ? (
          <Animated.View style={[s.statsRow, { opacity: fadeAnim }]}>
            <StatCard label="Total Cots." value={cotStats.total} color="#60A5FA" />
            <StatCard label="Borradores" value={cotStats.borrador} color="#F59E0B" />
            <StatCard label="Enviadas" value={cotStats.enviada} color="#A78BFA" />
            <StatCard label="Aceptadas" value={cotStats.aceptada} color="#34D399" />
          </Animated.View>
        ) : null}

        {/* Jornada card */}
        <Animated.View style={[{ opacity: fadeAnim, marginHorizontal: 20, marginBottom: 14 }]}>
          <TouchableOpacity onPress={handleJornada} disabled={jornadaLoading} activeOpacity={0.85}>
            <LinearGradient
              colors={jornada ? ["#064E3B", "#065F46"] : ["#1E293B", "#334155"]}
              style={s.jornadaCard}
            >
              <Text style={{ fontSize: 28 }}>{jornada ? "🟢" : "🕐"}</Text>
              <View style={{ flex: 1, marginLeft: 14 }}>
                {jornada ? (
                  <>
                    <Text style={s.jornadaTitle}>Jornada activa — {formatElapsed()}</Text>
                    <Text style={s.jornadaSub}>
                      Inicio: {new Date(jornada.start_time).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={s.jornadaTitle}>Sin jornada activa</Text>
                    <Text style={s.jornadaSub}>Toca para iniciar</Text>
                  </>
                )}
              </View>
              {jornadaLoading
                ? <ActivityIndicator color="#fff" />
                : <View style={[s.jornadaBtn, { backgroundColor: jornada ? "#DC2626" : "#22C55E" }]}>
                    <Text style={s.jornadaBtnTxt}>{jornada ? "Finalizar" : "Iniciar"}</Text>
                  </View>
              }
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* 2 main modules */}
        <Animated.View style={[s.grid, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={s.tile}
            onPress={() => navigation.navigate("ClienteCotizaciones", { user })}
            activeOpacity={0.8}
          >
            <LinearGradient colors={["#2563EB33", "#2563EB18"]} style={s.tileGrad}>
              <Text style={s.tileIcon}>📋</Text>
              <Text style={[s.tileLabel, { color: T.isDark ? "#E2E8F0" : "#1E293B" }]}>Cotizaciones</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.tile}
            onPress={() => navigation.navigate("Chat", { userEmail: user.email, userName: user.name })}
            activeOpacity={0.8}
          >
            <LinearGradient colors={["#7C3AED33", "#7C3AED18"]} style={s.tileGrad}>
              <Text style={s.tileIcon}>🤖</Text>
              <Text style={[s.tileLabel, { color: T.isDark ? "#E2E8F0" : "#1E293B" }]}>MASI-IA</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Quick-create cotización CTA */}
        <Animated.View style={{ opacity: fadeAnim, marginHorizontal: 20, marginBottom: 32 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate("ClienteCotizaciones", { user })}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#1D4ED8", "#3B82F6"]}
              style={s.ctaBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={s.ctaText}>+ Nueva Cotización</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[s.statCard, { borderColor: color + "44" }]}>
      <Text style={[s.statVal, { color }]}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container:    { paddingBottom: 40 },
  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 20 },
  greeting:     { fontSize: 22, fontWeight: "800", color: "#fff" },
  subtitle:     { fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 },
  logoutBtn:    { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  logoutText:   { color: "#fff", fontSize: 12, fontWeight: "700" },
  statsRow:     { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 22, flexWrap: "wrap" },
  statCard:     { flex: 1, minWidth: 70, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12, borderWidth: 1, padding: 12, alignItems: "center" },
  statVal:      { fontSize: 24, fontWeight: "900" },
  statLbl:      { fontSize: 9, color: "rgba(255,255,255,0.5)", marginTop: 3, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.4 },
  jornadaCard:  { borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  jornadaTitle: { color: "#fff", fontSize: 14, fontWeight: "800" },
  jornadaSub:   { color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 },
  jornadaBtn:   { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  jornadaBtnTxt:{ color: "#fff", fontSize: 12, fontWeight: "700" },
  grid:         { flexDirection: "row", paddingHorizontal: 14, gap: 10, marginBottom: 16 },
  tile:         { flex: 1, borderRadius: 16, overflow: "hidden" },
  tileGrad:     { padding: 20, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 16 },
  tileIcon:     { fontSize: 32, marginBottom: 10 },
  tileLabel:    { fontSize: 13, fontWeight: "700", textAlign: "center" },
  ctaBtn:       { borderRadius: 16, paddingVertical: 16, alignItems: "center", elevation: 6, shadowColor: "#1D4ED8", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  ctaText:      { color: "#fff", fontSize: 15, fontWeight: "800" },
});
