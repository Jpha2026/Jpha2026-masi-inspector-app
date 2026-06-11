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

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "VendedorHome">;
  route: RouteProp<RootStackParamList, "VendedorHome">;
};

type CotStats = { total: number; borrador: number; enviada: number; aceptada: number };

export default function VendedorHomeScreen({ navigation, route }: Props) {
  const T = useTheme();
  const { user } = route.params;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [cotStats, setCotStats] = useState<CotStats | null>(null);
  const [loading, setLoading] = useState(true);

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
      // Stats not critical — fail silently
    } finally {
      setLoading(false);
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

  const modules = [
    { icon: "📋", label: "Cotizaciones", color: "#2563EB", onPress: () => navigation.navigate("ClienteCotizaciones", { user }) },
    { icon: "🏪", label: "Punto de Venta", color: "#10B981", onPress: () => navigation.navigate("POS", { user }) },
    { icon: "➕", label: "Nuevo Lead", color: "#7C3AED", onPress: () => navigation.navigate("NuevoLead", { user }) },
    { icon: "📦", label: "Mis Pedidos", color: "#F59E0B", onPress: () => navigation.navigate("MisPedidos", { user }) },
    { icon: "💬", label: "Chat", color: "#EC4899", onPress: () => navigation.navigate("Chat", { userEmail: user.email, userName: user.name }) },
    { icon: "📖", label: "Manual Vendedor", color: "#6B7280", onPress: () => navigation.navigate("Manual", { role: "vendedor", userName: user.name }) },
  ];

  return (
    <LinearGradient colors={bg} locations={[0, 0.4, 1]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

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

        {/* Modules grid */}
        <Animated.View style={[s.grid, { opacity: fadeAnim }]}>
          {modules.map((m) => (
            <TouchableOpacity key={m.label} style={s.tile} onPress={m.onPress} activeOpacity={0.8}>
              <LinearGradient
                colors={[m.color + "33", m.color + "18"]}
                style={s.tileGrad}
              >
                <Text style={s.tileIcon}>{m.icon}</Text>
                <Text style={[s.tileLabel, { color: T.isDark ? "#E2E8F0" : "#1E293B" }]}>{m.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* Quick-create cotización CTA */}
        <Animated.View style={{ opacity: fadeAnim, marginHorizontal: 20, marginBottom: 32 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate("ClienteCotizaciones", { user })}
            activeOpacity={0.85}
          >
            <LinearGradient colors={["#1D4ED8", "#3B82F6"]} style={s.ctaBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={s.ctaText}>+ Nueva Cotización rápida</Text>
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
  container:  { paddingTop: 56, paddingBottom: 40 },
  header:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 20 },
  greeting:   { fontSize: 22, fontWeight: "800", color: "#fff" },
  subtitle:   { fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 },
  logoutBtn:  { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  logoutText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  statsRow:   { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 22, flexWrap: "wrap" },
  statCard:   { flex: 1, minWidth: 70, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12, borderWidth: 1, padding: 12, alignItems: "center" },
  statVal:    { fontSize: 24, fontWeight: "900" },
  statLbl:    { fontSize: 9, color: "rgba(255,255,255,0.5)", marginTop: 3, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.4 },
  grid:       { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 14, gap: 10, marginBottom: 24 },
  tile:       { width: "30%", flexGrow: 1, borderRadius: 16, overflow: "hidden" },
  tileGrad:   { padding: 16, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 16 },
  tileIcon:   { fontSize: 28, marginBottom: 8 },
  tileLabel:  { fontSize: 11, fontWeight: "700", textAlign: "center" },
  ctaBtn:     { borderRadius: 16, paddingVertical: 16, alignItems: "center", elevation: 6, shadowColor: "#1D4ED8", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  ctaText:    { color: "#fff", fontSize: 15, fontWeight: "800" },
});
