import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl, Alert, Modal,
  TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions } from "expo-camera";
import axios from "axios";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList, OrdenTrabajo } from "../types";
import { API_URL } from "../constants/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Taller">;
  route: RouteProp<RootStackParamList, "Taller">;
};

type Cliente = { id: string; name: string };
type EqLookup = { found: boolean; id?: string; name?: string; qr_code?: string; type?: string; serial_number?: string; client_name?: string };

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  abierta:    { label: "Abierta",     color: "#D97706", icon: "⏳" },
  en_proceso: { label: "En proceso",  color: "#2563EB", icon: "🔧" },
  cerrada:    { label: "Cerrada",     color: "#059669", icon: "✅" },
  cancelada:  { label: "Cancelada",   color: "#6B7280", icon: "✖️" },
};
const NEXT_STATUS: Record<string, string> = { abierta: "en_proceso", en_proceso: "cerrada" };
const TIPOS_OT = ["Mantenimiento preventivo","Mantenimiento correctivo","Prueba hidrostática","Recarga de extintor","Reparación","Inspección","Otro"];
const PRIORIDADES = [
  { key: "baja",  label: "Baja",  color: "#059669" },
  { key: "media", label: "Media", color: "#D97706" },
  { key: "alta",  label: "Alta",  color: "#DC2626" },
];

export default function TallerScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { inspectorId, userName } = route.params;
  const [permission, requestPermission] = useCameraPermissions();

  const [orders, setOrders]         = useState<OrdenTrabajo[]>([]);
  const [clientes, setClientes]     = useState<Cliente[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]         = useState<string>("all");

  // OT modal
  const [showOT, setShowOT]         = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [otTipo, setOtTipo]         = useState(TIPOS_OT[0]);
  const [otDesc, setOtDesc]         = useState("");
  const [otPrioridad, setOtPrioridad] = useState("media");
  const [otClientId, setOtClientId] = useState("");

  // PH Test modal
  const [showPH, setShowPH]           = useState(false);
  const [phEq, setPhEq]               = useState<EqLookup | null>(null);
  const [phCode, setPhCode]           = useState("");
  const [phCylType, setPhCylType]     = useState("");
  const [phWorkPsi, setPhWorkPsi]     = useState("");
  const [phTestPsi, setPhTestPsi]     = useState("");
  const [phResult, setPhResult]       = useState<"PASS"|"FAIL">("PASS");
  const [phObs, setPhObs]             = useState("");
  const [phBy, setPhBy]               = useState(userName);
  const [phSaving, setPhSaving]       = useState(false);

  // Manguera Test modal
  const [showMAN, setShowMAN]         = useState(false);
  const [manEq, setManEq]             = useState<EqLookup | null>(null);
  const [manCode, setManCode]         = useState("");
  const [manLength, setManLength]     = useState("");
  const [manPressure, setManPressure] = useState("120");
  const [manResult, setManResult]     = useState<"PASS"|"FAIL">("PASS");
  const [manObs, setManObs]           = useState("");
  const [manBy, setManBy]             = useState(userName);
  const [manSaving, setManSaving]     = useState(false);
  const [manDiameter, setManDiameter] = useState('1.5"');

  // Camera scanner state
  const [scanning, setScanning]       = useState(false);
  const [scanTarget, setScanTarget]   = useState<"ph"|"man"|"ot">("ph");
  const [lookingUp, setLookingUp]     = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [ordersRes, clientesRes] = await Promise.all([
        axios.get(`${API_URL}/mobile/taller?inspector_id=${inspectorId}`),
        axios.get(`${API_URL}/clients`),
      ]);
      setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
      setClientes(Array.isArray(clientesRes.data) ? clientesRes.data : []);
    } catch {
      Alert.alert("Error", "No se pudieron cargar las órdenes.");
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const lookupEquipment = async (code: string, target: "ph" | "man") => {
    if (!code.trim()) return;
    setLookingUp(true);
    try {
      const r = await axios.get<EqLookup>(`${API_URL.replace("/mobile", "")}/equipment/lookup?code=${encodeURIComponent(code)}`);
      const data = r.data;
      if (target === "ph") { setPhEq(data); if (!data.found) Alert.alert("No encontrado", `Código "${code}" no está en la base. Llena los datos manualmente.`); }
      else { setManEq(data); if (!data.found) Alert.alert("No encontrado", `Código "${code}" no está en la base. Llena los datos manualmente.`); }
    } catch {
      if (target === "ph") setPhEq({ found: false });
      else setManEq({ found: false });
    } finally { setLookingUp(false); }
  };

  const openCamera = async (target: "ph" | "man") => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) { Alert.alert("Permiso de cámara requerido"); return; }
    }
    setScanTarget(target);
    setScanning(true);
  };

  const onBarcode = ({ data }: { data: string }) => {
    setScanning(false);
    if (scanTarget === "ph") { setPhCode(data); lookupEquipment(data, "ph"); }
    else { setManCode(data); lookupEquipment(data, "man"); }
  };

  const submitPH = async () => {
    if (!phCylType.trim() || !phWorkPsi || !phTestPsi) {
      Alert.alert("Faltan datos", "Tipo de cilindro, presión de trabajo y presión de prueba son requeridos.");
      return;
    }
    setPhSaving(true);
    try {
      const r = await axios.post<{ folio: string; result: string }>(`${API_URL}/taller/ph`, {
        equipment_id: phEq?.id,
        equipment_code: phCode || undefined,
        cylinder_type: phCylType,
        working_pressure_psi: Number(phWorkPsi),
        test_pressure_psi: Number(phTestPsi),
        result: phResult,
        observations: phObs,
        tested_by: phBy,
        duration_seconds: 60,
      });
      Alert.alert("✅ Prueba PH guardada", `Folio: ${r.data.folio}\nResultado: ${r.data.result}`, [
        { text: "OK", onPress: () => { setShowPH(false); resetPH(); } },
      ]);
    } catch {
      Alert.alert("Error", "No se pudo guardar la prueba hidrostática.");
    } finally { setPhSaving(false); }
  };

  const submitMAN = async () => {
    if (!manLength || !manPressure) {
      Alert.alert("Faltan datos", "Longitud y presión de prueba son requeridos.");
      return;
    }
    setManSaving(true);
    try {
      const r = await axios.post<{ folio: string; result: string }>(`${API_URL}/taller/mangueras`, {
        equipment_id: manEq?.id,
        equipment_code: manCode || undefined,
        hose_diameter_in: manDiameter,
        hose_length_m: Number(manLength),
        test_pressure_lbs: Number(manPressure),
        result: manResult,
        observations: manObs,
        tested_by: manBy,
        duration_min: 3,
      });
      Alert.alert("✅ Prueba de manguera guardada", `Folio: ${r.data.folio}\nResultado: ${r.data.result}`, [
        { text: "OK", onPress: () => { setShowMAN(false); resetMAN(); } },
      ]);
    } catch {
      Alert.alert("Error", "No se pudo guardar la prueba.");
    } finally { setManSaving(false); }
  };

  const handleCreateOT = async () => {
    if (!otDesc.trim()) { Alert.alert("Descripción requerida"); return; }
    setSubmitting(true);
    try {
      const res = await axios.post<{ folio: string }>(`${API_URL}/mobile/taller`, {
        inspector_id: inspectorId, client_id: otClientId || undefined,
        tipo: otTipo, description: otDesc.trim(), priority: otPrioridad,
      });
      Alert.alert("OT Creada ✅", `Orden ${res.data?.folio} enviada al taller.`, [
        { text: "OK", onPress: () => { setShowOT(false); resetOT(); load(true); } },
      ]);
    } catch { Alert.alert("Error", "No se pudo crear la orden."); }
    finally { setSubmitting(false); }
  };

  const handleUpdateStatus = async (order: OrdenTrabajo) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    Alert.alert("Actualizar", `¿Cambiar a "${STATUS_CONFIG[next].label}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Confirmar", onPress: async () => {
        try {
          await axios.patch(`${API_URL}/mobile/taller`, { id: order.id, status: next, notes: order.notes });
          setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: next as OrdenTrabajo["status"] } : o));
        } catch { Alert.alert("Error", "No se pudo actualizar."); }
      }},
    ]);
  };

  const resetOT  = () => { setOtTipo(TIPOS_OT[0]); setOtDesc(""); setOtPrioridad("media"); setOtClientId(""); };
  const resetPH  = () => { setPhEq(null); setPhCode(""); setPhCylType(""); setPhWorkPsi(""); setPhTestPsi(""); setPhResult("PASS"); setPhObs(""); };
  const resetMAN = () => { setManEq(null); setManCode(""); setManLength(""); setManPressure("120"); setManResult("PASS"); setManObs(""); };

  const FILTERS = ["all","abierta","en_proceso","cerrada"];
  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);

  // ─── Camera Overlay ───
  if (scanning) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr","code128","code39","ean13","ean8","pdf417","aztec","datamatrix"] }} onBarcodeScanned={onBarcode} />
        <View style={{ position: "absolute", top: insets.top + 20, left: 0, right: 0, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 }}>
            Apunta al código del equipo
          </Text>
        </View>
        <TouchableOpacity onPress={() => setScanning(false)} style={{ position: "absolute", bottom: insets.bottom + 30, alignSelf: "center", backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 30, paddingHorizontal: 28, paddingVertical: 14 }}>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F0F4FA" }}>
      <LinearGradient colors={["#0D1B3E","#122B60"]} style={[s.nav, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={s.navTitle}>Taller</Text>
          {!!userName && <Text style={s.navSub}>{userName}</Text>}
        </View>
        <TouchableOpacity style={s.newOtBtn} onPress={() => { resetOT(); setShowOT(true); }}>
          <Text style={s.newOtText}>+ OT</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Quick action row */}
      <View style={s.quickRow}>
        <TouchableOpacity style={[s.quickBtn, { borderColor: "#7C3AED44", backgroundColor: "#7C3AED0A" }]} onPress={() => { resetPH(); setShowPH(true); }}>
          <Text style={{ fontSize: 18 }}>🔬</Text>
          <Text style={[s.quickTxt, { color: "#7C3AED" }]}>Prueba PH</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.quickBtn, { borderColor: "#0891B244", backgroundColor: "#0891B20A" }]} onPress={() => { resetMAN(); setShowMAN(true); }}>
          <Text style={{ fontSize: 18 }}>🌊</Text>
          <Text style={[s.quickTxt, { color: "#0891B2" }]}>Manguera</Text>
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar}>
        <View style={s.filterRow}>
          {FILTERS.map(f => {
            const count = f === "all" ? orders.length : orders.filter(o => o.status === f).length;
            const cfg   = f !== "all" ? STATUS_CONFIG[f] : null;
            const label = f === "all" ? "Todas" : cfg?.label ?? f;
            const active = filter === f;
            return (
              <TouchableOpacity key={f}
                style={[s.filterChip, { backgroundColor: active ? "#122B60" : "#fff", borderColor: active ? "#3B82F6" : "#E2E8F5" }]}
                onPress={() => setFilter(f)}>
                <Text style={[s.filterText, { color: active ? "#fff" : "#6B84A8" }]}>
                  {cfg ? `${cfg.icon} ` : "📋 "}{label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {loading ? (
        <ActivityIndicator color="#3B82F6" size="large" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#3B82F6" />}>
          {filtered.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: "#fff", borderColor: "#E2E8F5" }]}>
              <Text style={{ fontSize: 36, marginBottom: 10 }}>🔧</Text>
              <Text style={{ color: "#9BACC8", fontSize: 14, textAlign: "center" }}>Sin órdenes en esta categoría</Text>
            </View>
          ) : filtered.map((order, idx) => {
            const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.abierta;
            const next = NEXT_STATUS[order.status];
            const nextCfg = next ? STATUS_CONFIG[next] : null;
            return (
              <View key={order.id ?? String(idx)} style={[s.orderCard, { backgroundColor: "#fff", borderColor: "#E2E8F5" }]}>
                <View style={s.orderTop}>
                  <View style={[s.statusDot, { backgroundColor: cfg.color + "22", borderColor: cfg.color }]}>
                    <Text style={{ fontSize: 16 }}>{cfg.icon}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[s.orderFolio, { color: "#122B60" }]}>{order.folio || "OT"}</Text>
                    <Text style={[s.orderTipo, { color: "#1A2740" }]}>{order.tipo || "Orden de trabajo"}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: cfg.color + "22" }]}>
                    <Text style={[s.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>
                <View style={[s.orderMeta, { borderColor: "#EEF2FB" }]}>
                  {!!order.client_name && <Text style={[s.metaLine, { color: "#6B84A8" }]}>🏢 {order.client_name}</Text>}
                  {!!order.notes && <Text style={[s.metaLine, { color: "#6B84A8" }]} numberOfLines={2}>📝 {order.notes}</Text>}
                  <Text style={[s.metaDate, { color: "#B0BDCE" }]}>{new Date(order.created_at).toLocaleDateString("es-MX")}</Text>
                </View>
                {nextCfg && (
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: nextCfg.color + "15", borderColor: nextCfg.color }]} onPress={() => handleUpdateStatus(order)} activeOpacity={0.75}>
                    <Text style={[s.actionText, { color: nextCfg.color }]}>{nextCfg.icon} Marcar como {nextCfg.label}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ─── Nueva OT Modal ─── */}
      <Modal visible={showOT} animationType="slide" transparent statusBarTranslucent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowOT(false)} />
          <View style={s.modalCard}>
            <ModalHeader title="Nueva Orden de Trabajo" onClose={() => setShowOT(false)} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <FieldLabel>Tipo de trabajo *</FieldLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                {TIPOS_OT.map(t => <Chip key={t} label={t} selected={otTipo === t} onPress={() => setOtTipo(t)} />)}
              </ScrollView>
              <FieldLabel style={{ marginTop: 14 }}>Prioridad *</FieldLabel>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {PRIORIDADES.map(p => <Chip key={p.key} label={p.label} selected={otPrioridad === p.key} onPress={() => setOtPrioridad(p.key)} color={p.color} flex />)}
              </View>
              {clientes.length > 0 && <>
                <FieldLabel style={{ marginTop: 14 }}>Cliente (opcional)</FieldLabel>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                  <Chip label="Sin cliente" selected={!otClientId} onPress={() => setOtClientId("")} />
                  {clientes.slice(0, 15).map(c => <Chip key={c.id} label={c.name} selected={otClientId === c.id} onPress={() => setOtClientId(c.id)} />)}
                </ScrollView>
              </>}
              <FieldLabel style={{ marginTop: 14 }}>Descripción *</FieldLabel>
              <TextInput style={s.textArea} value={otDesc} onChangeText={v => setOtDesc(v.toUpperCase())} autoCapitalize="characters" placeholder="DESCRIBE EL TRABAJO A REALIZAR..." placeholderTextColor="#9BACC8" multiline numberOfLines={4} textAlignVertical="top" />
              <View style={{ height: 16 }} />
              <SubmitBtn label="Crear y enviar al taller" onPress={handleCreateOT} loading={submitting} />
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Prueba PH Modal ─── */}
      <Modal visible={showPH} animationType="slide" transparent statusBarTranslucent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowPH(false)} />
          <View style={s.modalCard}>
              <ModalHeader title="🔬 Prueba Hidrostática" onClose={() => setShowPH(false)} />
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <FieldLabel>Código del equipo</FieldLabel>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    style={[s.textInput, { flex: 1, fontFamily: "monospace" }]}
                    value={phCode} onChangeText={setPhCode}
                    placeholder="Ingresa o escanea el código..."
                    placeholderTextColor="#9BACC8"
                    autoCapitalize="characters"
                    onSubmitEditing={() => lookupEquipment(phCode, "ph")}
                  />
                  <TouchableOpacity style={s.scanBtn} onPress={() => openCamera("ph")}>
                    <Text style={{ fontSize: 22 }}>📷</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.scanBtn, { backgroundColor: "#1D4ED8" }]} onPress={() => lookupEquipment(phCode, "ph")} disabled={lookingUp}>
                    {lookingUp ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>OK</Text>}
                  </TouchableOpacity>
                </View>
                {phEq && (
                  <View style={[s.eqBanner, { backgroundColor: phEq.found ? "#DCFCE7" : "#FEF3C7", borderColor: phEq.found ? "#22C55E" : "#F59E0B" }]}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: phEq.found ? "#15803D" : "#92400E" }}>
                      {phEq.found ? `✓ ${phEq.name} · ${phEq.serial_number || ""}${phEq.client_name ? ` (${phEq.client_name})` : ""}` : "⚠ Equipo no encontrado — llena los datos manualmente"}
                    </Text>
                  </View>
                )}
                <FieldLabel style={{ marginTop: 12 }}>Tipo de cilindro *</FieldLabel>
                <TextInput style={s.textInput} value={phCylType} onChangeText={setPhCylType} placeholder="PQS, CO₂, SCBA, Agua, AFFF..." placeholderTextColor="#9BACC8" />
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <FieldLabel>Presión trabajo (PSI) *</FieldLabel>
                    <TextInput style={s.textInput} value={phWorkPsi} onChangeText={setPhWorkPsi} keyboardType="numeric" placeholder="150" placeholderTextColor="#9BACC8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FieldLabel>Presión prueba (PSI) *</FieldLabel>
                    <TextInput style={s.textInput} value={phTestPsi} onChangeText={setPhTestPsi} keyboardType="numeric" placeholder="225" placeholderTextColor="#9BACC8" />
                  </View>
                </View>
                <FieldLabel style={{ marginTop: 12 }}>Resultado *</FieldLabel>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity style={[s.resultBtn, { borderColor: "#22C55E", backgroundColor: phResult === "PASS" ? "#22C55E" : "#F0FDF4" }]} onPress={() => setPhResult("PASS")}>
                    <Text style={{ fontWeight: "800", color: phResult === "PASS" ? "#fff" : "#15803D" }}>✓ APROBADA</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.resultBtn, { borderColor: "#EF4444", backgroundColor: phResult === "FAIL" ? "#EF4444" : "#FFF1F2" }]} onPress={() => setPhResult("FAIL")}>
                    <Text style={{ fontWeight: "800", color: phResult === "FAIL" ? "#fff" : "#DC2626" }}>✗ RECHAZADA</Text>
                  </TouchableOpacity>
                </View>
                <FieldLabel style={{ marginTop: 12 }}>Observaciones</FieldLabel>
                <TextInput style={s.textArea} value={phObs} onChangeText={setPhObs} placeholder="Condiciones del ensayo, notas..." placeholderTextColor="#9BACC8" multiline numberOfLines={3} textAlignVertical="top" />
                <FieldLabel style={{ marginTop: 12 }}>Técnico que realizó</FieldLabel>
                <TextInput style={s.textInput} value={phBy} onChangeText={setPhBy} placeholder="Nombre del técnico" placeholderTextColor="#9BACC8" />
                <View style={{ height: 16 }} />
                <SubmitBtn label="Guardar prueba hidrostática" onPress={submitPH} loading={phSaving} color="#7C3AED" />
                <View style={{ height: 20 }} />
              </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Prueba Manguera Modal ─── */}
      <Modal visible={showMAN} animationType="slide" transparent statusBarTranslucent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowMAN(false)} />
          <View style={s.modalCard}>
              <ModalHeader title="🌊 Prueba de Manguera" onClose={() => setShowMAN(false)} />
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <FieldLabel>Código del equipo</FieldLabel>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    style={[s.textInput, { flex: 1, fontFamily: "monospace" }]}
                    value={manCode} onChangeText={setManCode}
                    placeholder="Ingresa o escanea el código..."
                    placeholderTextColor="#9BACC8"
                    autoCapitalize="characters"
                    onSubmitEditing={() => lookupEquipment(manCode, "man")}
                  />
                  <TouchableOpacity style={s.scanBtn} onPress={() => openCamera("man")}>
                    <Text style={{ fontSize: 22 }}>📷</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.scanBtn, { backgroundColor: "#1D4ED8" }]} onPress={() => lookupEquipment(manCode, "man")} disabled={lookingUp}>
                    {lookingUp ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>OK</Text>}
                  </TouchableOpacity>
                </View>
                {manEq && (
                  <View style={[s.eqBanner, { backgroundColor: manEq.found ? "#DCFCE7" : "#FEF3C7", borderColor: manEq.found ? "#22C55E" : "#F59E0B" }]}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: manEq.found ? "#15803D" : "#92400E" }}>
                      {manEq.found ? `✓ ${manEq.name}${manEq.client_name ? ` (${manEq.client_name})` : ""}` : "⚠ Equipo no encontrado — llena los datos manualmente"}
                    </Text>
                  </View>
                )}
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <FieldLabel>Diámetro</FieldLabel>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={{ gap: 6 }}>
                      {['1.5"', '2.5"', '1"', '3"'].map(d => (
                        <Chip key={d} label={d} selected={manDiameter === d} onPress={() => setManDiameter(d)} />
                      ))}
                    </ScrollView>
                  </View>
                  <View style={{ flex: 1 }}>
                    <FieldLabel>Longitud (m) *</FieldLabel>
                    <TextInput style={s.textInput} value={manLength} onChangeText={setManLength} keyboardType="numeric" placeholder="15" placeholderTextColor="#9BACC8" />
                  </View>
                </View>
                <FieldLabel style={{ marginTop: 12 }}>Presión de prueba (lbs) *</FieldLabel>
                <TextInput style={s.textInput} value={manPressure} onChangeText={setManPressure} keyboardType="numeric" placeholder="120" placeholderTextColor="#9BACC8" />
                <FieldLabel style={{ marginTop: 12 }}>Resultado *</FieldLabel>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity style={[s.resultBtn, { borderColor: "#22C55E", backgroundColor: manResult === "PASS" ? "#22C55E" : "#F0FDF4" }]} onPress={() => setManResult("PASS")}>
                    <Text style={{ fontWeight: "800", color: manResult === "PASS" ? "#fff" : "#15803D" }}>✓ APROBADA</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.resultBtn, { borderColor: "#EF4444", backgroundColor: manResult === "FAIL" ? "#EF4444" : "#FFF1F2" }]} onPress={() => setManResult("FAIL")}>
                    <Text style={{ fontWeight: "800", color: manResult === "FAIL" ? "#fff" : "#DC2626" }}>✗ RECHAZADA</Text>
                  </TouchableOpacity>
                </View>
                <FieldLabel style={{ marginTop: 12 }}>Observaciones</FieldLabel>
                <TextInput style={s.textArea} value={manObs} onChangeText={setManObs} placeholder="Fugas, deformaciones, notas..." placeholderTextColor="#9BACC8" multiline numberOfLines={3} textAlignVertical="top" />
                <FieldLabel style={{ marginTop: 12 }}>Técnico que realizó</FieldLabel>
                <TextInput style={s.textInput} value={manBy} onChangeText={setManBy} placeholder="Nombre del técnico" placeholderTextColor="#9BACC8" />
                <View style={{ height: 16 }} />
                <SubmitBtn label="Guardar prueba de manguera" onPress={submitMAN} loading={manSaving} color="#0891B2" />
                <View style={{ height: 20 }} />
              </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Tiny helpers ────────────────────────────────────────────────────────────

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <Text style={{ fontSize: 16, fontWeight: "800", color: "#122B60", flex: 1 }}>{title}</Text>
      <TouchableOpacity onPress={onClose} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "#F0F4FB", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#6B84A8", fontSize: 18, lineHeight: 20 }}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

function FieldLabel({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[{ fontSize: 11, fontWeight: "700", color: "#5A6E8C", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }, style]}>{children}</Text>;
}

function Chip({ label, selected, onPress, color, flex }: { label: string; selected: boolean; onPress: () => void; color?: string; flex?: boolean }) {
  const c = color ?? "#122B60";
  return (
    <TouchableOpacity
      style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, flex: flex ? 1 : undefined, alignItems: "center", backgroundColor: selected ? c : "#F0F4FB", borderColor: selected ? c : "#D5DCF0" }}
      onPress={onPress}
    >
      <Text style={{ fontSize: 12, fontWeight: "700", color: selected ? "#fff" : "#4A6A90" }}>{label}</Text>
    </TouchableOpacity>
  );
}

function SubmitBtn({ label, onPress, loading, color = "#122B60" }: { label: string; onPress: () => void; loading: boolean; color?: string }) {
  return (
    <TouchableOpacity
      style={{ backgroundColor: color, borderRadius: 14, paddingVertical: 16, alignItems: "center", opacity: loading ? 0.7 : 1 }}
      onPress={onPress} disabled={loading} activeOpacity={0.85}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>{label}</Text>}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  nav:         { paddingBottom: 16, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn:     { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  backArrow:   { color: "#fff", fontSize: 22, fontWeight: "700" },
  navTitle:    { color: "#fff", fontSize: 17, fontWeight: "800" },
  navSub:      { color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 1 },
  newOtBtn:    { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  newOtText:   { color: "#fff", fontSize: 13, fontWeight: "700" },
  quickRow:    { flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#F0F4FA" },
  quickBtn:    { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5 },
  quickTxt:    { fontSize: 13, fontWeight: "700" },
  filterBar:   { flexGrow: 0 },
  filterRow:   { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  filterChip:  { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  filterText:  { fontSize: 13, fontWeight: "700" },
  emptyCard:   { borderRadius: 14, padding: 40, alignItems: "center", borderWidth: 1, marginTop: 20 },
  orderCard:   { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  orderTop:    { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  statusDot:   { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  orderFolio:  { fontSize: 14, fontWeight: "800", letterSpacing: 0.3 },
  orderTipo:   { fontSize: 13, marginTop: 3, color: "#4A5568" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusText:  { fontSize: 11, fontWeight: "700" },
  orderMeta:   { borderTopWidth: 1, paddingTop: 10, gap: 6 },
  metaLine:    { fontSize: 13, lineHeight: 19 },
  metaDate:    { fontSize: 11, marginTop: 2 },
  actionBtn:   { marginTop: 12, borderRadius: 10, borderWidth: 1.5, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center" },
  actionText:  { fontSize: 14, fontWeight: "700" },
  modalOverlay:{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard:   { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 0, maxHeight: "93%" },
  textInput:   { backgroundColor: "#F0F4FB", borderRadius: 10, borderWidth: 1.5, borderColor: "#D5DCF0", paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: "#1A2740" },
  textArea:    { backgroundColor: "#F0F4FB", borderRadius: 12, borderWidth: 1.5, borderColor: "#D5DCF0", paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#1A2740", minHeight: 90, paddingTop: 12 },
  scanBtn:     { width: 46, height: 46, borderRadius: 10, backgroundColor: "#F0F4FB", borderWidth: 1.5, borderColor: "#D5DCF0", alignItems: "center", justifyContent: "center" },
  eqBanner:    { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8 },
  resultBtn:   { flex: 1, borderWidth: 2, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
});
