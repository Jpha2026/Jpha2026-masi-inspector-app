import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl, Alert, Modal,
  TextInput, KeyboardAvoidingView, Platform, Image,
} from "react-native";
import { UpperInput } from "../components/UpperInput";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList, OrdenTrabajo, OTItem } from "../types";
import { API_URL } from "../constants/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Taller">;
  route: RouteProp<RootStackParamList, "Taller">;
};

type Cliente = { id: string; name: string };
type EqLookup = { found: boolean; id?: string; name?: string; qr_code?: string; type?: string; serial_number?: string; capacity?: string; agent_type?: string; client_name?: string };
type BitItem = { uid: string; type: string; serial: string; qty: number; capacidad: string };

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  abierta:    { label: "Abierta",     color: "#D97706", icon: "⏳" },
  en_proceso: { label: "En proceso",  color: "#2563EB", icon: "🔧" },
  cerrada:    { label: "Cerrada",     color: "#059669", icon: "✅" },
  cancelada:  { label: "Cancelada",   color: "#6B7280", icon: "✖️" },
};
const NEXT_STATUS: Record<string, string> = { abierta: "en_proceso", en_proceso: "cerrada" };
const TIPOS_OT = ["Mantenimiento preventivo","Mantenimiento correctivo","Prueba hidrostática","Recarga de extintor","Reparación","Inspección","Otro"];
const PRIORIDADES = [
  { key: "baja",   label: "Baja",   color: "#059669" },
  { key: "media",  label: "Media",  color: "#D97706" },
  { key: "alta",   label: "Alta",   color: "#DC2626" },
  { key: "urgente",label: "Urgente",color: "#7C2D12" },
];
const TIPOS_EQUIPO = [
  "Extintor CO2","Extintor PQS","Extintor AFFF","Extintor HCFC","Extintor Agua",
  "Manguera SCI","Cilindro N2","Cilindro Aire","Otro",
];
const CAPACIDADES = ["1 kg","2 kg","4 kg","6 kg","9 kg","12 kg","20 kg","30 kg","2.5 lb","5 lb","10 lb","20 lb"];

let _uidSeq = 0;
const uid = () => `${Date.now().toString(36)}_${(++_uidSeq).toString(36)}`;

function ClientSelector({
  clients, value, onChange, onCreated,
}: {
  clients: Cliente[];
  value: string;
  onChange: (id: string) => void;
  onCreated: (c: Cliente) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const selected = clients.find(c => c.id === value);
  const filtered = q.trim()
    ? clients.filter(c => c.name.toLowerCase().includes(q.trim().toLowerCase()))
    : clients;
  const canCreate = q.trim().length > 1 &&
    !clients.some(c => c.name.toLowerCase() === q.trim().toLowerCase());

  if (selected) {
    return (
      <TouchableOpacity
        onPress={() => { onChange(""); setQ(""); setOpen(false); }}
        style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#EFF6FF", borderRadius: 10, borderWidth: 1.5, borderColor: "#3B82F6", paddingHorizontal: 14, paddingVertical: 10, marginTop: 6 }}
      >
        <Text style={{ flex: 1, fontWeight: "700", color: "#1D4ED8", fontSize: 13 }}>{selected.name}</Text>
        <Text style={{ color: "#6B7280", fontSize: 18, lineHeight: 20 }}>✕</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ marginTop: 6 }}>
      <TextInput
        value={q}
        onChangeText={t => { setQ(t); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar o escribir cliente..."
        placeholderTextColor="#6B7CA3"
        style={{ backgroundColor: "#F0F4FB", borderRadius: 10, borderWidth: 1.5, borderColor: open ? "#3B82F6" : "#D5DCF0", paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: "#1A2740" }}
        autoCapitalize="characters"
      />
      {open && (
        <View style={{ backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#D5DCF0", marginTop: 4, maxHeight: 210, elevation: 4, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 6 }}>
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              onPress={() => { onChange(""); setQ(""); setOpen(false); }}
              style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0F4FB" }}
            >
              <Text style={{ color: "#6B7280", fontSize: 12, fontStyle: "italic" }}>Sin cliente</Text>
            </TouchableOpacity>
            {filtered.slice(0, 8).map(c => (
              <TouchableOpacity
                key={c.id}
                onPress={() => { onChange(c.id); setQ(""); setOpen(false); }}
                style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0F4FB" }}
              >
                <Text style={{ color: "#1A2740", fontSize: 13, fontWeight: "600" }}>{c.name}</Text>
              </TouchableOpacity>
            ))}
            {canCreate && (
              <TouchableOpacity
                disabled={busy}
                onPress={async () => {
                  setBusy(true);
                  try {
                    const { data } = await axios.post<{ id: string; name: string }>(
                      `${API_URL}/mobile/clients`,
                      { name: q.trim() }
                    );
                    onCreated(data);
                    onChange(data.id);
                    setQ("");
                    setOpen(false);
                  } catch {
                    Alert.alert("Error", "No se pudo registrar el cliente.");
                  } finally {
                    setBusy(false);
                  }
                }}
                style={{ paddingHorizontal: 14, paddingVertical: 11, backgroundColor: "#EFF6FF", borderTopWidth: 1, borderTopColor: "#DBEAFE" }}
              >
                <Text style={{ color: "#1D4ED8", fontSize: 12, fontWeight: "700" }}>
                  {busy ? "Registrando..." : `+ Registrar "${q.trim()}" como nuevo cliente`}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default function TallerScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { inspectorId, userName } = route.params;
  const [permission, requestPermission] = useCameraPermissions();

  const [orders, setOrders]         = useState<OrdenTrabajo[]>([]);
  const [clientes, setClientes]     = useState<Cliente[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]         = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [sortNewest, setSortNewest] = useState(true);

  // OT modal
  const [showOT, setShowOT]           = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [otTipo, setOtTipo]           = useState(TIPOS_OT[0]);
  const [otDesc, setOtDesc]           = useState("");
  const [otPrioridad, setOtPrioridad] = useState("media");
  const [otClientId, setOtClientId]   = useState("");

  // PH Test modal
  const [showPH, setShowPH]               = useState(false);
  const [phEq, setPhEq]                   = useState<EqLookup | null>(null);
  const [phCode, setPhCode]               = useState("");
  const [phCylType, setPhCylType]         = useState("");
  const [phPressureClass, setPhPressureClass] = useState<"baja"|"alta">("baja");
  const [phSerial, setPhSerial]           = useState("");
  const [phCapacity, setPhCapacity]       = useState("");
  const [phYearMfg, setPhYearMfg]         = useState("");
  const [phWorkPsi, setPhWorkPsi]         = useState("");
  const [phTestPsi, setPhTestPsi]         = useState("");
  const [phDuration, setPhDuration]       = useState("60");
  const [phResult, setPhResult]           = useState<"PASS"|"FAIL">("PASS");
  const [phCauseReject, setPhCauseReject] = useState("");
  const [phObs, setPhObs]                 = useState("");
  const [phBy, setPhBy]                   = useState(userName);
  const [phSaving, setPhSaving]           = useState(false);
  const [phPhotos, setPhPhotos]           = useState<string[]>([]);
  // PH extra fields (matching report)
  const [phClientId, setPhClientId]             = useState("");
  const [phClassification, setPhClassification] = useState("DOT-3AL");
  const [phBrand, setPhBrand]                   = useState("");
  const [phLastTestDate, setPhLastTestDate]     = useState("");
  const [phSevereDent, setPhSevereDent]         = useState(false);
  const [phExcessCorrosion, setPhExcessCorrosion] = useState(false);
  const [phBaseCorrosion, setPhBaseCorrosion]   = useState(false);
  const [phVolInitial, setPhVolInitial]         = useState("");
  const [phVolTransient, setPhVolTransient]     = useState("");
  const [phVolPermanent, setPhVolPermanent]     = useState("");
  const [phExpansionPct, setPhExpansionPct]     = useState("");
  const [phHasDeformation, setPhHasDeformation]   = useState(false);
  const [phHasPressureLoss, setPhHasPressureLoss] = useState(false);
  const [phModel, setPhModel]                   = useState("");
  const [phReviewedBy, setPhReviewedBy]         = useState("");
  const [phNextTestDate, setPhNextTestDate]     = useState("");
  const [phOrderNumber, setPhOrderNumber]       = useState("");

  // Manguera Test modal
  const [showMAN, setShowMAN]             = useState(false);
  const [manEq, setManEq]                 = useState<EqLookup | null>(null);
  const [manCode, setManCode]             = useState("");
  const [manClientId, setManClientId]     = useState("");
  const [manHoseType, setManHoseType]     = useState("Manguera SCI");
  const [manSerial, setManSerial]         = useState("");
  const [manMfgMonth, setManMfgMonth]     = useState("");
  const [manMfgYear, setManMfgYear]       = useState("");
  const [manLength, setManLength]         = useState("");
  const [manPressure, setManPressure]     = useState("120");
  const [manResult, setManResult]         = useState<"PASS"|"FAIL">("PASS");
  const [manOrderNumber, setManOrderNumber] = useState("");
  const [manObs, setManObs]               = useState("");
  const [manBy, setManBy]                 = useState(userName);
  const [manSaving, setManSaving]         = useState(false);
  const [manPhotos, setManPhotos]         = useState<string[]>([]);
  const [manDiameter, setManDiameter]     = useState('1.5"');

  // Bitácora de Recarga modal
  const [showBit, setShowBit]         = useState(false);
  const [bitClientId, setBitClientId] = useState("");
  const [bitItems, setBitItems]       = useState<BitItem[]>([]);
  const [bitNotes, setBitNotes]       = useState("");
  const [bitTecnico, setBitTecnico]   = useState(userName);
  const [bitPhotos, setBitPhotos]     = useState<string[]>([]);
  const [bitSaving, setBitSaving]     = useState(false);

  const addClient = (c: Cliente) =>
    setClientes(prev => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)));

  // Camera scanner
  const [scanning, setScanning]       = useState(false);
  const [scanTarget, setScanTarget]   = useState<"ph"|"man">("ph");
  const [lookingUp, setLookingUp]     = useState(false);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    // Root screen (role=taller logged in directly) — logout
    Alert.alert("Cerrar sesión", "¿Salir del módulo Taller?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: async () => {
        try { await axios.post(`${API_URL}/mobile/logout`); } catch {}
        delete (axios.defaults.headers.common as Record<string, unknown>)["Authorization"];
        await SecureStore.deleteItemAsync("masi_token");
        await SecureStore.deleteItemAsync("masi_user");
        await SecureStore.deleteItemAsync("masi_active_jornada");
        await SecureStore.deleteItemAsync("inspector_id");
        await SecureStore.deleteItemAsync("inspector_name");
        navigation.replace("Login");
      }},
    ]);
  };

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [ordersRes, clientesRes] = await Promise.all([
        axios.get(`${API_URL}/mobile/taller`),
        axios.get(`${API_URL}/mobile/clients`),
      ]);
      setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
      setClientes(clientesRes.data?.rows ?? []);
    } catch {
      Alert.alert("Error", "No se pudieron cargar las órdenes.");
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  // Auto-calc expansión % when permanent or transient volumes change
  useEffect(() => {
    const perm  = Number(phVolPermanent);
    const trans = Number(phVolTransient);
    if (phVolPermanent && phVolTransient && trans > 0) {
      setPhExpansionPct(((perm / trans) * 100).toFixed(3));
    }
  }, [phVolPermanent, phVolTransient]);

  // ─── Equipment lookup ───────────────────────────────────────────────────────
  const lookupEquipment = async (code: string, target: "ph" | "man") => {
    if (!code.trim()) return;
    setLookingUp(true);
    try {
      const r = await axios.get<EqLookup>(`${API_URL}/equipment/lookup?code=${encodeURIComponent(code)}`);
      const data = r.data;
      if (target === "ph") {
        setPhEq(data);
        if (data.found) {
          if (data.agent_type) setPhCylType(data.agent_type);
          else if (data.type) setPhCylType(data.type);
          if (data.serial_number) setPhSerial(data.serial_number);
          if (data.capacity) setPhCapacity(data.capacity);
        } else {
          Alert.alert("No encontrado", `Código "${code}" no está en la base.`);
        }
      } else {
        setManEq(data);
        if (!data.found) Alert.alert("No encontrado", `Código "${code}" no está en la base.`);
      }
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
    else                     { setManCode(data); lookupEquipment(data, "man"); }
  };

  // ─── PH Submit ──────────────────────────────────────────────────────────────
  const submitPH = async () => {
    if (!phCylType.trim() || !phWorkPsi || !phTestPsi) {
      Alert.alert("Faltan datos", "Tipo de cilindro, presión de trabajo y presión de prueba son requeridos.");
      return;
    }
    setPhSaving(true);
    const uploadPhPhotos = async (testId: string) => {
      for (const uri of phPhotos) {
        try {
          const fd = new FormData();
          fd.append("file", { uri, name: `ph_${Date.now()}.jpg`, type: "image/jpeg" } as unknown as Blob);
          fd.append("entity_type", "ph_test");
          fd.append("entity_id", testId);
          await axios.post(`${API_URL}/mobile/upload`, fd, { headers: { "Content-Type": "multipart/form-data" } });
        } catch { /* non-fatal */ }
      }
    };
    try {
      const r = await axios.post<{ ok: boolean; id: string; folio: string; result: string }>(`${API_URL}/mobile/taller/ph`, {
        equipment_id: phEq?.id,
        equipment_code: phCode || undefined,
        client_id: phClientId || undefined,
        test_type: phPressureClass === "alta" ? "alta_presion" : "baja_presion",
        cylinder_type: phCylType,
        cylinder_classification: phClassification || undefined,
        brand: phBrand || undefined,
        model: phModel || undefined,
        serial_number: phSerial || undefined,
        capacity: phCapacity || undefined,
        manufacture_year: phYearMfg ? Number(phYearMfg) : undefined,
        last_test_date: phLastTestDate || undefined,
        has_severe_dent: phSevereDent,
        has_excess_corrosion: phExcessCorrosion,
        has_base_corrosion: phBaseCorrosion,
        working_pressure_psi: Number(phWorkPsi),
        test_pressure_psi: Number(phTestPsi),
        duration_seconds: Number(phDuration) || 60,
        volume_initial_ml: phVolInitial ? Number(phVolInitial) : undefined,
        volume_transient_ml: phVolTransient ? Number(phVolTransient) : undefined,
        volume_permanent_ml: phVolPermanent ? Number(phVolPermanent) : undefined,
        expansion_pct: phExpansionPct ? Number(phExpansionPct) : undefined,
        has_deformation: phHasDeformation,
        has_pressure_loss: phHasPressureLoss,
        result: phResult,
        rejection_reason: phResult === "FAIL" ? phCauseReject : undefined,
        observations: phObs,
        tested_by: phBy,
        reviewed_by: phReviewedBy || undefined,
        next_test_date: phNextTestDate || undefined,
        order_number: phOrderNumber || undefined,
      }, { timeout: 30000 });
      if (r.data.id && phPhotos.length > 0) await uploadPhPhotos(r.data.id);
      Alert.alert("✅ Prueba PH guardada", `Folio: ${r.data.folio}\nResultado: ${r.data.result}`, [
        { text: "OK", onPress: () => { setShowPH(false); resetPH(); } },
      ]);
    } catch {
      // Verify via GET — server may have saved the record despite the timeout
      if (phOrderNumber) {
        try {
          const check = await axios.get<{ found: boolean; id?: string; folio?: string; result?: string }>(
            `${API_URL}/mobile/taller/ph?order_number=${encodeURIComponent(phOrderNumber)}`,
            { timeout: 10000 }
          );
          if (check.data.found && check.data.id) {
            if (phPhotos.length > 0) await uploadPhPhotos(check.data.id);
            Alert.alert("✅ Prueba PH guardada", `Folio: ${check.data.folio}\nResultado: ${check.data.result}`, [
              { text: "OK", onPress: () => { setShowPH(false); resetPH(); } },
            ]);
            return;
          }
        } catch { /* verification also failed */ }
      }
      Alert.alert(
        "⚠️ Posible error de red",
        "El reporte pudo haberse enviado. Verifica el historial antes de reintentarlo.",
        [{ text: "Cerrar formulario", onPress: () => { setShowPH(false); resetPH(); } }]
      );
    }
  };

  // ─── Manguera Submit ────────────────────────────────────────────────────────
  const submitMAN = async () => {
    if (!manLength || !manPressure) {
      Alert.alert("Faltan datos", "Longitud y presión de prueba son requeridos.");
      return;
    }
    setManSaving(true);
    try {
      const r = await axios.post<{ ok: boolean; id: string; folio: string; result: string }>(`${API_URL}/mobile/taller/mangueras`, {
        equipment_id: manEq?.id, equipment_code: manCode || undefined,
        order_number: manOrderNumber || undefined,
        client_id: manClientId || undefined,
        hose_type: manHoseType || "Manguera SCI",
        hose_diameter_in: manDiameter, hose_length_m: Number(manLength),
        serial_number: manSerial || undefined,
        manufacture_date: (manMfgYear && manMfgMonth) ? `${manMfgYear}-${manMfgMonth.padStart(2, "0")}` : undefined,
        test_pressure_lbs: Number(manPressure), result: manResult,
        observations: manObs, tested_by: manBy, duration_min: 3,
      });
      if (r.data.id && manPhotos.length > 0) {
        for (const uri of manPhotos) {
          try {
            const fd = new FormData();
            fd.append("file", { uri, name: `man_${Date.now()}.jpg`, type: "image/jpeg" } as unknown as Blob);
            fd.append("entity_type", "hose_test");
            fd.append("entity_id", r.data.id);
            await axios.post(`${API_URL}/mobile/upload`, fd, { headers: { "Content-Type": "multipart/form-data" } });
          } catch { /* non-fatal */ }
        }
      }
      Alert.alert("✅ Prueba de manguera guardada", `Folio: ${r.data.folio}\nResultado: ${r.data.result}`, [
        { text: "OK", onPress: () => { setShowMAN(false); resetMAN(); } },
      ]);
    } catch {
      Alert.alert(
        "⚠️ Posible error de red",
        "El reporte pudo haberse enviado. Verifica el historial antes de reintentarlo.",
        [{ text: "Cerrar formulario", onPress: () => { setShowMAN(false); resetMAN(); } }]
      );
    }
  };

  // ─── OT Submit ──────────────────────────────────────────────────────────────
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
    } catch {
      Alert.alert(
        "⚠️ Posible error de red",
        "La orden pudo haberse creado. Verifica el historial antes de reintentarlo.",
        [{ text: "Cerrar formulario", onPress: () => { setShowOT(false); resetOT(); load(true); } }]
      );
    }
  };

  // ─── Status Update ──────────────────────────────────────────────────────────
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

  // ─── Bitácora de Recarga ────────────────────────────────────────────────────
  const addBitItem = () => {
    setBitItems(prev => [...prev, { uid: uid(), type: TIPOS_EQUIPO[0], serial: "", qty: 1, capacidad: "" }]);
  };

  const updateBitItem = (id: string, field: keyof Omit<BitItem, "uid">, val: string | number) => {
    setBitItems(prev => prev.map(i => i.uid === id ? { ...i, [field]: val } : i));
  };

  const removeBitItem = (id: string) => {
    setBitItems(prev => prev.filter(i => i.uid !== id));
  };

  const takeBitPhoto = async () => {
    if (bitPhotos.length >= 4) { Alert.alert("Máximo 4 fotos"); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permiso de cámara requerido"); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.6 });
    if (!result.canceled && result.assets[0]?.uri) setBitPhotos(prev => [...prev, result.assets[0].uri]);
  };

  const pickBitPhoto = async () => {
    if (bitPhotos.length >= 4) { Alert.alert("Máximo 4 fotos"); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permiso de galería requerido"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.6 });
    if (!result.canceled && result.assets[0]?.uri) setBitPhotos(prev => [...prev, result.assets[0].uri]);
  };

  const takePhPhoto = async () => {
    if (phPhotos.length >= 15) { Alert.alert("Máximo 15 fotos"); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permiso de cámara requerido"); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.7 });
    if (!result.canceled && result.assets[0]?.uri) setPhPhotos(prev => [...prev, result.assets[0].uri]);
  };

  const pickPhPhoto = async () => {
    if (phPhotos.length >= 15) { Alert.alert("Máximo 15 fotos"); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permiso de galería requerido"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.7, allowsMultipleSelection: true, selectionLimit: 15 - phPhotos.length });
    if (!result.canceled) setPhPhotos(prev => [...prev, ...result.assets.map(a => a.uri)]);
  };

  const takeManPhoto = async () => {
    if (manPhotos.length >= 15) { Alert.alert("Máximo 15 fotos"); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permiso de cámara requerido"); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.7 });
    if (!result.canceled && result.assets[0]?.uri) setManPhotos(prev => [...prev, result.assets[0].uri]);
  };

  const pickManPhoto = async () => {
    if (manPhotos.length >= 15) { Alert.alert("Máximo 15 fotos"); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permiso de galería requerido"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.7, allowsMultipleSelection: true, selectionLimit: 15 - manPhotos.length });
    if (!result.canceled) setManPhotos(prev => [...prev, ...result.assets.map(a => a.uri)]);
  };

  const submitBitacora = async () => {
    if (bitItems.length === 0) { Alert.alert("Agrega al menos un equipo a la bitácora"); return; }
    setBitSaving(true);
    try {
      // Upload photos
      let photoUrls: string[] = [];
      if (bitPhotos.length > 0) {
        const uploadBase = API_URL.replace("/mobile", "");
        for (const uri of bitPhotos) {
          try {
            const fd = new FormData();
            fd.append("file", { uri, name: `bit_${Date.now()}.jpg`, type: "image/jpeg" } as unknown as Blob);
            const r = await axios.post<{ url: string }>(`${uploadBase}/mobile/upload`, fd, {
              headers: { "Content-Type": "multipart/form-data" },
            });
            if (r.data?.url) photoUrls.push(r.data.url);
          } catch { /* skip */ }
        }
      }

      const items = bitItems.map(i => ({
        description: `${i.type}${i.capacidad ? ` ${i.capacidad}` : ""}${i.serial.trim() ? ` | SN: ${i.serial.trim()}` : ""}`,
        qty: i.qty,
      }));

      const summaryLine = `Bitácora de recarga — ${items.length} equipo(s): ${bitItems.map(i => i.type).join(", ")}`;
      const tecnicoLine = bitTecnico.trim() ? `\nTécnico: ${bitTecnico.trim()}` : "";
      const noteLine = bitNotes.trim() ? `\n${bitNotes.trim()}` : "";
      const photoLine = photoUrls.length > 0 ? `\nFotos: ${photoUrls.join(" | ")}` : "";

      const res = await axios.post<{ folio: string }>(`${API_URL}/mobile/taller`, {
        inspector_id: inspectorId,
        client_id: bitClientId || undefined,
        tipo: "Recarga de extintor",
        description: summaryLine + tecnicoLine + noteLine + photoLine,
        priority: "media",
        items,
      });
      Alert.alert("📋 Bitácora enviada al taller", `Folio: ${res.data?.folio}`, [
        { text: "OK", onPress: () => { setShowBit(false); resetBit(); load(true); } },
      ]);
    } catch {
      Alert.alert(
        "⚠️ Posible error de red",
        "La bitácora pudo haberse enviado. Verifica el historial antes de reintentarlo.",
        [{ text: "Cerrar formulario", onPress: () => { setShowBit(false); resetBit(); load(true); } }]
      );
    }
  };

  // ─── Item qty edit ──────────────────────────────────────────────────────────
  const updateItemQty = async (orderId: string, itemId: string, newQty: number) => {
    if (newQty < 1) return;
    try {
      await axios.patch(`${API_URL}/mobile/taller`, {
        id: orderId, action: "update_item_qty", item_id: itemId, qty: newQty,
      });
      setOrders(prev => prev.map(o =>
        o.id === orderId
          ? { ...o, items: o.items?.map(i => i.id === itemId ? { ...i, qty: newQty } : i) }
          : o
      ));
    } catch { Alert.alert("Error", "No se pudo actualizar la cantidad."); }
  };

  // ─── Resets ─────────────────────────────────────────────────────────────────
  const resetOT  = () => { setOtTipo(TIPOS_OT[0]); setOtDesc(""); setOtPrioridad("media"); setOtClientId(""); setSubmitting(false); };
  const resetPH  = () => {
    setPhEq(null); setPhCode(""); setPhCylType(""); setPhPressureClass("baja");
    setPhSerial(""); setPhCapacity(""); setPhYearMfg(""); setPhWorkPsi("");
    setPhTestPsi(""); setPhDuration("60"); setPhResult("PASS"); setPhCauseReject("");
    setPhObs(""); setPhBy(userName); setPhPhotos([]);
    setPhClientId(""); setPhClassification("DOT-3AL"); setPhBrand(""); setPhModel(""); setPhLastTestDate("");
    setPhSevereDent(false); setPhExcessCorrosion(false); setPhBaseCorrosion(false);
    setPhVolInitial(""); setPhVolTransient(""); setPhVolPermanent(""); setPhExpansionPct("");
    setPhHasDeformation(false); setPhHasPressureLoss(false);
    setPhReviewedBy(""); setPhNextTestDate(""); setPhOrderNumber(""); setPhSaving(false);
  };
  const resetMAN = () => { setManEq(null); setManCode(""); setManClientId(""); setManOrderNumber(""); setManHoseType("Manguera SCI"); setManDiameter('1.5"'); setManSerial(""); setManMfgMonth(""); setManMfgYear(""); setManLength(""); setManPressure("120"); setManResult("PASS"); setManObs(""); setManBy(userName); setManPhotos([]); setManSaving(false); };
  const resetBit = () => { setBitClientId(""); setBitItems([]); setBitNotes(""); setBitTecnico(userName); setBitPhotos([]); setBitSaving(false); };

  const FILTERS = ["all","abierta","en_proceso","cerrada"];
  const TIPO_FILTERS: { key: string; label: string }[] = [
    { key: "all",      label: "Todos los tipos" },
    { key: "ph",       label: "🔬 PH" },
    { key: "recarga",  label: "🔥 Recarga" },
    { key: "manguera", label: "🌊 Manguera" },
    { key: "manto",    label: "🔧 Mantenimiento" },
  ];
  const byStatus = filter === "all" ? orders : orders.filter(o => o.status === filter);
  const byTipo = tipoFilter === "all" ? byStatus : byStatus.filter(o => {
    const t = (o.tipo ?? "").toLowerCase();
    if (tipoFilter === "ph") return t.includes("hidrostática") || t.includes("hidro");
    if (tipoFilter === "recarga") return t.includes("recarga");
    if (tipoFilter === "manguera") return t.includes("manguera");
    if (tipoFilter === "manto") return t.includes("mantenimiento") || t.includes("reparación") || t.includes("inspección");
    return true;
  });
  const filtered = [...byTipo].sort((a, b) =>
    sortNewest
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // ─── Camera Overlay ─────────────────────────────────────────────────────────
  if (scanning) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <CameraView style={{ flex: 1 }} facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr","code128","code39","ean13","ean8","pdf417","aztec","datamatrix"] }}
          onBarcodeScanned={onBarcode} />
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
        <TouchableOpacity onPress={handleBack} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={s.navTitle}>🔧 Taller</Text>
          {!!userName && <Text style={s.navSub}>{userName}</Text>}
        </View>
        <View style={{ width: 60 }} />
      </LinearGradient>

      {/* Quick action row */}
      <View style={s.quickRow}>
        <TouchableOpacity style={[s.quickBtn, { borderColor: "#D9770044", backgroundColor: "#D977000A" }]} onPress={() => { resetBit(); addBitItem(); setShowBit(true); }}>
          <Text style={{ fontSize: 18 }}>📋</Text>
          <Text style={[s.quickTxt, { color: "#D97700" }]}>Bitácora</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.quickBtn, { borderColor: "#7C3AED44", backgroundColor: "#7C3AED0A" }]} onPress={() => { resetPH(); setShowPH(true); }}>
          <Text style={{ fontSize: 18 }}>🔬</Text>
          <Text style={[s.quickTxt, { color: "#7C3AED" }]}>Prueba PH</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.quickBtn, { borderColor: "#0891B244", backgroundColor: "#0891B20A" }]} onPress={() => { resetMAN(); setShowMAN(true); }}>
          <Text style={{ fontSize: 18 }}>🌊</Text>
          <Text style={[s.quickTxt, { color: "#0891B2" }]}>Manguera</Text>
        </TouchableOpacity>
      </View>

      {/* Filter tabs — row 1: status + sort */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.filterBar, { flex: 1 }]}>
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
        <TouchableOpacity
          onPress={() => setSortNewest(p => !p)}
          style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff", borderLeftWidth: 1, borderLeftColor: "#E2E8F5" }}>
          <Text style={{ fontSize: 16 }}>{sortNewest ? "⬇" : "⬆"}</Text>
          <Text style={{ fontSize: 9, color: "#6B84A8", textAlign: "center" }}>{sortNewest ? "Nuevo" : "Viejo"}</Text>
        </TouchableOpacity>
      </View>
      {/* Filter row 2: tipo */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, backgroundColor: "#F8FAFD" }}>
        <View style={[s.filterRow, { paddingVertical: 5 }]}>
          {TIPO_FILTERS.map(tf => {
            const active = tipoFilter === tf.key;
            return (
              <TouchableOpacity key={tf.key}
                style={[s.filterChip, { backgroundColor: active ? "#7C3AED" : "#fff", borderColor: active ? "#7C3AED" : "#E2E8F5", paddingVertical: 5 }]}
                onPress={() => setTipoFilter(tf.key)}>
                <Text style={[s.filterText, { fontSize: 11, color: active ? "#fff" : "#6B84A8" }]}>{tf.label}</Text>
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
            const cfg     = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.abierta;
            const next    = NEXT_STATUS[order.status];
            const nextCfg = next ? STATUS_CONFIG[next] : null;
            const isRecarga = order.tipo === "Recarga de extintor";

            return (
              <View key={order.id ?? String(idx)} style={[s.orderCard, { backgroundColor: "#fff", borderColor: isRecarga ? "#FDE68A" : "#E2E8F5", borderLeftWidth: isRecarga ? 3 : 1, borderLeftColor: isRecarga ? "#D97706" : "#E2E8F5" }]}>
                <View style={s.orderTop}>
                  <View style={[s.statusDot, { backgroundColor: cfg.color + "22", borderColor: cfg.color }]}>
                    <Text style={{ fontSize: 16 }}>{cfg.icon}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={[s.orderFolio, { color: "#122B60" }]}>{order.folio || "OT"}</Text>
                      {isRecarga && <View style={{ backgroundColor: "#FEF3C7", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontWeight: "800", color: "#92400E" }}>RECARGA</Text>
                      </View>}
                    </View>
                    <Text style={[s.orderTipo, { color: "#1A2740" }]}>{order.tipo || "Orden de trabajo"}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: cfg.color + "22" }]}>
                    <Text style={[s.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>

                <View style={[s.orderMeta, { borderColor: "#EEF2FB" }]}>
                  {!!order.client_name && <Text style={[s.metaLine, { color: "#6B84A8" }]}>🏢 {order.client_name}</Text>}
                  {!!order.notes && !isRecarga && <Text style={[s.metaLine, { color: "#6B84A8" }]} numberOfLines={2}>📝 {order.notes}</Text>}
                  <Text style={[s.metaDate, { color: "#B0BDCE" }]}>{new Date(order.created_at).toLocaleDateString("es-MX")}</Text>
                </View>

                {/* Items list for recarga orders */}
                {isRecarga && order.items && order.items.length > 0 && (
                  <View style={s.itemsList}>
                    <Text style={s.itemsTitle}>🔥 Equipos a recargar</Text>
                    {order.items.map((item: OTItem) => (
                      <View key={item.id} style={s.itemRow}>
                        <Text style={s.itemDesc} numberOfLines={1}>{item.description}</Text>
                        <View style={s.qtyRow}>
                          <TouchableOpacity onPress={() => updateItemQty(order.id, item.id, item.qty - 1)} style={s.qtyBtn}>
                            <Text style={{ color: "#1D4ED8", fontWeight: "900", fontSize: 16 }}>−</Text>
                          </TouchableOpacity>
                          <Text style={s.qtyNum}>{item.qty}</Text>
                          <TouchableOpacity onPress={() => updateItemQty(order.id, item.id, item.qty + 1)} style={s.qtyBtn}>
                            <Text style={{ color: "#1D4ED8", fontWeight: "900", fontSize: 16 }}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                    <Text style={{ fontSize: 10, color: "#9BACC8", marginTop: 6, fontStyle: "italic" }}>
                      Solo el taller puede cerrar esta orden. Puedes editar las cantidades.
                    </Text>
                  </View>
                )}

                {/* Status action — recarga orders cannot be closed from field */}
                {nextCfg && !(isRecarga && next === "cerrada") && (
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: nextCfg.color + "15", borderColor: nextCfg.color }]} onPress={() => handleUpdateStatus(order)} activeOpacity={0.75}>
                    <Text style={[s.actionText, { color: nextCfg.color }]}>{nextCfg.icon} Marcar como {nextCfg.label}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ─── Nueva OT Modal ────────────────────────────────────────────────── */}
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
              <FieldLabel style={{ marginTop: 14 }}>Cliente (opcional)</FieldLabel>
              <ClientSelector clients={clientes} value={otClientId} onChange={setOtClientId} onCreated={addClient} />
              <FieldLabel style={{ marginTop: 14 }}>Descripción *</FieldLabel>
              <UpperInput style={s.textArea} value={otDesc} onChangeText={v => setOtDesc(v.toUpperCase())} autoCapitalize="characters" placeholder="DESCRIBE EL TRABAJO A REALIZAR..." placeholderTextColor="#6B7CA3" multiline numberOfLines={4} textAlignVertical="top" />
              <View style={{ height: 16 }} />
              <SubmitBtn label="Crear y enviar al taller" onPress={handleCreateOT} loading={submitting} />
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Bitácora de Recarga Modal ─────────────────────────────────────── */}
      <Modal visible={showBit} animationType="slide" transparent statusBarTranslucent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowBit(false)} />
          <View style={[s.modalCard, { maxHeight: "95%" }]}>
            <ModalHeader title="📋 Bitácora de Recarga" onClose={() => setShowBit(false)} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={s.bitInfoBox}>
                <Text style={{ fontSize: 12, color: "#92400E", fontWeight: "600", lineHeight: 18 }}>
                  Registra los extintores o equipos que llevas al taller para recargar.
                  Una vez enviada, solo el taller puede cerrarla.
                </Text>
              </View>

              {/* Client */}
              <FieldLabel>Cliente (opcional)</FieldLabel>
              <ClientSelector clients={clientes} value={bitClientId} onChange={setBitClientId} onCreated={addClient} />

              {/* Items */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, marginBottom: 8 }}>
                <FieldLabel>Equipos a recargar *</FieldLabel>
                <TouchableOpacity onPress={addBitItem} style={s.addItemBtn}>
                  <Text style={{ color: "#1D4ED8", fontWeight: "700", fontSize: 13 }}>+ Agregar</Text>
                </TouchableOpacity>
              </View>

              {bitItems.length === 0 && (
                <Text style={{ fontSize: 13, color: "#9BACC8", textAlign: "center", paddingVertical: 12, fontStyle: "italic" }}>
                  Toca "+ Agregar" para agregar equipos
                </Text>
              )}

              {bitItems.map((item, idx) => (
                <View key={item.uid} style={s.bitItemCard}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <Text style={{ fontWeight: "700", color: "#122B60", fontSize: 13, flex: 1 }}>Equipo #{idx + 1}</Text>
                    <TouchableOpacity onPress={() => removeBitItem(item.uid)} style={{ padding: 4 }}>
                      <Text style={{ color: "#EF4444", fontSize: 16, fontWeight: "700" }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
                    {TIPOS_EQUIPO.map(t => (
                      <Chip key={t} label={t} selected={item.type === t} onPress={() => updateBitItem(item.uid, "type", t)} />
                    ))}
                  </ScrollView>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#5A6E8C", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Capacidad</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
                    {CAPACIDADES.map(c => (
                      <Chip key={c} label={c} selected={item.capacidad === c} onPress={() => updateBitItem(item.uid, "capacidad", item.capacidad === c ? "" : c)} />
                    ))}
                  </ScrollView>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <UpperInput
                      style={[s.textInput, { flex: 2 }]}
                      value={item.serial}
                      onChangeText={v => updateBitItem(item.uid, "serial", v)}
                      placeholder="No. serie (opcional)"
                      placeholderTextColor="#6B7CA3"
                      autoCapitalize="characters"
                    />
                    <View style={s.qtyRow}>
                      <TouchableOpacity onPress={() => updateBitItem(item.uid, "qty", Math.max(1, item.qty - 1))} style={s.qtyBtn}>
                        <Text style={{ color: "#1D4ED8", fontWeight: "900", fontSize: 16 }}>−</Text>
                      </TouchableOpacity>
                      <Text style={s.qtyNum}>{item.qty}</Text>
                      <TouchableOpacity onPress={() => updateBitItem(item.uid, "qty", item.qty + 1)} style={s.qtyBtn}>
                        <Text style={{ color: "#1D4ED8", fontWeight: "900", fontSize: 16 }}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}

              {/* Photos */}
              <FieldLabel style={{ marginTop: 12 }}>Fotos de bitácora en papel (opcional)</FieldLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {bitPhotos.map((uri, i) => (
                    <View key={i} style={{ position: "relative" }}>
                      <Image source={{ uri }} style={s.photoThumb} />
                      <TouchableOpacity
                        style={s.photoRemove}
                        onPress={() => setBitPhotos(p => p.filter((_, j) => j !== i))}
                      >
                        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  {bitPhotos.length < 4 && <>
                    <TouchableOpacity style={s.photoAdd} onPress={takeBitPhoto}>
                      <Text style={{ fontSize: 22 }}>📷</Text>
                      <Text style={{ fontSize: 10, color: "#6B84A8", marginTop: 2 }}>Cámara</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.photoAdd} onPress={pickBitPhoto}>
                      <Text style={{ fontSize: 22 }}>🖼️</Text>
                      <Text style={{ fontSize: 10, color: "#6B84A8", marginTop: 2 }}>Galería</Text>
                    </TouchableOpacity>
                  </>}
                </View>
              </ScrollView>

              {/* Técnico */}
              <FieldLabel style={{ marginTop: 12 }}>Técnico que realiza la recarga</FieldLabel>
              <UpperInput
                style={s.textInput}
                value={bitTecnico}
                onChangeText={setBitTecnico}
                placeholder="Nombre del técnico..."
                placeholderTextColor="#6B7CA3"
                autoCapitalize="words"
              />

              {/* Notes */}
              <FieldLabel style={{ marginTop: 12 }}>Observaciones</FieldLabel>
              <UpperInput
                style={s.textArea}
                value={bitNotes}
                onChangeText={setBitNotes}
                placeholder="Observaciones, datos del cliente, notas adicionales..."
                placeholderTextColor="#6B7CA3"
                multiline numberOfLines={3}
                textAlignVertical="top"
              />
              <View style={{ height: 8 }} />
            </ScrollView>
            <View style={[s.modalFooter, { paddingBottom: Math.max(20, insets.bottom + 10) }]}>
              <SubmitBtn label={`Enviar bitácora al taller (${bitItems.length} equipo${bitItems.length !== 1 ? "s" : ""})`} onPress={submitBitacora} loading={bitSaving} color="#D97700" />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Prueba PH Modal ───────────────────────────────────────────────── */}
      <Modal visible={showPH} animationType="slide" transparent statusBarTranslucent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowPH(false)} />
          <View style={s.modalCard}>
            <ModalHeader title="🔬 Prueba Hidrostática" onClose={() => setShowPH(false)} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <FieldLabel>Código del equipo</FieldLabel>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <UpperInput style={[s.textInput, { flex: 1, fontFamily: "monospace" }]} value={phCode} onChangeText={setPhCode} placeholder="Ingresa o escanea el código..." placeholderTextColor="#6B7CA3" autoCapitalize="characters" onSubmitEditing={() => lookupEquipment(phCode, "ph")} />
                <TouchableOpacity style={s.scanBtn} onPress={() => openCamera("ph")}><Text style={{ fontSize: 22 }}>📷</Text></TouchableOpacity>
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
              <FieldLabel style={{ marginTop: 12 }}>Cliente</FieldLabel>
              <ClientSelector clients={clientes} value={phClientId} onChange={setPhClientId} onCreated={addClient} />
              {/* Clasificación de presión */}
              <FieldLabel style={{ marginTop: 12 }}>Clasificación *</FieldLabel>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  style={[s.resultBtn, { borderColor: "#0891B2", backgroundColor: phPressureClass === "baja" ? "#0891B2" : "#F0F9FF" }]}
                  onPress={() => setPhPressureClass("baja")}
                >
                  <Text style={{ fontWeight: "800", fontSize: 13, color: phPressureClass === "baja" ? "#fff" : "#0891B2" }}>⬇ BAJA PRESIÓN</Text>
                  <Text style={{ fontSize: 10, color: phPressureClass === "baja" ? "rgba(255,255,255,0.7)" : "#64748B", marginTop: 2 }}>≤ 500 PSI</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.resultBtn, { borderColor: "#DC2626", backgroundColor: phPressureClass === "alta" ? "#DC2626" : "#FFF1F2" }]}
                  onPress={() => setPhPressureClass("alta")}
                >
                  <Text style={{ fontWeight: "800", fontSize: 13, color: phPressureClass === "alta" ? "#fff" : "#DC2626" }}>⬆ ALTA PRESIÓN</Text>
                  <Text style={{ fontSize: 10, color: phPressureClass === "alta" ? "rgba(255,255,255,0.7)" : "#64748B", marginTop: 2 }}>&gt; 500 PSI</Text>
                </TouchableOpacity>
              </View>

              <FieldLabel style={{ marginTop: 12 }}>Tipo / Agente del cilindro *</FieldLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={{ gap: 6, marginBottom: 6 }}>
                {["PQS","CO₂","SCBA","Agua","AFFF","HCFC","N₂","Halón","Otro"].map(t => (
                  <Chip key={t} label={t} selected={phCylType === t} onPress={() => setPhCylType(t)} />
                ))}
              </ScrollView>
              <UpperInput style={s.textInput} value={phCylType} onChangeText={setPhCylType} placeholder="O escribe el tipo..." placeholderTextColor="#6B7CA3" />

              <FieldLabel style={{ marginTop: 12 }}>Clasificación DOT</FieldLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={{ gap: 6, marginBottom: 6 }}>
                {["DOT-3AL","DOT-3A","DOT-3AA","DOT-4B","DOT-4BW","DOT-4BA","DOT-4L","DOT-3"].map(d => (
                  <Chip key={d} label={d} selected={phClassification === d} onPress={() => setPhClassification(d)} />
                ))}
              </ScrollView>
              <UpperInput style={s.textInput} value={phClassification} onChangeText={setPhClassification} placeholder="DOT-3AL" placeholderTextColor="#6B7CA3" autoCapitalize="characters" />

              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Marca</FieldLabel>
                  <UpperInput style={s.textInput} value={phBrand} onChangeText={setPhBrand} placeholder="LUXFER, WORTHINGTON..." placeholderTextColor="#6B7CA3" autoCapitalize="characters" />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Modelo</FieldLabel>
                  <UpperInput style={s.textInput} value={phModel} onChangeText={setPhModel} placeholder="Modelo / No. parte" placeholderTextColor="#6B7CA3" autoCapitalize="characters" />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>No. de serie</FieldLabel>
                  <UpperInput style={s.textInput} value={phSerial} onChangeText={setPhSerial} placeholder="SN-12345" placeholderTextColor="#6B7CA3" autoCapitalize="characters" />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Capacidad</FieldLabel>
                  <UpperInput style={s.textInput} value={phCapacity} onChangeText={setPhCapacity} placeholder="10 LBS, 6 KG..." placeholderTextColor="#6B7CA3" />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Año fabricación</FieldLabel>
                  <UpperInput style={s.textInput} value={phYearMfg} onChangeText={setPhYearMfg} keyboardType="numeric" placeholder="2018" placeholderTextColor="#6B7CA3" />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Duración ensayo (seg)</FieldLabel>
                  <UpperInput style={s.textInput} value={phDuration} onChangeText={setPhDuration} keyboardType="numeric" placeholder="60" placeholderTextColor="#6B7CA3" />
                </View>
              </View>
              <FieldLabel style={{ marginTop: 12 }}>Último ensayo realizado</FieldLabel>
              <UpperInput style={s.textInput} value={phLastTestDate} onChangeText={setPhLastTestDate} placeholder="2020-06-15 o 'Primera prueba'" placeholderTextColor="#6B7CA3" />

              {/* Pre-inspección visual */}
              <View style={[s.sectionBox, { marginTop: 14 }]}>
                <Text style={s.sectionBoxTitle}>PRE-INSPECCIÓN VISUAL</Text>
                {([
                  { label: "¿Golpe severo en cilindro?", val: phSevereDent,       set: setPhSevereDent },
                  { label: "¿Corrosión excesiva?",       val: phExcessCorrosion,  set: setPhExcessCorrosion },
                  { label: "¿Corrosión en la base?",     val: phBaseCorrosion,    set: setPhBaseCorrosion },
                ] as { label: string; val: boolean; set: (v: boolean) => void }[]).map(({ label, val, set }) => (
                  <View key={label} style={s.yesNoRow}>
                    <Text style={s.yesNoLabel}>{label}</Text>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <TouchableOpacity style={[s.yesNoBtn, { backgroundColor: val ? "#DC2626" : "#F0F4FB", borderColor: val ? "#DC2626" : "#D5DCF0" }]} onPress={() => set(true)}>
                        <Text style={{ fontWeight: "800", fontSize: 11, color: val ? "#fff" : "#6B84A8" }}>SÍ</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.yesNoBtn, { backgroundColor: !val ? "#059669" : "#F0F4FB", borderColor: !val ? "#059669" : "#D5DCF0" }]} onPress={() => set(false)}>
                        <Text style={{ fontWeight: "800", fontSize: 11, color: !val ? "#fff" : "#6B84A8" }}>NO</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Presión trabajo (PSI) *</FieldLabel>
                  <UpperInput style={s.textInput} value={phWorkPsi} onChangeText={setPhWorkPsi} keyboardType="numeric" placeholder={phPressureClass === "alta" ? "2015" : "150"} placeholderTextColor="#6B7CA3" />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Presión prueba (PSI) *</FieldLabel>
                  <UpperInput style={s.textInput} value={phTestPsi} onChangeText={setPhTestPsi} keyboardType="numeric" placeholder={phPressureClass === "alta" ? "3360" : "225"} placeholderTextColor="#6B7CA3" />
                </View>
              </View>
              {phPressureClass === "alta" && (
                <Text style={{ fontSize: 11, color: "#7C3AED", marginTop: 4, fontStyle: "italic" }}>
                  Alta presión: presión de prueba = 5/3 × presión de trabajo (DOT)
                </Text>
              )}
              {phPressureClass === "baja" && (
                <Text style={{ fontSize: 11, color: "#0891B2", marginTop: 4, fontStyle: "italic" }}>
                  Baja presión: presión de prueba = 1.5 × presión de trabajo (NOM-002)
                </Text>
              )}

              {/* Datos de expansión volumétrica — solo alta presión */}
              {phPressureClass === "alta" && (
                <View style={[s.sectionBox, { marginTop: 14, borderColor: "#7C3AED33" }]}>
                  <Text style={[s.sectionBoxTitle, { color: "#7C3AED" }]}>EXPANSIÓN VOLUMÉTRICA</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <FieldLabel>Vol. inicial (ml)</FieldLabel>
                      <UpperInput style={s.textInput} value={phVolInitial} onChangeText={setPhVolInitial} keyboardType="numeric" placeholder="0.0" placeholderTextColor="#6B7CA3" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <FieldLabel>Exp. transitoria (ml)</FieldLabel>
                      <UpperInput style={s.textInput} value={phVolTransient} onChangeText={setPhVolTransient} keyboardType="numeric" placeholder="0.0" placeholderTextColor="#6B7CA3" />
                    </View>
                  </View>
                  <View style={{ marginTop: 8 }}>
                    <FieldLabel>Exp. permanente (ml)</FieldLabel>
                    <UpperInput style={s.textInput} value={phVolPermanent} onChangeText={setPhVolPermanent} keyboardType="numeric" placeholder="0.0" placeholderTextColor="#6B7CA3" />
                  </View>
                  <View style={s.calcBox}>
                    <Text style={s.calcLabel}>% Expansión = Perm. ÷ Trans. × 100</Text>
                    <Text style={[s.calcValue, { color: Number(phExpansionPct) > 0.1 ? "#DC2626" : "#059669" }]}>
                      {phExpansionPct || "0.000"} %
                    </Text>
                    <Text style={{ fontSize: 9, color: "#94A3B8", marginTop: 2 }}>NOM permisible: ≤ 0.1% · Editable si hay diferencia</Text>
                    <UpperInput style={[s.textInput, { marginTop: 6 }]} value={phExpansionPct} onChangeText={setPhExpansionPct} keyboardType="numeric" placeholder="0.000" placeholderTextColor="#6B7CA3" />
                  </View>
                </View>
              )}

              {/* Baja presión: deformación y pérdida de presión */}
              {phPressureClass === "baja" && (
                <View style={[s.sectionBox, { marginTop: 14, borderColor: "#0891B233" }]}>
                  <Text style={[s.sectionBoxTitle, { color: "#0891B2" }]}>DURANTE EL ENSAYO</Text>
                  {([
                    { label: "¿Deformación durante la prueba?", val: phHasDeformation,  set: setPhHasDeformation },
                    { label: "¿Pérdida de presión?",            val: phHasPressureLoss, set: setPhHasPressureLoss },
                  ] as { label: string; val: boolean; set: (v: boolean) => void }[]).map(({ label, val, set }) => (
                    <View key={label} style={s.yesNoRow}>
                      <Text style={s.yesNoLabel}>{label}</Text>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <TouchableOpacity style={[s.yesNoBtn, { backgroundColor: val ? "#DC2626" : "#F0F4FB", borderColor: val ? "#DC2626" : "#D5DCF0" }]} onPress={() => set(true)}>
                          <Text style={{ fontWeight: "800", fontSize: 11, color: val ? "#fff" : "#6B84A8" }}>SÍ</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.yesNoBtn, { backgroundColor: !val ? "#059669" : "#F0F4FB", borderColor: !val ? "#059669" : "#D5DCF0" }]} onPress={() => set(false)}>
                          <Text style={{ fontWeight: "800", fontSize: 11, color: !val ? "#fff" : "#6B84A8" }}>NO</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <FieldLabel style={{ marginTop: 14 }}>Resultado *</FieldLabel>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity style={[s.resultBtn, { borderColor: "#22C55E", backgroundColor: phResult === "PASS" ? "#22C55E" : "#F0FDF4" }]} onPress={() => setPhResult("PASS")}>
                  <Text style={{ fontWeight: "800", color: phResult === "PASS" ? "#fff" : "#15803D" }}>✓ APROBADA</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.resultBtn, { borderColor: "#EF4444", backgroundColor: phResult === "FAIL" ? "#EF4444" : "#FFF1F2" }]} onPress={() => setPhResult("FAIL")}>
                  <Text style={{ fontWeight: "800", color: phResult === "FAIL" ? "#fff" : "#DC2626" }}>✗ RECHAZADA</Text>
                </TouchableOpacity>
              </View>
              {phResult === "FAIL" && (
                <>
                  <FieldLabel style={{ marginTop: 12 }}>Causa de rechazo *</FieldLabel>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
                    {["Abolladuras","Corrosión excesiva","Pérdida de presión","Deformación","Base corroída","Fuga detectada","Expansión excesiva","Otro"].map(c => (
                      <Chip key={c} label={c} selected={phCauseReject === c} onPress={() => setPhCauseReject(c)} />
                    ))}
                  </ScrollView>
                  <UpperInput style={s.textInput} value={phCauseReject} onChangeText={setPhCauseReject} placeholder="O escribe la causa..." placeholderTextColor="#6B7CA3" />
                </>
              )}
              <FieldLabel style={{ marginTop: 12 }}>Observaciones</FieldLabel>
              <UpperInput style={s.textArea} value={phObs} onChangeText={setPhObs} placeholder="Condiciones del ensayo, notas..." placeholderTextColor="#6B7CA3" multiline numberOfLines={3} textAlignVertical="top" />
              <FieldLabel style={{ marginTop: 12 }}>No. Bitácora / Orden</FieldLabel>
              <UpperInput style={s.textInput} value={phOrderNumber} onChangeText={setPhOrderNumber} placeholder="Ej. OT-2026-0045" placeholderTextColor="#6B7CA3" />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Técnico que realizó</FieldLabel>
                  <UpperInput style={s.textInput} value={phBy} onChangeText={setPhBy} placeholder="Nombre del técnico" placeholderTextColor="#6B7CA3" />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Revisado por</FieldLabel>
                  <UpperInput style={s.textInput} value={phReviewedBy} onChangeText={setPhReviewedBy} placeholder="Supervisor / Ing." placeholderTextColor="#6B7CA3" />
                </View>
              </View>
              <FieldLabel style={{ marginTop: 12 }}>Próxima prueba (fecha)</FieldLabel>
              <UpperInput style={s.textInput} value={phNextTestDate} onChangeText={setPhNextTestDate} placeholder="2030-06-15" placeholderTextColor="#6B7CA3" />
              <FieldLabel style={{ marginTop: 12 }}>Fotos de evidencia ({phPhotos.length}/15)</FieldLabel>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
                <TouchableOpacity onPress={takePhPhoto} style={{ flex: 1, backgroundColor: "#7C3AED11", borderRadius: 8, borderWidth: 1, borderColor: "#7C3AED44", paddingVertical: 10, alignItems: "center" }}>
                  <Text style={{ fontSize: 20 }}>📷</Text>
                  <Text style={{ fontSize: 11, color: "#7C3AED", fontWeight: "700", marginTop: 2 }}>Cámara</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={pickPhPhoto} style={{ flex: 1, backgroundColor: "#7C3AED11", borderRadius: 8, borderWidth: 1, borderColor: "#7C3AED44", paddingVertical: 10, alignItems: "center" }}>
                  <Text style={{ fontSize: 20 }}>🖼</Text>
                  <Text style={{ fontSize: 11, color: "#7C3AED", fontWeight: "700", marginTop: 2 }}>Galería</Text>
                </TouchableOpacity>
              </View>
              {phPhotos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {phPhotos.map((uri, i) => (
                      <View key={i} style={{ position: "relative" }}>
                        <Image source={{ uri }} style={{ width: 64, height: 64, borderRadius: 8 }} />
                        <TouchableOpacity onPress={() => setPhPhotos(prev => prev.filter((_, j) => j !== i))}
                          style={{ position: "absolute", top: -6, right: -6, backgroundColor: "#EF4444", borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
              <View style={{ height: 8 }} />
            </ScrollView>
            <View style={[s.modalFooter, { paddingBottom: Math.max(20, insets.bottom + 10) }]}>
              <SubmitBtn label="Guardar prueba hidrostática" onPress={submitPH} loading={phSaving} color="#7C3AED" />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Prueba Manguera Modal ─────────────────────────────────────────── */}
      <Modal visible={showMAN} animationType="slide" transparent statusBarTranslucent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowMAN(false)} />
          <View style={s.modalCard}>
            <ModalHeader title="🌊 Prueba de Manguera" onClose={() => setShowMAN(false)} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <FieldLabel>Código del equipo</FieldLabel>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <UpperInput style={[s.textInput, { flex: 1, fontFamily: "monospace" }]} value={manCode} onChangeText={setManCode} placeholder="Ingresa o escanea el código..." placeholderTextColor="#6B7CA3" autoCapitalize="characters" onSubmitEditing={() => lookupEquipment(manCode, "man")} />
                <TouchableOpacity style={s.scanBtn} onPress={() => openCamera("man")}><Text style={{ fontSize: 22 }}>📷</Text></TouchableOpacity>
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
              <FieldLabel style={{ marginTop: 12 }}>Cliente</FieldLabel>
              <ClientSelector clients={clientes} value={manClientId} onChange={setManClientId} onCreated={addClient} />

              <FieldLabel style={{ marginTop: 12 }}>Tipo de manguera</FieldLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={{ gap: 6, marginBottom: 6 }}>
                {["Manguera SCI", "Manguera de Descarga", "Manguera Plana", "Manguera Agrícola", "Otro"].map(t => (
                  <Chip key={t} label={t} selected={manHoseType === t} onPress={() => setManHoseType(t)} />
                ))}
              </ScrollView>
              <UpperInput style={s.textInput} value={manHoseType} onChangeText={setManHoseType} placeholder="O escribe el tipo..." placeholderTextColor="#6B7CA3" />

              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>No. de serie / ID</FieldLabel>
                  <UpperInput style={s.textInput} value={manSerial} onChangeText={setManSerial} placeholder="Ej. MAN-001" placeholderTextColor="#6B7CA3" autoCapitalize="characters" />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Fab. Mes / Año</FieldLabel>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <UpperInput style={[s.textInput, { flex: 1 }]} value={manMfgMonth} onChangeText={v => setManMfgMonth(v.replace(/\D/g, "").slice(0, 2))} placeholder="MM" placeholderTextColor="#6B7CA3" keyboardType="numeric" maxLength={2} />
                    <UpperInput style={[s.textInput, { flex: 2 }]} value={manMfgYear} onChangeText={v => setManMfgYear(v.replace(/\D/g, "").slice(0, 4))} placeholder="AAAA" placeholderTextColor="#6B7CA3" keyboardType="numeric" maxLength={4} />
                  </View>
                </View>
              </View>

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
                  <UpperInput style={s.textInput} value={manLength} onChangeText={setManLength} keyboardType="numeric" placeholder="15" placeholderTextColor="#6B7CA3" />
                </View>
              </View>
              <FieldLabel style={{ marginTop: 12 }}>Presión de prueba (lbs) *</FieldLabel>
              <UpperInput style={s.textInput} value={manPressure} onChangeText={setManPressure} keyboardType="numeric" placeholder="120" placeholderTextColor="#6B7CA3" />
              <FieldLabel style={{ marginTop: 12 }}>Resultado *</FieldLabel>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity style={[s.resultBtn, { borderColor: "#22C55E", backgroundColor: manResult === "PASS" ? "#22C55E" : "#F0FDF4" }]} onPress={() => setManResult("PASS")}>
                  <Text style={{ fontWeight: "800", color: manResult === "PASS" ? "#fff" : "#15803D" }}>✓ APROBADA</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.resultBtn, { borderColor: "#EF4444", backgroundColor: manResult === "FAIL" ? "#EF4444" : "#FFF1F2" }]} onPress={() => setManResult("FAIL")}>
                  <Text style={{ fontWeight: "800", color: manResult === "FAIL" ? "#fff" : "#DC2626" }}>✗ RECHAZADA</Text>
                </TouchableOpacity>
              </View>
              <FieldLabel style={{ marginTop: 12 }}>No. Bitácora / Orden</FieldLabel>
              <UpperInput style={s.textInput} value={manOrderNumber} onChangeText={setManOrderNumber} placeholder="Ej. OT-2026-0045" placeholderTextColor="#6B7CA3" />
              <FieldLabel style={{ marginTop: 12 }}>Observaciones</FieldLabel>
              <UpperInput style={s.textArea} value={manObs} onChangeText={setManObs} placeholder="Fugas, deformaciones, notas..." placeholderTextColor="#6B7CA3" multiline numberOfLines={3} textAlignVertical="top" />
              <FieldLabel style={{ marginTop: 12 }}>Técnico que realizó</FieldLabel>
              <UpperInput style={s.textInput} value={manBy} onChangeText={setManBy} placeholder="Nombre del técnico" placeholderTextColor="#6B7CA3" />
              <FieldLabel style={{ marginTop: 12 }}>Fotos de evidencia ({manPhotos.length}/15)</FieldLabel>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
                <TouchableOpacity onPress={takeManPhoto} style={{ flex: 1, backgroundColor: "#0891B211", borderRadius: 8, borderWidth: 1, borderColor: "#0891B244", paddingVertical: 10, alignItems: "center" }}>
                  <Text style={{ fontSize: 20 }}>📷</Text>
                  <Text style={{ fontSize: 11, color: "#0891B2", fontWeight: "700", marginTop: 2 }}>Cámara</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={pickManPhoto} style={{ flex: 1, backgroundColor: "#0891B211", borderRadius: 8, borderWidth: 1, borderColor: "#0891B244", paddingVertical: 10, alignItems: "center" }}>
                  <Text style={{ fontSize: 20 }}>🖼</Text>
                  <Text style={{ fontSize: 11, color: "#0891B2", fontWeight: "700", marginTop: 2 }}>Galería</Text>
                </TouchableOpacity>
              </View>
              {manPhotos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {manPhotos.map((uri, i) => (
                      <View key={i} style={{ position: "relative" }}>
                        <Image source={{ uri }} style={{ width: 64, height: 64, borderRadius: 8 }} />
                        <TouchableOpacity onPress={() => setManPhotos(prev => prev.filter((_, j) => j !== i))}
                          style={{ position: "absolute", top: -6, right: -6, backgroundColor: "#EF4444", borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
              <View style={{ height: 8 }} />
            </ScrollView>
            <View style={[s.modalFooter, { paddingBottom: Math.max(20, insets.bottom + 10) }]}>
              <SubmitBtn label="Guardar prueba de manguera" onPress={submitMAN} loading={manSaving} color="#0891B2" />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  backArrow:   { color: "#93C5FD", fontSize: 22, fontWeight: "700" },
  navTitle:    { color: "#fff", fontSize: 17, fontWeight: "800" },
  navSub:      { color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 1 },
  newOtBtn:    { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  newOtText:   { color: "#fff", fontSize: 13, fontWeight: "700" },
  quickRow:    { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#F0F4FA" },
  quickBtn:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5 },
  quickTxt:    { fontSize: 12, fontWeight: "700" },
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
  // Items list
  itemsList:   { marginTop: 10, borderTopWidth: 1, borderTopColor: "#FDE68A", paddingTop: 10, backgroundColor: "#FFFBEB", borderRadius: 8, padding: 10 },
  itemsTitle:  { fontSize: 11, fontWeight: "800", color: "#92400E", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 },
  itemRow:     { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  itemDesc:    { flex: 1, fontSize: 13, color: "#1A2740", fontWeight: "600" },
  qtyRow:      { flexDirection: "row", alignItems: "center", backgroundColor: "#EFF6FF", borderRadius: 8, overflow: "hidden" },
  qtyBtn:      { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  qtyNum:      { width: 28, textAlign: "center", fontWeight: "900", fontSize: 14, color: "#1E3A5F" },
  // Bitácora
  bitInfoBox:  { backgroundColor: "#FEF3C7", borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: "#FDE68A" },
  bitItemCard: { backgroundColor: "#F0F4FB", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#D5DCF0" },
  addItemBtn:  { backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#BFDBFE" },
  // Photos
  photoThumb:  { width: 72, height: 72, borderRadius: 10 },
  photoRemove: { position: "absolute", top: 2, right: 2, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 10, width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  photoAdd:    { width: 72, height: 72, borderRadius: 10, backgroundColor: "#F0F4FB", borderWidth: 1.5, borderColor: "#D5DCF0", alignItems: "center", justifyContent: "center", borderStyle: "dashed" },
  // Section boxes for PH modal
  sectionBox:     { backgroundColor: "#F8FAFD", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#D5DCF0" },
  sectionBoxTitle:{ fontSize: 10, fontWeight: "900", color: "#5A6E8C", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  yesNoRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  yesNoLabel:     { flex: 1, fontSize: 12, color: "#1A2740", fontWeight: "600", paddingRight: 8 },
  yesNoBtn:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5, minWidth: 40, alignItems: "center" },
  calcBox:        { backgroundColor: "#EDE9FE", borderRadius: 10, padding: 10, marginTop: 10, borderWidth: 1, borderColor: "#C4B5FD" },
  calcLabel:      { fontSize: 10, fontWeight: "700", color: "#6D28D9", textTransform: "uppercase", letterSpacing: 0.5 },
  calcValue:      { fontSize: 22, fontWeight: "900", marginTop: 4 },
  // Modal
  modalCard:   { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 0, maxHeight: "93%" },
  modalFooter: { paddingTop: 10, paddingBottom: 20, borderTopWidth: 1, borderTopColor: "#EEF2FB" },
  textInput:   { backgroundColor: "#F0F4FB", borderRadius: 10, borderWidth: 1.5, borderColor: "#D5DCF0", paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: "#1A2740" },
  textArea:    { backgroundColor: "#F0F4FB", borderRadius: 12, borderWidth: 1.5, borderColor: "#D5DCF0", paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#1A2740", minHeight: 90, paddingTop: 12 },
  scanBtn:     { width: 46, height: 46, borderRadius: 10, backgroundColor: "#F0F4FB", borderWidth: 1.5, borderColor: "#D5DCF0", alignItems: "center", justifyContent: "center" },
  eqBanner:    { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8 },
  resultBtn:   { flex: 1, borderWidth: 2, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
});
