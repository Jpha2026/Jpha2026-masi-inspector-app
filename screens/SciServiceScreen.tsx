import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, Image, Platform, KeyboardAvoidingView,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import axios from "axios";
import { RootStackParamList, Cliente } from "../types";
import { API_URL } from "../constants/api";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "SciService">;
  route: RouteProp<RootStackParamList, "SciService">;
};

type CheckResult = "ok" | "falla" | "na";
type CheckItem = { category: string; item: string; result: CheckResult };
type CheckCategory = { label: string; items: string[]; hasCritical: boolean };

const SYSTEM_TYPES = ["CO2", "PQS", "Agua (Rociadores)", "Espuma (AFFF)", "Agente Limpio (FM-200)", "Agente Limpio (HCFC)", "Otro"];

function ClientSelector({
  clients, value, onChange, onCreated,
}: { clients: Cliente[]; value: string; onChange: (id: string) => void; onCreated: (c: Cliente) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const selected = clients.find(c => c.id === value);
  const filtered = q.trim() ? clients.filter(c => c.name.toLowerCase().includes(q.trim().toLowerCase())) : clients;
  const canCreate = q.trim().length > 1 && !clients.some(c => c.name.toLowerCase() === q.trim().toLowerCase());

  if (selected) {
    return (
      <TouchableOpacity onPress={() => { onChange(""); setQ(""); setOpen(false); }}
        style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#EFF6FF", borderRadius: 10, borderWidth: 1.5, borderColor: "#3B82F6", paddingHorizontal: 14, paddingVertical: 10, marginTop: 6 }}>
        <Text style={{ flex: 1, fontWeight: "700", color: "#1D4ED8", fontSize: 13 }}>{selected.name}</Text>
        <Text style={{ color: "#6B7280", fontSize: 18 }}>✕</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={{ marginTop: 6 }}>
      <TextInput value={q} onChangeText={t => { setQ(t); setOpen(true); }} onFocus={() => setOpen(true)}
        placeholder="Buscar o escribir cliente..." placeholderTextColor="#9BACC8"
        autoCapitalize="characters"
        style={{ backgroundColor: "#F0F4FB", borderRadius: 10, borderWidth: 1.5, borderColor: open ? "#3B82F6" : "#D5DCF0", paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: "#1A2740" }} />
      {open && (
        <View style={{ backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#D5DCF0", marginTop: 4, maxHeight: 200, elevation: 4 }}>
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            <TouchableOpacity onPress={() => { onChange(""); setQ(""); setOpen(false); }}
              style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0F4FB" }}>
              <Text style={{ color: "#6B7280", fontSize: 12, fontStyle: "italic" }}>Sin cliente</Text>
            </TouchableOpacity>
            {filtered.slice(0, 8).map(c => (
              <TouchableOpacity key={c.id} onPress={() => { onChange(c.id); setQ(""); setOpen(false); }}
                style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0F4FB" }}>
                <Text style={{ color: "#1A2740", fontSize: 13, fontWeight: "600" }}>{c.name}</Text>
              </TouchableOpacity>
            ))}
            {canCreate && (
              <TouchableOpacity disabled={busy}
                onPress={async () => {
                  setBusy(true);
                  try {
                    const { data } = await axios.post<{ id: string; name: string }>(`${API_URL}/mobile/clients`, { name: q.trim() });
                    onCreated(data); onChange(data.id); setQ(""); setOpen(false);
                  } catch { Alert.alert("Error", "No se pudo registrar el cliente."); }
                  finally { setBusy(false); }
                }}
                style={{ paddingHorizontal: 14, paddingVertical: 11, backgroundColor: "#EFF6FF", borderTopWidth: 1, borderTopColor: "#DBEAFE" }}>
                <Text style={{ color: "#1D4ED8", fontSize: 12, fontWeight: "700" }}>
                  {busy ? "Registrando..." : `+ Registrar "${q.trim()}"`}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default function SciServiceScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { inspectorId, userName } = route.params;

  // Step: header | checklist | finish
  const [step, setStep] = useState<"header" | "checklist" | "finish">("header");
  const [saving, setSaving] = useState(false);
  const [loadingChecklist, setLoadingChecklist] = useState(false);

  // Header data
  const [clients, setClients] = useState<Cliente[]>([]);
  const [clientId, setClientId] = useState("");
  const [systemType, setSystemType] = useState("CO2");
  const [location, setLocation] = useState("");
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [technician, setTechnician] = useState(userName);

  // Checklist
  const [categories, setCategories] = useState<CheckCategory[]>([]);
  const [checkItems, setCheckItems] = useState<CheckItem[]>([]);

  // Finish
  const [observations, setObservations] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    axios.get<Cliente[]>(`${API_URL}/mobile/clients`).then(r => setClients(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const addClient = (c: Cliente) => setClients(prev => [c, ...prev]);

  const loadChecklist = async () => {
    setLoadingChecklist(true);
    try {
      const r = await axios.get<{ categories: CheckCategory[] }>(`${API_URL}/mobile/checklist?type=sistema_incendio`);
      const cats = r.data.categories ?? [];
      setCategories(cats);
      const items: CheckItem[] = [];
      for (const cat of cats) {
        for (const item of cat.items) {
          items.push({ category: cat.label, item, result: "ok" });
        }
      }
      setCheckItems(items);
      setStep("checklist");
    } catch {
      Alert.alert("Error", "No se pudo cargar la lista de verificación. Revisa tu conexión.");
    } finally {
      setLoadingChecklist(false);
    }
  };

  const setItemResult = (idx: number, result: CheckResult) => {
    setCheckItems(prev => prev.map((it, i) => i === idx ? { ...it, result } : it));
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (cam.status !== "granted") { Alert.alert("Permiso requerido", "Necesitamos acceso a la cámara."); return; }
    }
    Alert.alert("Agregar foto", "¿De dónde?", [
      {
        text: "Cámara", onPress: async () => {
          const r = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75 });
          if (!r.canceled && r.assets[0]) setPhotos(prev => [...prev, r.assets[0].uri]);
        },
      },
      {
        text: "Galería", onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75 });
          if (!r.canceled && r.assets[0]) setPhotos(prev => [...prev, r.assets[0].uri]);
        },
      },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const uploadPhoto = async (uri: string, sciId: string): Promise<void> => {
    const token = await SecureStore.getItemAsync("masi_token").catch(() => null);
    const form = new FormData();
    const filename = uri.split("/").pop() ?? "photo.jpg";
    const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
    // @ts-ignore
    form.append("file", { uri, name: filename, type: `image/${ext === "jpg" ? "jpeg" : ext}` });
    form.append("entity_type", "sci_service");
    form.append("entity_id", sciId);
    await axios.post(`${API_URL}/mobile/upload`, form, {
      headers: { "Content-Type": "multipart/form-data", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      timeout: 30000,
    });
  };

  const computeResult = (): "ok" | "requires_attention" | "critical" => {
    const fails = checkItems.filter(i => i.result === "falla");
    if (fails.length === 0) return "ok";
    const hasCriticalFail = fails.some(i => {
      const cat = categories.find(c => c.label === i.category);
      return cat?.hasCritical ?? false;
    });
    return hasCriticalFail ? "critical" : "requires_attention";
  };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const result = computeResult();
      const { data } = await axios.post<{ ok: boolean; id: string; folio: string }>(`${API_URL}/mobile/sci-service`, {
        client_id: clientId || undefined,
        system_type: systemType,
        location,
        service_date: serviceDate,
        technician,
        result,
        observations,
        checklist: checkItems,
      });
      // Upload photos
      if (photos.length > 0) {
        for (const uri of photos) {
          await uploadPhoto(uri, data.id).catch(() => {});
        }
      }
      Alert.alert(
        "✅ Servicio guardado",
        `Folio: ${data.folio}\nResultado: ${result === "ok" ? "Sin observaciones críticas" : result === "requires_attention" ? "Requiere atención" : "Fuera de servicio"}`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch {
      Alert.alert("Error", "No se pudo guardar el servicio. Verifica tu conexión.");
      setSaving(false);
    }
  };

  const s = styles(insets);

  // ── STEP: HEADER ──────────────────────────────────────────────────────────
  if (step === "header") {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#F4F7FB" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.nav}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.navBack}>
            <Text style={s.navBackTxt}>← Volver</Text>
          </TouchableOpacity>
          <Text style={s.navTitle}>🔥 Servicio SCI</Text>
          <View style={{ width: 70 }} />
        </View>

        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            <Text style={s.cardTitle}>Datos del servicio</Text>

            <Text style={s.label}>Cliente</Text>
            <ClientSelector clients={clients} value={clientId} onChange={setClientId} onCreated={addClient} />

            <Text style={[s.label, { marginTop: 14 }]}>Tipo de sistema</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {SYSTEM_TYPES.map(t => (
                  <TouchableOpacity key={t} onPress={() => setSystemType(t)}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: systemType === t ? "#122B60" : "#EEF2FB", borderWidth: 1.5, borderColor: systemType === t ? "#122B60" : "#D5DCF0" }}>
                    <Text style={{ color: systemType === t ? "#fff" : "#374151", fontSize: 12, fontWeight: "600" }}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={[s.label, { marginTop: 14 }]}>Ubicación / Área protegida</Text>
            <TextInput value={location} onChangeText={setLocation} placeholder="Ej: Sala de servidores, cuarto eléctrico..." placeholderTextColor="#9BACC8"
              style={s.input} />

            <Text style={[s.label, { marginTop: 14 }]}>Fecha de servicio</Text>
            <TextInput value={serviceDate} onChangeText={setServiceDate} placeholder="AAAA-MM-DD" placeholderTextColor="#9BACC8"
              style={s.input} keyboardType="numbers-and-punctuation" />

            <Text style={[s.label, { marginTop: 14 }]}>Técnico</Text>
            <TextInput value={technician} onChangeText={setTechnician} placeholder="Nombre del técnico" placeholderTextColor="#9BACC8"
              style={s.input} />

            <TouchableOpacity
              onPress={loadChecklist}
              disabled={loadingChecklist}
              style={[s.btnPrimary, { marginTop: 20 }]}>
              {loadingChecklist
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnPrimaryTxt}>Continuar → Lista de verificación</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── STEP: CHECKLIST ───────────────────────────────────────────────────────
  if (step === "checklist") {
    const okCount   = checkItems.filter(i => i.result === "ok").length;
    const failCount = checkItems.filter(i => i.result === "falla").length;

    return (
      <View style={{ flex: 1, backgroundColor: "#F4F7FB" }}>
        <View style={s.nav}>
          <TouchableOpacity onPress={() => setStep("header")} style={s.navBack}>
            <Text style={s.navBackTxt}>← Datos</Text>
          </TouchableOpacity>
          <Text style={s.navTitle}>Lista de verificación</Text>
          <View style={{ width: 70 }} />
        </View>

        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E8EDF5" }}>
          <View style={{ flex: 1, backgroundColor: "#D1FAE5", borderRadius: 8, paddingVertical: 6, alignItems: "center" }}>
            <Text style={{ fontSize: 16, fontWeight: "900", color: "#065F46" }}>{okCount}</Text>
            <Text style={{ fontSize: 10, color: "#065F46" }}>OK</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "#FEE2E2", borderRadius: 8, paddingVertical: 6, alignItems: "center" }}>
            <Text style={{ fontSize: 16, fontWeight: "900", color: "#991B1B" }}>{failCount}</Text>
            <Text style={{ fontSize: 10, color: "#991B1B" }}>Fallas</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "#F3F4F6", borderRadius: 8, paddingVertical: 6, alignItems: "center" }}>
            <Text style={{ fontSize: 16, fontWeight: "900", color: "#374151" }}>{checkItems.length - okCount - failCount}</Text>
            <Text style={{ fontSize: 10, color: "#374151" }}>N/A</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 100 }}>
          {categories.map(cat => {
            const catItems = checkItems.filter(i => i.category === cat.label);
            return (
              <View key={cat.label} style={{ backgroundColor: "#fff", borderRadius: 12, marginBottom: 12, overflow: "hidden", elevation: 1 }}>
                <View style={{ backgroundColor: "#122B60", paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13, flex: 1 }}>{cat.label}</Text>
                  {cat.hasCritical && <Text style={{ fontSize: 9, color: "#FCA5A5", fontWeight: "700" }}>CRÍTICO</Text>}
                </View>
                {catItems.map((it, localIdx) => {
                  const globalIdx = checkItems.findIndex(x => x.category === it.category && x.item === it.item && checkItems.indexOf(x) >= 0);
                  const actualIdx = checkItems.indexOf(it);
                  return (
                    <View key={it.item} style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0F4FB" }}>
                      <Text style={{ fontSize: 12, color: "#1A2740", marginBottom: 8, lineHeight: 17 }}>{it.item}</Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {(["ok", "falla", "na"] as CheckResult[]).map(res => (
                          <TouchableOpacity key={res} onPress={() => setItemResult(actualIdx, res)}
                            style={{
                              flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: "center",
                              backgroundColor: it.result === res
                                ? res === "ok" ? "#D1FAE5" : res === "falla" ? "#FEE2E2" : "#F3F4F6"
                                : "#F9FAFB",
                              borderWidth: 1.5,
                              borderColor: it.result === res
                                ? res === "ok" ? "#10B981" : res === "falla" ? "#EF4444" : "#9CA3AF"
                                : "#E5E7EB",
                            }}>
                            <Text style={{
                              fontSize: 11, fontWeight: "700",
                              color: it.result === res
                                ? res === "ok" ? "#065F46" : res === "falla" ? "#991B1B" : "#374151"
                                : "#9CA3AF",
                            }}>
                              {res === "ok" ? "✓ OK" : res === "falla" ? "✗ Falla" : "— N/A"}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>

        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: insets.bottom + 12, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E8EDF5" }}>
          <TouchableOpacity onPress={() => setStep("finish")} style={s.btnPrimary}>
            <Text style={s.btnPrimaryTxt}>Continuar → Fotos y observaciones</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── STEP: FINISH ──────────────────────────────────────────────────────────
  const failCount = checkItems.filter(i => i.result === "falla").length;
  const result = computeResult();

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#F4F7FB" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.nav}>
        <TouchableOpacity onPress={() => setStep("checklist")} style={s.navBack}>
          <Text style={s.navBackTxt}>← Checklist</Text>
        </TouchableOpacity>
        <Text style={s.navTitle}>Finalizar</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={[s.card, { backgroundColor: result === "ok" ? "#D1FAE5" : result === "critical" ? "#FEE2E2" : "#FEF3C7", borderWidth: 1.5, borderColor: result === "ok" ? "#10B981" : result === "critical" ? "#EF4444" : "#F59E0B" }]}>
          <Text style={{ fontSize: 18, fontWeight: "900", color: result === "ok" ? "#065F46" : result === "critical" ? "#991B1B" : "#92400E", textAlign: "center" }}>
            {result === "ok" ? "✓ Sin fallas" : result === "critical" ? "✗ FUERA DE SERVICIO" : "⚠ Requiere atención"}
          </Text>
          <Text style={{ textAlign: "center", fontSize: 12, color: "#374151", marginTop: 4 }}>
            {checkItems.filter(i => i.result === "ok").length} OK · {failCount} falla{failCount !== 1 ? "s" : ""} · {checkItems.filter(i => i.result === "na").length} N/A
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Observaciones generales</Text>
          <TextInput value={observations} onChangeText={setObservations}
            placeholder="Anota aquí cualquier observación relevante del servicio..."
            placeholderTextColor="#9BACC8" multiline numberOfLines={4}
            style={[s.input, { height: 100, textAlignVertical: "top" }]} />
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Evidencia fotográfica ({photos.length})</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {photos.map((uri, i) => (
              <View key={i} style={{ position: "relative" }}>
                <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderColor: "#D5DCF0" }} />
                <TouchableOpacity onPress={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                  style={{ position: "absolute", top: -6, right: -6, backgroundColor: "#EF4444", borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900" }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={pickPhoto}
              style={{ width: 80, height: 80, borderRadius: 8, borderWidth: 2, borderColor: "#3B82F6", borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: "#EFF6FF" }}>
              <Text style={{ fontSize: 28, color: "#3B82F6" }}>📷</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity onPress={submit} disabled={saving} style={[s.btnPrimary, { marginHorizontal: 0, opacity: saving ? 0.6 : 1 }]}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryTxt}>Guardar servicio</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function styles(insets: { top: number; bottom: number }) {
  return {
    nav: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, backgroundColor: "#122B60", paddingTop: insets.top + 10, paddingBottom: 12, paddingHorizontal: 16 },
    navBack: { width: 70 },
    navBackTxt: { color: "#93C5FD", fontSize: 14 },
    navTitle: { color: "#fff", fontWeight: "700" as const, fontSize: 16 },
    content: { padding: 16, paddingBottom: 40 },
    card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 14, elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4 },
    cardTitle: { fontSize: 14, fontWeight: "700" as const, color: "#1A2740", marginBottom: 6 },
    label: { fontSize: 12, fontWeight: "600" as const, color: "#5A6E8C", marginBottom: 2 },
    input: { backgroundColor: "#F0F4FB", borderRadius: 10, borderWidth: 1.5, borderColor: "#D5DCF0", paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: "#1A2740", marginTop: 4 },
    btnPrimary: { backgroundColor: "#122B60", borderRadius: 12, paddingVertical: 14, alignItems: "center" as const },
    btnPrimaryTxt: { color: "#fff", fontWeight: "700" as const, fontSize: 15 },
  };
}
