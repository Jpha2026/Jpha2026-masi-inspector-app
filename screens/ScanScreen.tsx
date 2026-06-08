import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, Camera } from "expo-camera";
import axios from "axios";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList, Equipment } from "../types";
import { API_URL } from "../constants/api";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Scan">;
  route: RouteProp<RootStackParamList, "Scan">;
};

export default function ScanScreen({ navigation, route }: Props) {
  const { inspectorId, rutaId, rutaItemId, expectedQr } = route.params;
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    Camera.requestCameraPermissionsAsync().then(({ status }) => {
      setHasPermission(status === "granted");
    });
  }, []);

  const lookupEquipment = async (qrCode: string) => {
    // If coming from a route, validate the QR matches the expected equipment
    if (expectedQr && qrCode !== expectedQr) {
      Alert.alert(
        "QR incorrecto",
        `Este código no corresponde al equipo asignado en la ruta.\n\nEsperado: ${expectedQr}\nLeído: ${qrCode}`,
        [{ text: "Reintentar", onPress: () => setScanned(false) }]
      );
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get<Equipment>(`${API_URL}/equipment/scan/${encodeURIComponent(qrCode)}`);
      navigation.replace("Inspection", {
        inspectorId,
        equipment: res.data,
        rutaId,
        rutaItemId,
      });
    } catch (e: any) {
      const status = e?.response?.status;
      Alert.alert(
        status === 404 ? "Equipo no encontrado" : "Error",
        status === 404
          ? `No se encontró ningún equipo con el código "${qrCode}".`
          : "No se pudo consultar el equipo. Verifica la conexión.",
        [{ text: "OK", onPress: () => setScanned(false) }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned || loading) return;
    setScanned(true);
    lookupEquipment(data);
  };

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (!code) return;
    lookupEquipment(code);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={BLUE} />
        <Text style={styles.permText}>Solicitando acceso a la cámara...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      {/* Header */}
      <LinearGradient colors={["#050C1A", "#0D1B3E", "#122B60"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Escanear Equipo</Text>
        <View style={{ width: 70 }} />
      </LinearGradient>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={styles.permText}>Buscando equipo...</Text>
        </View>
      ) : !showManual ? (
        <>
          {hasPermission ? (
            <View style={styles.scannerWrapper}>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: [
                    "qr", "ean13", "ean8", "code128", "code39",
                    "code93", "codabar", "itf14", "upc_a", "upc_e",
                    "pdf417", "aztec", "datamatrix",
                  ],
                }}
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              />
              {/* Overlay frame */}
              <View style={styles.overlay}>
                <View style={{ flex: 1 }} />
                <View style={styles.frame} />
                <Text style={styles.overlayText}>📷 QR o código de barras</Text>
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                  {scanned ? (
                    <TouchableOpacity onPress={() => setScanned(false)} style={styles.rescanBtn}>
                      <LinearGradient colors={["#122B60", "#3B82F6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 14, paddingHorizontal: 24, paddingVertical: 13 }}>
                        <Text style={styles.rescanText}>Escanear de nuevo</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.manualToggle} onPress={() => setShowManual(true)}>
                      <Text style={styles.manualToggleText}>⌨ Ingresar código manualmente</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.centered}>
              <Text style={styles.permText}>Sin acceso a la cámara.</Text>
              <Text style={[styles.permText, { marginTop: 8, fontSize: 13 }]}>
                Habilita el permiso de cámara en la configuración del dispositivo.
              </Text>
              <TouchableOpacity style={[styles.manualToggle, { marginTop: 20 }]} onPress={() => setShowManual(true)}>
                <Text style={styles.manualToggleText}>⌨ Ingresar código manualmente</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.manualContainer} keyboardShouldPersistTaps="handled">
            <Text style={styles.manualLabel}>QR, código de barras o ID del equipo</Text>
            <TextInput
              style={styles.manualInput}
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="Ej: EQ-001"
              placeholderTextColor="#8A9BBE"
              autoCapitalize="characters"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.manualSubmit, !manualCode.trim() && styles.btnDisabled]}
              onPress={handleManualSubmit}
              disabled={!manualCode.trim()}
            >
              {manualCode.trim() ? (
                <LinearGradient colors={["#CE0D0D", "#EF4444"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 12, paddingVertical: 16, alignItems: "center" }}>
                  <Text style={styles.manualSubmitText}>Buscar equipo</Text>
                </LinearGradient>
              ) : (
                <Text style={[styles.manualSubmitText, { opacity: 0.5 }]}>Buscar equipo</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={{ alignItems: "center", paddingVertical: 14 }}
              onPress={() => setShowManual(false)}
            >
              <Text style={{ color: BLUE, fontSize: 14, fontWeight: "600" }}>← Usar cámara</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const BLUE = "#122B60";

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F6FB" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: BLUE, paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  backText: { color: "#8AAEE0", fontSize: 14 },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  permText: { color: "#5A6E8C", fontSize: 15, marginTop: 12, textAlign: "center", paddingHorizontal: 24 },
  scannerWrapper: { flex: 1, position: "relative" },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  overlayText: {
    color: "#fff", fontSize: 14, marginTop: 20,
    backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 8,
  },
  rescanBtn: {
    borderRadius: 14, overflow: "hidden",
    elevation: 6, shadowColor: "#122B60", shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  rescanText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  manualToggle: {
    backgroundColor: "rgba(0,0,0,0.55)", paddingVertical: 13, paddingHorizontal: 28,
    borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
  },
  manualToggleText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  manualContainer: { padding: 24, paddingTop: 40 },
  manualLabel: { fontSize: 14, fontWeight: "600", color: BLUE, marginBottom: 10 },
  manualInput: {
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: "#1A2740", borderWidth: 1.5, borderColor: "#D0D9EB", marginBottom: 16,
  },
  manualSubmit: {
    borderRadius: 12, marginBottom: 12, overflow: "hidden",
  },
  manualSubmitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  btnDisabled: { backgroundColor: "#8A9BBE" },
});
