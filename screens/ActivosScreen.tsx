import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Alert, Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import axios from "axios";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../types";
import { API_URL } from "../constants/api";
import { useTheme } from "../hooks/useTheme";

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

export default function ActivosScreen({ navigation, route }: Props) {
  const T = useTheme();
  const { user } = route.params;

  const [assets, setAssets]       = useState<Asset[]>([]);
  const [comments, setComments]   = useState<Comment[]>([]);
  const [maintenance, setMaint]   = useState<Maint[]>([]);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmit]   = useState(false);

  const [commentModal, setCommentModal] = useState<{ visible: boolean; assetId: string; assetName: string }>({ visible: false, assetId: "", assetName: "" });
  const [commentText, setCommentText] = useState("");

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
        <LinearGradient colors={["#0D1B3E", "#122B60"]} style={s.header}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.headerTitle}>🏭 Mis Activos</Text>
              <Text style={s.headerSub}>{user.name} · MASI</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
              <Text style={{ color: "#93C5FD", fontSize: 13, fontWeight: "700" }}>← Atrás</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={{ padding: 16 }}>

          {/* Stats */}
          <View style={s.statsRow}>
            <View style={[s.statCard, { backgroundColor: T.isDark ? "#1E293B" : "#fff", borderColor: T.isDark ? "#2D3E56" : "#E2E8F5" }]}>
              <Text style={s.statNum}>{assets.length}</Text>
              <Text style={[s.statLbl, { color: T.isDark ? "#4A6A90" : "#8A9BBE" }]}>Activos</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: T.isDark ? "#1E293B" : "#fff", borderColor: T.isDark ? "#2D3E56" : "#E2E8F5" }]}>
              <Text style={[s.statNum, { color: "#F59E0B" }]}>{maintenance.length}</Text>
              <Text style={[s.statLbl, { color: T.isDark ? "#4A6A90" : "#8A9BBE" }]}>Mtto. próx.</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: T.isDark ? "#1E293B" : "#fff", borderColor: T.isDark ? "#2D3E56" : "#E2E8F5" }]}>
              <Text style={[s.statNum, { color: "#10B981" }]}>{comments.length}</Text>
              <Text style={[s.statLbl, { color: T.isDark ? "#4A6A90" : "#8A9BBE" }]}>Comentarios</Text>
            </View>
          </View>

          {/* Assets list */}
          {assets.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: T.isDark ? "#1A2740" : "#F4F8FF", borderColor: T.isDark ? "#243556" : "#D5DCF0" }]}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🏭</Text>
              <Text style={{ color: T.isDark ? "#4A6A90" : "#9BACC8", fontSize: 14 }}>Sin activos asignados</Text>
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
                        {a.asset_no} · {a.category}
                        {a.brand ? ` · ${a.brand}` : ""}
                      </Text>
                      {a.location ? (
                        <Text style={[s.assetSub, { color: T.isDark ? "#4A6A90" : "#8A9BBE", marginTop: 2 }]}>📍 {a.location}</Text>
                      ) : null}
                      {a.serial_number ? (
                        <Text style={[s.assetSub, { color: "#475569", fontSize: 11, marginTop: 2 }]}>Serie: {a.serial_number}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={s.commentBtn}
                      onPress={() => {
                        setCommentModal({ visible: true, assetId: a.id, assetName: a.name });
                        setCommentText("");
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>💬 Comentar</Text>
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
                  {m.next_due_date && (
                    <Text style={{ fontSize: 12, color: "#F59E0B", marginTop: 4, fontWeight: "700" }}>Vence: {m.next_due_date}</Text>
                  )}
                </View>
              ))}
            </>
          )}

          {/* Recent comments */}
          {comments.length > 0 && (
            <>
              <Text style={[s.sectionTitle, { color: T.isDark ? "#60A5FA" : "#122B60", marginTop: 8 }]}>💬 Mis comentarios recientes</Text>
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

      {/* Comment Modal */}
      <Modal visible={commentModal.visible} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { backgroundColor: T.isDark ? "#0D1B3E" : "#fff" }]}>
            <Text style={[s.modalTitle, { color: T.isDark ? "#E2E8F0" : "#1A2740" }]}>💬 Comentario</Text>
            <Text style={[s.modalSub, { color: T.isDark ? "#4A6A90" : "#8A9BBE" }]}>{commentModal.assetName}</Text>
            <TextInput
              style={[s.textInput, { backgroundColor: T.isDark ? "#1A2740" : "#F4F8FF", color: T.isDark ? "#E2E8F0" : "#1A2740", borderColor: T.isDark ? "#243556" : "#D5DCF0" }]}
              placeholder="Describe el estado, observación o problema detectado..."
              placeholderTextColor={T.isDark ? "#4A6A90" : "#9BACC8"}
              multiline
              numberOfLines={4}
              value={commentText}
              onChangeText={setCommentText}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: "#1D4ED8", flex: 1 }]}
                onPress={submitComment}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color: "#fff", fontWeight: "700" }}>Guardar</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: T.isDark ? "#1E293B" : "#E2E8F0", flex: 1 }]}
                onPress={() => setCommentModal({ visible: false, assetId: "", assetName: "" })}
              >
                <Text style={{ color: T.isDark ? "#94A3B8" : "#475569", fontWeight: "700" }}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header:       { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow:    { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  headerTitle:  { color: "#fff", fontSize: 22, fontWeight: "900" },
  headerSub:    { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 },
  backBtn:      { padding: 8 },
  statsRow:     { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard:     { flex: 1, borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1 },
  statNum:      { fontSize: 24, fontWeight: "900", color: "#3B82F6" },
  statLbl:      { fontSize: 11, marginTop: 3, fontWeight: "600" },
  sectionTitle: { fontSize: 15, fontWeight: "800", marginBottom: 10 },
  emptyCard:    { borderRadius: 14, padding: 32, alignItems: "center", borderWidth: 1, marginBottom: 16 },
  assetCard:    { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1 },
  assetTop:     { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  assetName:    { fontSize: 14, fontWeight: "700" },
  assetSub:     { fontSize: 12, marginTop: 2 },
  commentBtn:   { backgroundColor: "#1D4ED8", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  mttoCard:     { borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1 },
  commentCard:  { borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalBox:     { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle:   { fontSize: 18, fontWeight: "800", marginBottom: 4 },
  modalSub:     { fontSize: 13, marginBottom: 14 },
  textInput:    { borderRadius: 12, padding: 12, fontSize: 13, borderWidth: 1, textAlignVertical: "top", minHeight: 100 },
  modalBtn:     { borderRadius: 12, padding: 14, alignItems: "center" },
});
