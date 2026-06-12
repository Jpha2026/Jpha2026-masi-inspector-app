import React, { useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated, Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "VendedorHome">;
  route: RouteProp<RootStackParamList, "VendedorHome">;
};

export default function VendedorHomeScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = route.params;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, []);

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

  const MODULES = [
    {
      icon: "📋",
      label: "Ventas en Campo",
      sub: "Cotizaciones y seguimiento",
      colors: ["#1D4ED833", "#2563EB22"] as const,
      border: "#2563EB44",
      onPress: () => navigation.navigate("ClienteCotizaciones", { user }),
    },
    {
      icon: "🏪",
      label: "Punto de Venta",
      sub: "Cobro con escáner de código",
      colors: ["#05966933", "#10B98122"] as const,
      border: "#10B98144",
      onPress: () => navigation.navigate("POS", { user }),
    },
  ];

  return (
    <LinearGradient colors={["#050C1A", "#0D1B3E", "#122B60"]} locations={[0, 0.45, 1]} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[s.container, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[s.header, { opacity: fadeAnim }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>¡Hola, {user.name.split(" ")[0]}!</Text>
            <Text style={s.subtitle}>Módulo de Ventas · MASI®</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={s.logoutBtn}>
            <Text style={s.logoutText}>Salir</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Module tiles */}
        <Animated.View style={[s.grid, { opacity: fadeAnim }]}>
          {MODULES.map((m) => (
            <TouchableOpacity key={m.label} style={s.tile} onPress={m.onPress} activeOpacity={0.8}>
              <LinearGradient colors={m.colors} style={[s.tileInner, { borderColor: m.border }]}>
                <Text style={s.tileIcon}>{m.icon}</Text>
                <Text style={s.tileLabel}>{m.label}</Text>
                <Text style={s.tileSub}>{m.sub}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  container:   { paddingHorizontal: 20, paddingBottom: 60 },
  header:      { flexDirection: "row", alignItems: "center", marginBottom: 40 },
  greeting:    { fontSize: 24, fontWeight: "800", color: "#fff" },
  subtitle:    { fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 },
  logoutBtn:   { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  logoutText:  { color: "#fff", fontSize: 12, fontWeight: "700" },
  grid:        { gap: 14 },
  tile:        { borderRadius: 20, overflow: "hidden" },
  tileInner:   { padding: 28, alignItems: "center", borderWidth: 1, borderRadius: 20 },
  tileIcon:    { fontSize: 48, marginBottom: 14 },
  tileLabel:   { fontSize: 18, fontWeight: "800", color: "#fff", marginBottom: 6 },
  tileSub:     { fontSize: 13, color: "rgba(255,255,255,0.5)", textAlign: "center" },
});
