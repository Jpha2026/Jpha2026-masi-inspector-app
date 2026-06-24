import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Alert, Modal,
  KeyboardAvoidingView, Platform, Image,
} from "react-native";
import { UpperInput } from "../components/UpperInput";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import axios from "axios";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../types";
import { API_URL } from "../constants/api";
import { useTheme } from "../hooks/useTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Asset = {
  id: string; asset_no: string; name: string; category: string; brand: string;
  model: string; serial_number: string; location: string; assigned_to: string;
  status: string; notes: string;
};
type Comment = { id: string; asset_id: string; comment: string; reported_by: string; created_at: string; activo: string };
type Maint = { id: string; folio: string; type: string; status: string; description: string; scheduled_date: string; next_due_date: string; activo: string };

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Activos">;
  route: RouteProp<RootStackParamList, "Activos">;
};

const CATEGORIAS = ["Computadora", "Vehículo", "Herramienta", "Taller", "Mobiliario", "Equipo de seguridad", "Otro"];

export default function ActivosScreen({ navigation, route }: Props) {
  const T = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = route.params;

  const [assets, setAssets]       = useState<Asset[]>([]);
  const [comments, setComments]   = useState<Comment[]>([]);
  const [maintenance, setMaint]   = useState<Maint[]>([]);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmit]   = useState(false);

  // Comment modal
  const [commentModal, setCommentModal] = useState<{ visible: boolean; assetId: string; assetName: string }>({ visible: false, assetId: "", assetName: "" });
  const [commentText, setCommentText] = useState("");

  // Register modal
  const [showRegister, setShowRegister] = useState(false);
  const [regName, setRegName]         = useState("");
  const [regCategory, setRegCategory] = useState(CATEGORIAS[0]);
  const [regBrand, setRegBrand]       = useState("");
  const [regModel, setRegModel]       = useState("");
  const [regSerial, setRegSerial]     = useState("");
  const [regLocation, setRegLocation] = useState("");
  const [regNotes, setRegNotes]       = useState("");
  const [photos, setPhotos]           = useState<string[]>([]);
  const [uploading, setUploading]     = useState(false);

  const bg = T.isDark
    ? ["#050C1A", "#0D1B3E", "#0f1e3a"] as const
    : ["#F0F4FA", "#E8EFF8", "#F0F4FA"] as const;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await axios.get(`${API_URL}/mobile/activos-empleado?employee_name=${encodeURIComponent(user.name)}`);
      setAssets(res.data.assets ?? []);
      setComments(res.data.comments ?? []);
      setMaint(res.data.maintenance ?? []);
    } catch {
      Alert.alert("Error", "No se pudieron cargar los activos.");
    } finally {
      setLoading(false);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    setSubmit(true);
    try {
      await axios.post(`${API_URL}/mobile/activos-empleado`, {
        action: "comment",
        asset_id: commentModal.assetId,
        employee_name: user.name,
        comment: commentText.trim(),
      });
      setCommentModal({ visible: false, assetId: "", assetName: "" });
      setCommentText("");
      loadData();
    } catch {
      Alert.alert("Error", "No se pudo guardar el comentario.");
    } finally {
      setSubmit(false);
    }
  };

  const takePhoto = async () => {
    if (photos.length >= 4) { Alert.alert("Máximo 4 fotos"); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permiso de cámara requerido"); return; }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      quality: 0.6,
      base64: false,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setPhotos(prev => [...prev, result.assets[0].uri]);
    }
  };

  const pickPhoto = async () => {
    if (photos.length >= 4) { Alert.alert("Máximo 4 fotos"); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permiso de galería requerido"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.6,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setPhotos(prev => [...prev, result.assets[0].uri]);
    }
  };

  const uploadPhotos = async (): Promise<string[]> => {
    const urls: string[] = [];
    const uploadBase = API_URL.replace("/mobile", "");
    for (const uri of photos) {
      try {
        const fd = new FormData();
        fd.append("file", { uri, name: `activo_${Date.now()}.jpg`, type: "image/jpeg" } as unknown as Blob);
        const r = await axios.post<{ url: string }>(`${uploadBase}/mobile/upload`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        if (r.data?.url) urls.push(r.data.url);
        FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      } catch { /* skip failed photo */ }
    }
    return urls;
  };

  const submitRegister = async () => {
    if (!regName.trim()) { Alert.alert("El nombre del activo es requerido"); return; }
    setUploading(true);
    try {
      let photoUrls: string[] = [];
      if (photos.length > 0) photoUrls = await uploadPhotos();
      await axios.post(`${API_URL}/mobile/activos-empleado`, {
        action: "register",
        employee_name: user.name,
        name: regName.trim(),
        category: regCategory,
        brand: regBrand.trim(),
        model: regModel.trim(),
        serial_number: regSerial.trim(),
        location: regLocation.trim(),
        notes: regNotes.trim(),
        photo_urls: photoUrls,
      });
      Alert.alert("✅ Activo registrado", `"${regName}" fue dado de alta correctamente.`, [
        { text: "OK", onPress: () => { setShowRegister(false); resetRegister(); loadData(); } },
      ]);
    } catch {
      Alert.alert("Error", "No se pudo registrar el activo.");
    } finally {
      setUploading(false); }
  };

  const resetRegister = () => {
    setRegName(""); setRegCategory(CATEGORIAS[0]); setRegBrand("");
    setRegModel(""); setRegSerial(""); setRegLocation(""); setRegNotes(""); setPhotos([]);
  };

  if (loading) {
    return (
      <LinearGradient colors={bg} style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={{ color: "#60A5FA", marginTop: 12 }}>Cargando activos...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={bg} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <LinearGradient colors={["#0D1B3E", "#122B60"]} style={[s.header, { paddingTop: insets.top + 16 }]}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.headerTitle}>🏭 Mis Activos</Text>
              <Text style={s.headerSub}>{user.name} · MASI</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
              <Text style={{ color: "#93C5FD", fontSize: 13, fontWeight: "700" }}>← Atrás</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.registerBtn} onPress={() => { resetRegister(); setShowRegister(true); }}>
            <Text style={s.registerBtnTxt}>＋ Registrar activo</Text>
          </TouchableOpacity>
        </LinearGradient>

        <View style={{ padding: 16 }}>

          {/* Stats */}
          <View style={s.statsRow}>
            {[
              { num: assets.length, lbl: "Activos", color: "#3B82F6" },
              { num: maintenance.length, lbl: "Mtto. próx.", color: "#F59E0B" },
              { num: comments.length, lbl: "Comentarios", color: "#10B981" },
            ].map(({ num, lbl, color }) => (
              <View key={lbl} style={[s.statCard, { backgroundColor: T.isDark ? "#1E293B" : "#fff", borderColor: T.isDark ? "#2D3E56" : "#E2E8F5" }]}>
                <Text style={[s.statNum, { color }]}>{num}</Text>
                <Text style={[s.statLbl, { color: T.isDark ? "#4A6A90" : "#8A9BBE" }]}>{lbl}</Text>
              </View>
            ))}
          </View>

          {/* Assets list */}
          {assets.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: T.isDark ? "#1A2740" : "#F4F8FF", borderColor: T.isDark ? "#243556" : "#D5DCF0" }]}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🏭</Text>
              <Text style={{ color: T.isDark ? "#4A6A90" : "#9BACC8", fontSize: 14 }}>Sin activos asignados</Text>
              <Text style={{ color: T.isDark ? "#4A6A90" : "#9BACC8", fontSize: 12, marginTop: 4, textAlign: "center" }}>
                Usa el botón "Registrar activo" para dar de alta equipos a tu cargo
              </Text>
            </View>
          ) : (
            <>
              <Text style={[s.sectionTitle, { color: T.isDark ? "#60A5FA" : "#122B60" }]}>Activos asignados</Text>
              {assets.map(a => (
                <View key={a.id} style={[s.assetCard, { backgroundColor: T.isDark ? "#1A2740" : "#fff", borderColor: T.isDark ? "#243556" : "#E2E8F5" }]}>
                  <View style={s.assetTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.assetName, { color: T.isDark ? "#E2E8F0" : "#1A2740" }]}>{a.name}</Text>
                      <Text style={[s.assetSub, { color: T.isDark ? "#4A6A90" : "#8A9BBE" }]}>
                        {a.asset_no}{a.category ? ` · ${a.category}` : ""}
                        {a.brand ? ` · ${a.brand}` : ""}
                      </Text>
                      {a.location ? <Text style={[s.assetSub, { color: T.isDark ? "#4A6A90" : "#8A9BBE", marginTop: 2 }]}>📍 {a.location}</Text> : null}
                      {a.serial_number ? <Text style={[s.assetSub, { color: "#475569", fontSize: 11, marginTop: 2 }]}>Serie: {a.serial_number}</Text> : null}
                    </View>
                    <TouchableOpacity
                      style={s.commentBtn}
                      onPress={() => { setCommentModal({ visible: true, assetId: a.id, assetName: a.name }); setCommentText(""); }}
                    >
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>💬</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Upcoming maintenance */}
          {maintenance.length > 0 && (
            <>
              <Text style={[s.sectionTitle, { color: T.isDark ? "#F59E0B" : "#B45309", marginTop: 8 }]}>🛠️ Mantenimientos próximos</Text>
              {maintenance.map(m => (
                <View key={m.id} style={[s.mttoCard, { backgroundColor: T.isDark ? "#1A2010" : "#FFFBEB", borderColor: T.isDark ? "#3D3010" : "#FDE68A" }]}>
                  <Text style={[s.assetName, { color: T.isDark ? "#FDE68A" : "#92400E" }]}>{m.activo}</Text>
                  <Text style={[s.assetSub, { color: T.isDark ? "#9CA3AF" : "#6B7280" }]}>{m.folio} · {m.type} · {m.description}</Text>
                  {m.next_due_date && <Text style={{ fontSize: 12, color: "#F59E0B", marginTop: 4, fontWeight: "700" }}>Vence: {m.next_due_date}</Text>}
                </View>
              ))}
            </>
          )}

          {/* Recent comments */}
          {comments.length > 0 && (
            <>
              <Text style={[s.sectionTitle, { color: T.isDark ? "#60A5FA" : "#122B60", marginTop: 8 }]}>💬 Mis comentarios</Text>
              {comments.slice(0, 10).map(c => (
                <View key={c.id} style={[s.commentCard, { backgroundColor: T.isDark ? "#1A2740" : "#F0F8FF", borderColor: T.isDark ? "#243556" : "#BFDBFE" }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ fontWeight: "700", color: "#60A5FA", fontSize: 12 }}>{c.activo}</Text>
                    <Text style={{ fontSize: 10, color: "#475569" }}>{c.created_at?.slice(0, 16)}</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: T.isDark ? "#CBD5E1" : "#334155" }}>{c.comment}</Text>
                </View>
              ))}
            </>
          )}

        </View>
      </ScrollView>

      {/* ─── Comment Modal ─── */}
      <Modal visible={commentModal.visible} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setCommentModal({ visible: false, assetId: "", assetName: "" })} />
          <View style={[s.modalBox, { backgroundColor: T.isDark ? "#0D1B3E" : "#fff" }]}>
            <Text style={[s.modalTitle, { color: T.isDark ? "#E2E8F0" : "#1A2740" }]}>💬 Comentario</Text>
            <Text style={[s.modalSub, { color: T.isDark ? "#4A6A90" : "#8A9BBE" }]}>{commentModal.assetName}</Text>
            <UpperInput
              style={[s.textInput, { backgroundColor: T.isDark ? "#1A2740" : "#F4F8FF", color: T.isDark ? "#E2E8F0" : "#1A2740", borderColor: T.isDark ? "#243556" : "#D5DCF0" }]}
              placeholder="Describe el estado, observación o problema..."
              placeholderTextColor={T.isDark ? "#4A6A90" : "#9BACC8"}
              multiline numberOfLines={4}
              value={commentText}
              onChangeText={setCommentText}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: "#1D4ED8", flex: 1 }]} onPress={submitComment} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Guardar</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: T.isDark ? "#1E293B" : "#E2E8F0", flex: 1 }]} onPress={() => setCommentModal({ visible: false, assetId: "", assetName: "" })}>
                <Text style={{ color: T.isDark ? "#94A3B8" : "#475569", fontWeight: "700" }}>Cancelar</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: insets.bottom + 8 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Register Modal ─── */}
      <Modal visible={showRegister} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowRegister(false)} />
          <View style={[s.registerModal, { backgroundColor: T.isDark ? "#0D1B3E" : "#fff" }]}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={[s.modalTitle, { color: T.isDark ? "#E2E8F0" : "#1A2740" }]}>🏭 Nuevo Activo</Text>
              <TouchableOpacity onPress={() => setShowRegister(false)} style={s.closeBtn}>
                <Text style={{ color: "#6B84A8", fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Photos */}
              <Text style={s.fieldLbl}>Fotos del activo</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {photos.map((uri, i) => (
                    <View key={i} style={{ position: "relative" }}>
                      <Image source={{ uri }} style={s.photoThumb} />
                      <TouchableOpacity
                        style={s.photoRemove}
                        onPress={() => setPhotos(p => p.filter((_, j) => j !== i))}
                      >
                        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  {photos.length < 4 && (
                    <>
                      <TouchableOpacity style={s.photoAdd} onPress={takePhoto}>
                        <Text style={{ fontSize: 24 }}>📷</Text>
                        <Text style={{ fontSize: 10, color: "#6B84A8", marginTop: 4 }}>Cámara</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.photoAdd} onPress={pickPhoto}>
                        <Text style={{ fontSize: 24 }}>🖼️</Text>
                        <Text style={{ fontSize: 10, color: "#6B84A8", marginTop: 4 }}>Galería</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </ScrollView>

              {/* Name */}
              <Text style={s.fieldLbl}>Nombre del activo *</Text>
              <UpperInput
                style={[s.inp, { color: T.isDark ? "#E2E8F0" : "#1A2740", borderColor: T.isDark ? "#243556" : "#D5DCF0", backgroundColor: T.isDark ? "#1A2740" : "#F4F8FF" }]}
                value={regName} onChangeText={setRegName}
                placeholder="Ej. Laptop Dell Latitude, Camioneta Ram 1500..."
                placeholderTextColor={T.isDark ? "#4A6A90" : "#9BACC8"}
              />

              {/* Category */}
              <Text style={[s.fieldLbl, { marginTop: 12 }]}>Categoría *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {CATEGORIAS.map(c => (
                  <TouchableOpacity key={c}
                    style={[s.chip, { backgroundColor: regCategory === c ? "#122B60" : (T.isDark ? "#1E293B" : "#F0F4FB"), borderColor: regCategory === c ? "#3B82F6" : (T.isDark ? "#2D3E56" : "#D5DCF0") }]}
                    onPress={() => setRegCategory(c)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: regCategory === c ? "#fff" : (T.isDark ? "#4A6A90" : "#4A6A90") }}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Brand + Model */}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLbl}>Marca</Text>
                  <UpperInput
                    style={[s.inp, { color: T.isDark ? "#E2E8F0" : "#1A2740", borderColor: T.isDark ? "#243556" : "#D5DCF0", backgroundColor: T.isDark ? "#1A2740" : "#F4F8FF" }]}
                    value={regBrand} onChangeText={setRegBrand} placeholder="Dell, Toyota, Bosch..."
                    placeholderTextColor={T.isDark ? "#4A6A90" : "#9BACC8"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLbl}>Modelo</Text>
                  <UpperInput
                    style={[s.inp, { color: T.isDark ? "#E2E8F0" : "#1A2740", borderColor: T.isDark ? "#243556" : "#D5DCF0", backgroundColor: T.isDark ? "#1A2740" : "#F4F8FF" }]}
                    value={regModel} onChangeText={setRegModel} placeholder="Latitude E7450..."
                    placeholderTextColor={T.isDark ? "#4A6A90" : "#9BACC8"}
                  />
                </View>
              </View>

              {/* Serial + Location */}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLbl}>Número de serie</Text>
                  <UpperInput
                    style={[s.inp, { color: T.isDark ? "#E2E8F0" : "#1A2740", borderColor: T.isDark ? "#243556" : "#D5DCF0", backgroundColor: T.isDark ? "#1A2740" : "#F4F8FF" }]}
                    value={regSerial} onChangeText={setRegSerial} placeholder="SN-2024-001"
                    placeholderTextColor={T.isDark ? "#4A6A90" : "#9BACC8"} autoCapitalize="characters"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLbl}>Ubicación</Text>
                  <UpperInput
                    style={[s.inp, { color: T.isDark ? "#E2E8F0" : "#1A2740", borderColor: T.isDark ? "#243556" : "#D5DCF0", backgroundColor: T.isDark ? "#1A2740" : "#F4F8FF" }]}
                    value={regLocation} onChangeText={setRegLocation} placeholder="Taller, Oficina, Bodega..."
                    placeholderTextColor={T.isDark ? "#4A6A90" : "#9BACC8"}
                  />
                </View>
              </View>

              {/* Notes */}
              <Text style={[s.fieldLbl, { marginTop: 12 }]}>Observaciones</Text>
              <UpperInput
                style={[s.inp, { color: T.isDark ? "#E2E8F0" : "#1A2740", borderColor: T.isDark ? "#243556" : "#D5DCF0", backgroundColor: T.isDark ? "#1A2740" : "#F4F8FF", minHeight: 70, textAlignVertical: "top" }]}
                value={regNotes} onChangeText={setRegNotes} multiline numberOfLines={3}
                placeholder="Estado actual, accesorios incluidos, observaciones..."
                placeholderTextColor={T.isDark ? "#4A6A90" : "#9BACC8"}
              />

              <View style={{ height: 16 }} />
              <TouchableOpacity
                style={[s.submitBtn, { opacity: uploading ? 0.7 : 1 }]}
                onPress={submitRegister} disabled={uploading}
              >
                {uploading
                  ? <><ActivityIndicator color="#fff" size="small" /><Text style={s.submitTxt}> Guardando...</Text></>
                  : <Text style={s.submitTxt}>Registrar activo</Text>
                }
              </TouchableOpacity>
              <View style={{ height: 24 + insets.bottom }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header:        { paddingBottom: 20, paddingHorizontal: 20 },
  headerRow:     { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 },
  headerTitle:   { color: "#fff", fontSize: 22, fontWeight: "900" },
  headerSub:     { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 },
  backBtn:       { padding: 8 },
  registerBtn:   { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  registerBtnTxt:{ color: "#fff", fontSize: 14, fontWeight: "800" },
  statsRow:      { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard:      { flex: 1, borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1 },
  statNum:       { fontSize: 24, fontWeight: "900" },
  statLbl:       { fontSize: 11, marginTop: 3, fontWeight: "600" },
  sectionTitle:  { fontSize: 15, fontWeight: "800", marginBottom: 10 },
  emptyCard:     { borderRadius: 14, padding: 32, alignItems: "center", borderWidth: 1, marginBottom: 16 },
  assetCard:     { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1 },
  assetTop:      { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  assetName:     { fontSize: 14, fontWeight: "700" },
  assetSub:      { fontSize: 12, marginTop: 2 },
  commentBtn:    { backgroundColor: "#1D4ED8", borderRadius: 10, padding: 10, alignItems: "center", justifyContent: "center" },
  mttoCard:      { borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1 },
  commentCard:   { borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1 },
  // Modals
  modalBox:      { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  registerModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "92%" },
  modalTitle:    { fontSize: 18, fontWeight: "800", marginBottom: 4 },
  modalSub:      { fontSize: 13, marginBottom: 14 },
  textInput:     { borderRadius: 12, padding: 12, fontSize: 13, borderWidth: 1, textAlignVertical: "top", minHeight: 100 },
  modalBtn:      { borderRadius: 12, padding: 14, alignItems: "center" },
  closeBtn:      { width: 34, height: 34, borderRadius: 17, backgroundColor: "#F0F4FB", alignItems: "center", justifyContent: "center" },
  fieldLbl:      { fontSize: 11, fontWeight: "700", color: "#5A6E8C", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  inp:           { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  chip:          { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, marginBottom: 4 },
  photoThumb:    { width: 80, height: 80, borderRadius: 10 },
  photoRemove:   { position: "absolute", top: 2, right: 2, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  photoAdd:      { width: 80, height: 80, borderRadius: 10, backgroundColor: "#F0F4FB", borderWidth: 1.5, borderColor: "#D5DCF0", alignItems: "center", justifyContent: "center", borderStyle: "dashed" },
  submitBtn:     { backgroundColor: "#122B60", borderRadius: 14, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
  submitTxt:     { color: "#fff", fontSize: 15, fontWeight: "800" },
});
