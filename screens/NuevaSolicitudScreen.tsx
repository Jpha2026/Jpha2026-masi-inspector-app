import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Image,
} from "react-native";
import { UpperInput } from "../components/UpperInput";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../types";
import { API_URL } from "../constants/api";
import { useTheme } from "../hooks/useTheme";
import DatePickerField from "../components/DatePickerField";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "NuevaSolicitud">;
  route: RouteProp<RootStackParamList, "NuevaSolicitud">;
};

const TIPOS = [
  { key: "vacaciones",       label: "Vacaciones",           icon: "🏖️", desc: "Días de vacaciones correspondientes" },
  { key: "permiso_con_goce", label: "Permiso con goce",     icon: "✅", desc: "Permiso con sueldo completo" },
  { key: "permiso_sin_goce", label: "Permiso sin goce",     icon: "⏸️", desc: "Permiso sin cobrar el día" },
  { key: "llegada_tarde",    label: "Llegada tarde",        icon: "⏰", desc: "Notificación de llegada tarde con evidencia fotográfica" },
  { key: "prestamo",         label: "Préstamo",             icon: "💵", desc: "Solicitud de adelanto o préstamo" },
  { key: "incapacidad",      label: "Incapacidad",          icon: "🏥", desc: "Incapacidad médica IMSS" },
  { key: "otro",             label: "Otro",                 icon: "📋", desc: "Otro tipo de solicitud" },
] as const;

export default function NuevaSolicitudScreen({ navigation, route }: Props) {
  const T = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = route.params;

  const [tipo, setTipo]             = useState<string>("vacaciones");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin]     = useState("");
  const [dias, setDias]             = useState("");
  const [monto, setMonto]           = useState("");
  const [motivo, setMotivo]         = useState("");
  const [fotoUri, setFotoUri]       = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);

  const selectedTipo = TIPOS.find(t => t.key === tipo)!;
  const showMonto    = tipo === "prestamo";
  const showDias     = tipo !== "prestamo" && tipo !== "incapacidad" && tipo !== "llegada_tarde";
  const showFoto     = tipo === "llegada_tarde" || tipo === "incapacidad";

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permiso requerido", "Necesitamos acceso a la cámara para tomar la foto de evidencia.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: false });
    if (!result.canceled && result.assets[0]) setFotoUri(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!fechaInicio) {
      Alert.alert("Fecha requerida", "Indica la fecha de inicio de tu solicitud.");
      return;
    }
    if (!motivo.trim()) {
      Alert.alert("Motivo requerido", "Explica brevemente el motivo de tu solicitud.");
      return;
    }
    if (tipo === "llegada_tarde" && !fotoUri) {
      Alert.alert("Foto requerida", "Para notificar una llegada tarde es necesario adjuntar una foto de evidencia.");
      return;
    }
    setLoading(true);
    try {
      let foto_url: string | null = null;

      // Upload photo if present
      if (fotoUri) {
        const authToken = await SecureStore.getItemAsync("masi_token").catch(() => null);
        const formData = new FormData();
        const filename = fotoUri.split("/").pop() ?? "foto.jpg";
        formData.append("file", { uri: fotoUri, type: "image/jpeg", name: filename } as unknown as Blob);
        formData.append("employee_id", user.employee_id ?? "");
        try {
          const uploadRes = await axios.post<{ url: string }>(`${API_URL}/mobile/upload`, formData, {
            headers: { "Content-Type": "multipart/form-data", ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
          });
          foto_url = uploadRes.data.url;
        } catch { /* upload failure is non-fatal; send without photo */ }
      }

      const res = await axios.post(`${API_URL}/mobile/solicitudes`, {
        employee_id: user.employee_id,
        tipo,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin || null,
        dias: dias ? parseInt(dias) : null,
        monto: monto ? parseFloat(monto) : null,
        motivo: motivo.trim(),
        foto_url,
      });
      const { folio } = res.data as { folio: string };
      Alert.alert(
        "Solicitud enviada ✅",
        `Tu solicitud ${folio} fue enviada y está pendiente de aprobación por RH.`,
        [{ text: "Aceptar", onPress: () => navigation.goBack() }]
      );
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        // Server responded with an error (validation, etc.) — safe to retry
        const msg = err.response.data?.error ?? "No se pudo enviar la solicitud.";
        Alert.alert("Error", msg);
        setLoading(false);
      } else {
        // No response — possible timeout where server already saved
        Alert.alert(
          "⚠️ Posible error de red",
          "La solicitud pudo haberse enviado. Verifica en Mis Solicitudes antes de reintentarlo.",
          [{ text: "Entendido", onPress: () => { setLoading(false); navigation.goBack(); } }]
        );
      }
    }
  };

  const cardBg    = T.isDark ? "#1A2740" : "#fff";
  const cardBdr   = T.isDark ? "#243556" : "#E2E8F5";
  const inputBg   = T.isDark ? "rgba(255,255,255,0.05)" : "#F0F4FB";
  const inputBdr  = T.isDark ? "rgba(255,255,255,0.09)" : "#D5DCF0";
  const textColor = T.isDark ? "#E6EDF3" : "#1A2740";
  const lblColor  = T.isDark ? "#4A6A90" : "#6B84A8";

  return (
    <LinearGradient colors={T.isDark ? ["#050C1A", "#0D1B3E"] as const : ["#F0F4FA", "#E8EFF8"] as const} style={{ flex: 1 }}>
      {/* Navbar */}
      <LinearGradient colors={["#0D1B3E", "#122B60"]} style={[s.nav, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.navTitle}>Nueva Solicitud</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

        {/* Tipo selector */}
        <Text style={[s.sectionLabel, { color: T.isDark ? "#60A5FA" : "#122B60" }]}>Tipo de solicitud</Text>
        <View style={s.tipoGrid}>
          {TIPOS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.tipoCard, {
                backgroundColor: tipo === t.key ? "#122B60" : cardBg,
                borderColor: tipo === t.key ? "#3B82F6" : cardBdr,
              }]}
              onPress={() => setTipo(t.key)}
              activeOpacity={0.75}
            >
              <Text style={s.tipoIcon}>{t.icon}</Text>
              <Text style={[s.tipoLabel, { color: tipo === t.key ? "#fff" : textColor }]} numberOfLines={2}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Info about selected type */}
        <View style={[s.infoBox, { backgroundColor: cardBg, borderColor: cardBdr }]}>
          <Text style={[s.infoText, { color: lblColor }]}>
            {selectedTipo.icon} {selectedTipo.desc}
          </Text>
        </View>

        {/* Fields */}
        <Text style={[s.sectionLabel, { color: T.isDark ? "#60A5FA" : "#122B60", marginTop: 20 }]}>Detalles</Text>

        <DatePickerField
          label="Fecha de inicio *"
          value={fechaInicio}
          onChange={setFechaInicio}
          minimumDate={new Date()}
          textColor={textColor}
          borderColor={inputBdr}
          bgColor={inputBg}
        />

        <DatePickerField
          label="Fecha de fin (opcional)"
          value={fechaFin}
          onChange={setFechaFin}
          minimumDate={fechaInicio ? new Date(fechaInicio + "T12:00:00") : new Date()}
          textColor={textColor}
          borderColor={inputBdr}
          bgColor={inputBg}
          placeholder="Sin fecha de fin"
        />

        {showDias && (
          <>
            <Text style={[s.fieldLabel, { color: lblColor }]}>Número de días</Text>
            <UpperInput
              style={[s.input, { backgroundColor: inputBg, borderColor: inputBdr, color: textColor }]}
              value={dias}
              onChangeText={setDias}
              placeholder="ej. 3"
              placeholderTextColor={T.isDark ? "#3D4E68" : "#9BACC8"}
              keyboardType="numeric"
            />
          </>
        )}

        {showMonto && (
          <>
            <Text style={[s.fieldLabel, { color: lblColor }]}>Monto solicitado ($)</Text>
            <UpperInput
              style={[s.input, { backgroundColor: inputBg, borderColor: inputBdr, color: textColor }]}
              value={monto}
              onChangeText={setMonto}
              placeholder="ej. 5000.00"
              placeholderTextColor={T.isDark ? "#3D4E68" : "#9BACC8"}
              keyboardType="decimal-pad"
            />
          </>
        )}

        <Text style={[s.fieldLabel, { color: lblColor }]}>Motivo / Descripción *</Text>
        <UpperInput
          style={[s.input, s.textArea, { backgroundColor: inputBg, borderColor: inputBdr, color: textColor }]}
          value={motivo}
          onChangeText={v => setMotivo(v.toUpperCase())}
          autoCapitalize="characters"
          placeholder="EXPLICA EL MOTIVO DE TU SOLICITUD…"
          placeholderTextColor={T.isDark ? "#3D4E68" : "#9BACC8"}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {showFoto && (
          <>
            <Text style={[s.fieldLabel, { color: lblColor, marginTop: 14 }]}>
              Foto de evidencia {tipo === "llegada_tarde" ? "*" : "(opcional)"}
            </Text>
            <TouchableOpacity
              style={[s.photoBtn, { backgroundColor: inputBg, borderColor: fotoUri ? "#10B981" : inputBdr }]}
              onPress={pickPhoto}
              activeOpacity={0.75}
            >
              {fotoUri ? (
                <Image source={{ uri: fotoUri }} style={s.photoPreview} resizeMode="cover" />
              ) : (
                <View style={{ alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 28 }}>📷</Text>
                  <Text style={{ color: lblColor, fontSize: 13 }}>Tomar foto de evidencia</Text>
                </View>
              )}
            </TouchableOpacity>
            {fotoUri && (
              <TouchableOpacity onPress={() => setFotoUri(null)} style={{ marginTop: 6, alignSelf: "flex-end" }}>
                <Text style={{ color: "#EF4444", fontSize: 12 }}>✕ Quitar foto</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={{ height: 16 }} />

        <LinearGradient colors={["#CE0D0D", "#EF4444"]} style={s.submitBtn}>
          <TouchableOpacity style={s.submitInner} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.submitText}>Enviar solicitud a RH</Text>
            }
          </TouchableOpacity>
        </LinearGradient>

      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  nav:         { paddingBottom: 16, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn:     { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backArrow:   { color: "#fff", fontSize: 22, fontWeight: "700" },
  navTitle:    { color: "#fff", fontSize: 17, fontWeight: "800" },
  sectionLabel:{ fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 },
  tipoGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  tipoCard:    { width: "30%", flexGrow: 1, borderRadius: 14, padding: 12, alignItems: "center", borderWidth: 1.5, gap: 6 },
  tipoIcon:    { fontSize: 24 },
  tipoLabel:   { fontSize: 11, fontWeight: "700", textAlign: "center", lineHeight: 14 },
  infoBox:     { borderRadius: 10, padding: 12, borderWidth: 1 },
  infoText:    { fontSize: 13, lineHeight: 18 },
  fieldLabel:  { fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 14 },
  input:       { borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  textArea:    { height: 100, paddingTop: 12 },
  photoBtn:    { borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", overflow: "hidden", alignItems: "center", justifyContent: "center", minHeight: 130 },
  photoPreview:{ width: "100%", height: 200, borderRadius: 12 },
  submitBtn:   { borderRadius: 16, overflow: "hidden", elevation: 5, shadowColor: "#CE0D0D", shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  submitInner: { paddingVertical: 18, alignItems: "center" },
  submitText:  { color: "#fff", fontSize: 16, fontWeight: "800" },
});
