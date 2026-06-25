import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Image,
  KeyboardAvoidingView, Platform, FlatList,
} from "react-native";
import { UpperInput } from "../components/UpperInput";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions } from "expo-camera";
import axios from "axios";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList, Levantamiento, Cliente, Sucursal } from "../types";
import { API_URL } from "../constants/api";
import { useTheme } from "../hooks/useTheme";
import DatePickerField from "../components/DatePickerField";
import { queueRequest } from "../hooks/useOfflineSync";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Levantamiento">;
  route: { params: { inspectorId: string } };
};

type Step = "list" | "header" | "puntos" | "camera";

const TIPOS_EXTINTOR = ["PQS ABC", "CO2", "Agua", "Clase K", "Halón", "Espuma", "Polvo BC"];
const CAPS_EXTINTOR = ["1 KG", "2.5 KG", "4 KG", "4.5 KG", "6 KG", "9 KG", "12 KG", "20 KG", "2.5 LB", "5 LB", "10 LB", "2.5 GAL", "2.5 KG CO2", "5 KG CO2", "10 KG CO2", "1.5 LT", "2 LT", "2.5 LT", "6 LT", "9 LT", "9.5 LT", "10 LT", "20 LT", "1 GAL", "2 GAL"];
const TIPO_LINEA = ["Vertical", "Horizontal"];
const OK_OPTS = ["OK", "MAL", "N/A"];
const SI_NO = ["SI", "NO", "N/A"];

const EQ_TYPES = [
  { value: "extintor",                  label: "Extintor" },
  { value: "linea_vida",               label: "Línea de Vida" },
  { value: "hidrante",                 label: "Hidrante / Manguera" },
  { value: "sistema_incendio",         label: "Sist. Incendio" },
  { value: "co2_nfpa12",              label: "CO₂ (NFPA 12)" },
  { value: "rociadores_nfpa13",        label: "Rociadores (NFPA 13)" },
  { value: "espuma_nfpa16",            label: "Espuma AFFF (NFPA 16)" },
  { value: "bomba_ci_nfpa20",          label: "Bomba CI (NFPA 20)" },
  { value: "alarma_nfpa72",            label: "Alarma (NFPA 72)" },
  { value: "supresion_cocinas_nfpa96", label: "Supresión Cocinas (NFPA 96)" },
  { value: "agente_limpio_nfpa2001",   label: "Agente Limpio (NFPA 2001)" },
  { value: "era",                      label: "ERA" },
  { value: "otro",                     label: "Otro" },
];

const EQ_LABELS: Record<string, string> = {
  extintor:                  "Extintor",
  linea_vida:               "Equipo",
  hidrante:                 "Punto",
  sistema_incendio:         "Punto",
  co2_nfpa12:              "Punto",
  rociadores_nfpa13:        "Punto",
  espuma_nfpa16:            "Punto",
  bomba_ci_nfpa20:          "Punto",
  alarma_nfpa72:            "Punto",
  supresion_cocinas_nfpa96: "Punto",
  agente_limpio_nfpa2001:   "Punto",
  era:                      "ERA",
  otro:                     "Equipo",
};

function OKPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const T = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {OK_OPTS.map(o => (
        <TouchableOpacity key={o} onPress={() => onChange(o)}
          style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
            backgroundColor: value === o ? (o === "OK" ? "#22C55E" : o === "MAL" ? "#EF4444" : "#6B7280") : T.card,
            borderWidth: 1, borderColor: value === o ? "transparent" : T.border }}>
          <Text style={{ color: value === o ? "#fff" : T.textSub, fontSize: 11, fontWeight: "700" }}>{o}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function SIPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const T = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {SI_NO.map(o => (
        <TouchableOpacity key={o} onPress={() => onChange(o)}
          style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
            backgroundColor: value === o ? (o === "SI" ? "#22C55E" : o === "NO" ? "#EF4444" : "#6B7280") : T.card,
            borderWidth: 1, borderColor: value === o ? "transparent" : T.border }}>
          <Text style={{ color: value === o ? "#fff" : T.textSub, fontSize: 11, fontWeight: "700" }}>{o}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  const T = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: T.textSub, textTransform: "uppercase",
        letterSpacing: 0.5, marginBottom: 7 }}>{label}</Text>
      {children}
    </View>
  );
}

function Inp({ value, onChange, placeholder, multiline }: {
  value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  const T = useTheme();
  return (
    <UpperInput
      value={value} onChangeText={v => onChange(v.toUpperCase())} placeholder={placeholder ? placeholder.toUpperCase() : ""}
      placeholderTextColor={T.textSub} multiline={multiline} autoCapitalize="characters"
      style={{ backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: T.text,
        minHeight: multiline ? 70 : undefined, textAlignVertical: multiline ? "top" : undefined }}
    />
  );
}

function Selector({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const T = useTheme();
  return (
    <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexDirection: "row", gap: 8, paddingVertical: 2 }}>
      {options.map(o => (
        <TouchableOpacity key={o} onPress={() => onChange(o)}
          style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
            backgroundColor: value === o ? "#1D4ED8" : T.card,
            borderWidth: 1, borderColor: value === o ? "#1D4ED8" : T.border }}>
          <Text style={{ color: value === o ? "#fff" : T.textSub, fontSize: 12, fontWeight: "600" }}>{o}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const emptyPunto = () => ({
  // Common
  area: "", serial_number: "", brand: "", manufacture_date: "",
  capacity: "", expiry_date: "", accessible: "SI", signaled: "SI",
  observations: "", photoUri: "",
  // Extintor-specific
  extinguisher_type: "PQS ABC", review_date: "",
  cabinet: "OK", charge_status: "OK", hose_nozzle: "OK", safety_pin: "OK",
  cylinder: "OK", collar_status: "OK", wheel_status: "N/A",
  charge_date: "", inspection_card: "OK", hydrostatic_test: "N/A",
  height: "SI", nom002: "SI", co2_weight: "N/A",
  // Generic extra fields
  tipo_linea: "", cable_state: "OK", connectors: "OK",
  anchor_upper: "OK", anchor_lower: "OK", shock_absorber: "OK",
  estado_general: "OK",
});

export default function LevantamientoScreen({ navigation, route }: Props) {
  const { inspectorId } = route.params;
  const T = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [step, setStep] = useState<Step>("list");
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [levantamientos, setLevantamientos] = useState<Levantamiento[]>([]);

  // Header fields
  const [clientId, setClientId] = useState("");
  const [sucursalId, setSucursalId] = useState("");
  const [dept, setDept] = useState("");
  const [comments, setComments] = useState("");
  const [equipmentType, setEquipmentType] = useState("extintor");

  // Active levantamiento
  const [activeLev, setActiveLev] = useState<Levantamiento | null>(null);
  const [puntos, setPuntos] = useState<ReturnType<typeof emptyPunto>[]>([]);
  const [currentPunto, setCurrentPunto] = useState(emptyPunto());
  const [savingPunto, setSavingPunto] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [cRes, levRes] = await Promise.all([
        axios.get(`${API_URL}/mobile/clients`),
        axios.get<Levantamiento[]>(`${API_URL}/levantamientos?inspector_id=${inspectorId}`),
      ]);
      setClientes(cRes.data?.rows ?? []);
      setLevantamientos(Array.isArray(levRes.data) ? levRes.data : []);
    } catch {
      Alert.alert("Error", "No se pudieron cargar los datos.");
    } finally {
      setLoading(false);
    }
  };

  const loadSucursales = async (cid: string) => {
    if (!cid) return;
    try {
      const res = await axios.get<Sucursal[]>(`${API_URL}/sucursales?client_id=${cid}`);
      setSucursales(res.data || []);
    } catch { /* ignore */ }
  };

  const createLevantamiento = async () => {
    if (!clientId) { Alert.alert("Falta", "Selecciona una compañía"); return; }
    setLoading(true);
    try {
      const res = await axios.post<{ id: string; folio: string; equipment_type: string }>(`${API_URL}/levantamientos`, {
        inspector_id: inspectorId,
        client_id: clientId,
        sucursal_id: sucursalId || null,
        department: dept,
        comments,
        equipment_type: equipmentType,
        scheduled_at: new Date().toISOString().slice(0, 10),
      });
      const newLev: Levantamiento = {
        id: res.data.id, folio: res.data.folio,
        inspector_id: inspectorId, client_id: clientId, sucursal_id: sucursalId,
        department: dept, scheduled_at: null, completed_at: null,
        status: "en_proceso", comments, created_at: new Date().toISOString(),
        equipment_type: res.data.equipment_type,
      };
      setActiveLev(newLev);
      setPuntos([]);
      setCurrentPunto(emptyPunto());
      setStep("puntos");
    } catch {
      Alert.alert("Error", "No se pudo crear el levantamiento.");
    } finally {
      setLoading(false);
    }
  };

  const resumeLevantamiento = async (lev: Levantamiento) => {
    setActiveLev(lev);
    setCurrentPunto(emptyPunto());
    setStep("puntos");
    try {
      const res = await axios.get(`${API_URL}/levantamientos/${lev.id}/puntos`);
      const existing = Array.isArray(res.data) ? res.data : (res.data?.puntos ?? []);
      setPuntos(existing);
    } catch {
      setPuntos([]);
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6, base64: false });
      if (photo) {
        setCurrentPunto(prev => ({ ...prev, photoUri: photo.uri }));
        setStep("puntos");
      }
    } catch {
      Alert.alert("Error", "No se pudo tomar la foto.");
      setStep("puntos");
    }
  };

  const savePunto = async () => {
    if (!activeLev) return;
    if (!currentPunto.area.trim()) {
      Alert.alert("Campo requerido", "Ingresa el área o ubicación del equipo.");
      return;
    }
    setSavingPunto(true);
    try {
      const formData = new FormData();
      const { photoUri, ...data } = currentPunto;
      formData.append("data", JSON.stringify(data));
      if (photoUri) {
        const ext = photoUri.split(".").pop() || "jpg";
        formData.append("photo", { uri: photoUri, name: `foto.${ext}`, type: `image/${ext}` } as unknown as Blob);
      }
      await axios.post(
        `${API_URL}/levantamientos/${activeLev.id}/puntos`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setPuntos(prev => [...prev, currentPunto]);
      const eqLabel = EQ_LABELS[activeLev.equipment_type || "extintor"] || "Equipo";
      Alert.alert("✓ Guardado", `${eqLabel} #${puntos.length + 1} registrado.`);
      setCurrentPunto(emptyPunto());
    } catch (e) {
      const is4xx = axios.isAxiosError(e) && e.response && e.response.status >= 400 && e.response.status < 500;
      if (is4xx) {
        Alert.alert("Error", "Dato inválido. Revisa los campos e intenta de nuevo.");
      } else {
        // Network error — queue JSON data (without photo) for retry
        const { photoUri: _photo, ...data } = currentPunto;
        await queueRequest(
          `${API_URL}/levantamientos/${activeLev.id}/puntos`,
          "POST",
          data,
          "levantamiento_punto"
        );
        setPuntos(prev => [...prev, currentPunto]);
        const eqLabel = EQ_LABELS[activeLev.equipment_type || "extintor"] || "Equipo";
        Alert.alert("Sin conexión", `${eqLabel} guardado localmente. Se sincronizará al recuperar señal.${_photo ? " (foto no incluida)" : ""}`);
        setCurrentPunto(emptyPunto());
      }
    } finally {
      setSavingPunto(false);
    }
  };

  const completeLevantamiento = async () => {
    if (!activeLev) return;
    Alert.alert("Completar levantamiento", `¿Marcar ${activeLev.folio} como completado? Ya no podrás agregar más equipos.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Completar", onPress: async () => {
          try {
            await axios.post(`${API_URL}/levantamientos/${activeLev.id}/complete`);
            Alert.alert("✓ Listo", `${activeLev.folio} marcado como completado.`);
            setActiveLev(null);
            loadInitialData();
            setStep("list");
          } catch {
            Alert.alert("Error", "No se pudo completar el levantamiento.");
          }
        }
      }
    ]);
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) { Alert.alert("Permiso requerido", "Se necesita acceso a la cámara para tomar fotos."); return; }
    }
    setStep("camera");
  };

  // ─── CAMERA ───────────────────────────────────────────────
  if (step === "camera") {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
        <View style={{ position: "absolute", bottom: 40, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 24 }}>
          <TouchableOpacity onPress={() => setStep("puntos")}
            style={{ paddingHorizontal: 24, paddingVertical: 14, borderRadius: 30, backgroundColor: "rgba(0,0,0,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={takePicture}
            style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: "#fff", borderWidth: 4, borderColor: "#CE0D0D", alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: "#CE0D0D" }} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => setStep("puntos")}
          style={{ position: "absolute", top: 50, left: 20, padding: 10 }}>
          <Text style={{ color: "#fff", fontSize: 24 }}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── ADD PUNTO FORM ───────────────────────────────────────
  if (step === "puntos" && activeLev) {
    const eqType = activeLev.equipment_type || "extintor";
    const eqLabel = EQ_LABELS[eqType] || "Equipo";
    const isExtintor = eqType === "extintor";

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }} edges={["top"]}>
        <LinearGradient colors={["#0D1B3E", "#122B60"]}
          style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => setStep("list")} style={{ padding: 4 }}>
            <Text style={{ color: "#fff", fontSize: 22 }}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{activeLev.folio}</Text>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 1 }}>
              {puntos.length} {eqLabel.toLowerCase()}{puntos.length !== 1 ? "s" : ""} agregado{puntos.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <TouchableOpacity onPress={completeLevantamiento}
            style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: "#22C55E" }}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Completar</Text>
          </TouchableOpacity>
        </LinearGradient>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: T.text, marginBottom: 16 }}>
              Agregar {eqLabel} #{puntos.length + 1}
            </Text>

            {/* Common fields */}
            <FieldRow label="Área / Ubicación">
              <Inp value={currentPunto.area} onChange={v => setCurrentPunto(p => ({ ...p, area: v }))} placeholder="ej. Lobby, Piso 2" />
            </FieldRow>
            <FieldRow label="Número de Serie">
              <Inp value={currentPunto.serial_number} onChange={v => setCurrentPunto(p => ({ ...p, serial_number: v }))} />
            </FieldRow>
            <FieldRow label="Marca">
              <Inp value={currentPunto.brand} onChange={v => setCurrentPunto(p => ({ ...p, brand: v }))} placeholder="ej. Amerex, Badger" />
            </FieldRow>
            <FieldRow label="Fecha de Fabricación">
              <DatePickerField label="" value={currentPunto.manufacture_date} onChange={v => setCurrentPunto(p => ({ ...p, manufacture_date: v }))} textColor={T.text} borderColor={T.border} bgColor={T.bg} placeholder="Seleccionar" />
            </FieldRow>
            <FieldRow label="Capacidad / Longitud">
              {isExtintor
                ? <Selector options={CAPS_EXTINTOR} value={currentPunto.capacity} onChange={v => setCurrentPunto(p => ({ ...p, capacity: v }))} />
                : <Inp value={currentPunto.capacity} onChange={v => setCurrentPunto(p => ({ ...p, capacity: v }))} placeholder="ej. 20 M, 30 M, 1 TON" />
              }
            </FieldRow>
            <FieldRow label="Fecha de Vencimiento">
              <DatePickerField label="" value={currentPunto.expiry_date} onChange={v => setCurrentPunto(p => ({ ...p, expiry_date: v }))} textColor={T.text} borderColor={T.border} bgColor={T.bg} placeholder="Seleccionar" />
            </FieldRow>

            {/* Extintor-only fields */}
            {isExtintor && <>
              <FieldRow label="Tipo de Extintor">
                <Selector options={TIPOS_EXTINTOR} value={currentPunto.extinguisher_type} onChange={v => setCurrentPunto(p => ({ ...p, extinguisher_type: v }))} />
              </FieldRow>
              <FieldRow label="Fecha de Carga">
                <DatePickerField label="" value={currentPunto.charge_date} onChange={v => setCurrentPunto(p => ({ ...p, charge_date: v }))} textColor={T.text} borderColor={T.border} bgColor={T.bg} placeholder="Seleccionar" />
              </FieldRow>
            </>}

            <View style={{ height: 1, backgroundColor: T.border, marginVertical: 16 }} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: T.textSub, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>Revisión Visual</Text>

            <FieldRow label="Accesible"><SIPicker value={currentPunto.accessible} onChange={v => setCurrentPunto(p => ({ ...p, accessible: v }))} /></FieldRow>
            <FieldRow label="Señalizado"><SIPicker value={currentPunto.signaled} onChange={v => setCurrentPunto(p => ({ ...p, signaled: v }))} /></FieldRow>

            {/* Extintor inspection fields */}
            {isExtintor && <>
              <FieldRow label="Gabinete"><OKPicker value={currentPunto.cabinet} onChange={v => setCurrentPunto(p => ({ ...p, cabinet: v }))} /></FieldRow>
              <FieldRow label="Estado de Carga"><OKPicker value={currentPunto.charge_status} onChange={v => setCurrentPunto(p => ({ ...p, charge_status: v }))} /></FieldRow>
              <FieldRow label="Manguera / Boquilla"><OKPicker value={currentPunto.hose_nozzle} onChange={v => setCurrentPunto(p => ({ ...p, hose_nozzle: v }))} /></FieldRow>
              <FieldRow label="Seguro (Cola de Rata)"><OKPicker value={currentPunto.safety_pin} onChange={v => setCurrentPunto(p => ({ ...p, safety_pin: v }))} /></FieldRow>
              <FieldRow label="Cilindro"><OKPicker value={currentPunto.cylinder} onChange={v => setCurrentPunto(p => ({ ...p, cylinder: v }))} /></FieldRow>
              <FieldRow label="Estado Collarín"><OKPicker value={currentPunto.collar_status} onChange={v => setCurrentPunto(p => ({ ...p, collar_status: v }))} /></FieldRow>
              <FieldRow label="Tarjeta de Inspección"><OKPicker value={currentPunto.inspection_card} onChange={v => setCurrentPunto(p => ({ ...p, inspection_card: v }))} /></FieldRow>
              <FieldRow label="Altura NOM"><SIPicker value={currentPunto.height} onChange={v => setCurrentPunto(p => ({ ...p, height: v }))} /></FieldRow>
              <FieldRow label="NOM-002"><SIPicker value={currentPunto.nom002} onChange={v => setCurrentPunto(p => ({ ...p, nom002: v }))} /></FieldRow>
            </>}

            {/* Línea de Vida fields */}
            {eqType === "linea_vida" && <>
              <FieldRow label="Tipo de Línea">
                <Selector options={TIPO_LINEA} value={currentPunto.tipo_linea} onChange={v => setCurrentPunto(p => ({ ...p, tipo_linea: v }))} />
              </FieldRow>
              <FieldRow label="Estado del Cable"><OKPicker value={currentPunto.cable_state} onChange={v => setCurrentPunto(p => ({ ...p, cable_state: v }))} /></FieldRow>
              <FieldRow label="Conectores"><OKPicker value={currentPunto.connectors} onChange={v => setCurrentPunto(p => ({ ...p, connectors: v }))} /></FieldRow>
              <FieldRow label="Ancla Superior"><OKPicker value={currentPunto.anchor_upper} onChange={v => setCurrentPunto(p => ({ ...p, anchor_upper: v }))} /></FieldRow>
              <FieldRow label="Ancla Inferior"><OKPicker value={currentPunto.anchor_lower} onChange={v => setCurrentPunto(p => ({ ...p, anchor_lower: v }))} /></FieldRow>
              <FieldRow label="Absorbedor de Choque"><OKPicker value={currentPunto.shock_absorber} onChange={v => setCurrentPunto(p => ({ ...p, shock_absorber: v }))} /></FieldRow>
            </>}

            {/* Hidrante / ERA / sistema_incendio / NFPA / otro fields */}
            {(eqType === "hidrante" || eqType === "sistema_incendio" || eqType === "era" || eqType === "otro"
              || eqType === "co2_nfpa12" || eqType === "rociadores_nfpa13" || eqType === "espuma_nfpa16"
              || eqType === "bomba_ci_nfpa20" || eqType === "alarma_nfpa72"
              || eqType === "supresion_cocinas_nfpa96" || eqType === "agente_limpio_nfpa2001") && <>
              <FieldRow label="Estado General"><OKPicker value={currentPunto.estado_general} onChange={v => setCurrentPunto(p => ({ ...p, estado_general: v }))} /></FieldRow>
            </>}

            {(eqType === "hidrante" || eqType === "era") && <>
              <FieldRow label={eqType === "hidrante" ? "Estado Manguera" : "Estado Cilindro"}>
                <OKPicker value={currentPunto.cable_state} onChange={v => setCurrentPunto(p => ({ ...p, cable_state: v }))} />
              </FieldRow>
              <FieldRow label={eqType === "hidrante" ? "Acoplamiento" : "Arnés"}>
                <OKPicker value={currentPunto.connectors} onChange={v => setCurrentPunto(p => ({ ...p, connectors: v }))} />
              </FieldRow>
            </>}

            <FieldRow label="Observaciones">
              <Inp value={currentPunto.observations} onChange={v => setCurrentPunto(p => ({ ...p, observations: v }))} multiline placeholder="Notas adicionales..." />
            </FieldRow>

            {/* Photo */}
            <FieldRow label="Foto (opcional)">
              {currentPunto.photoUri ? (
                <View style={{ gap: 8 }}>
                  <Image source={{ uri: currentPunto.photoUri }} style={{ width: "100%", height: 180, borderRadius: 10 }} resizeMode="cover" />
                  <TouchableOpacity onPress={() => setCurrentPunto(p => ({ ...p, photoUri: "" }))}
                    style={{ padding: 8, borderRadius: 8, borderWidth: 1, borderColor: "#EF4444", alignItems: "center" }}>
                    <Text style={{ color: "#EF4444", fontSize: 12, fontWeight: "700" }}>Eliminar foto</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={openCamera}
                  style={{ padding: 18, borderRadius: 10, borderWidth: 2, borderColor: T.border, borderStyle: "dashed", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 28 }}>📷</Text>
                  <Text style={{ color: T.textSub, fontSize: 13 }}>Tomar foto del equipo</Text>
                </TouchableOpacity>
              )}
            </FieldRow>

            <TouchableOpacity
              onPress={savePunto}
              disabled={savingPunto}
              style={{ backgroundColor: "#1D4ED8", borderRadius: 14, padding: 18, alignItems: "center", marginTop: 8 }}
            >
              {savingPunto
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>💾 Guardar {eqLabel}</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ─── NEW LEVANTAMIENTO HEADER ─────────────────────────────
  if (step === "header") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }} edges={["top"]}>
        <LinearGradient colors={["#0D1B3E", "#122B60"]}
          style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => setStep("list")} style={{ padding: 4 }}>
            <Text style={{ color: "#fff", fontSize: 22 }}>‹</Text>
          </TouchableOpacity>
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900", flex: 1 }}>Nuevo Levantamiento</Text>
        </LinearGradient>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

            <FieldRow label="Tipo de Equipo *">
              <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexDirection: "row", gap: 8, paddingVertical: 2 }}>
                {EQ_TYPES.map(t => (
                  <TouchableOpacity key={t.value} onPress={() => setEquipmentType(t.value)}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                      backgroundColor: equipmentType === t.value ? "#1D4ED8" : T.card,
                      borderWidth: 1, borderColor: equipmentType === t.value ? "#1D4ED8" : T.border }}>
                    <Text style={{ color: equipmentType === t.value ? "#fff" : T.textSub, fontSize: 12, fontWeight: "600" }}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </FieldRow>

            <FieldRow label="Compañía *">
              <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexDirection: "row", gap: 8, paddingVertical: 2 }}>
                {clientes.map(c => (
                  <TouchableOpacity key={c.id} onPress={() => { setClientId(c.id); setSucursalId(""); loadSucursales(c.id); }}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                      backgroundColor: clientId === c.id ? "#1D4ED8" : T.card,
                      borderWidth: 1, borderColor: clientId === c.id ? "#1D4ED8" : T.border }}>
                    <Text style={{ color: clientId === c.id ? "#fff" : T.textSub, fontSize: 12, fontWeight: "600" }}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </FieldRow>

            {sucursales.length > 0 && (
              <FieldRow label="Sucursal">
                <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ flexDirection: "row", gap: 8, paddingVertical: 2 }}>
                  {sucursales.map(s => (
                    <TouchableOpacity key={s.id} onPress={() => setSucursalId(s.id)}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                        backgroundColor: sucursalId === s.id ? "#1D4ED8" : T.card,
                        borderWidth: 1, borderColor: sucursalId === s.id ? "#1D4ED8" : T.border }}>
                      <Text style={{ color: sucursalId === s.id ? "#fff" : T.textSub, fontSize: 12, fontWeight: "600" }}>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </FieldRow>
            )}

            <FieldRow label="Departamento">
              <Inp value={dept} onChange={setDept} placeholder="ej. Planta Norte, Área de Producción" />
            </FieldRow>
            <FieldRow label="Comentarios">
              <Inp value={comments} onChange={setComments} multiline placeholder="Notas generales..." />
            </FieldRow>

            <TouchableOpacity
              onPress={createLevantamiento}
              disabled={loading || !clientId}
              style={{ backgroundColor: clientId ? "#1D4ED8" : "#374151", borderRadius: 14, padding: 18, alignItems: "center", marginTop: 8 }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>
                    Crear y agregar {EQ_LABELS[equipmentType] || "equipos"}s →
                  </Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ─── LIST ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }} edges={["top"]}>
      <LinearGradient colors={["#0D1B3E", "#122B60"]}
        style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 20, flexDirection: "row", alignItems: "center" }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, marginRight: 10 }}>
          <Text style={{ color: "#fff", fontSize: 22 }}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }}>Levantamientos</Text>
          <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 1 }}>Mis levantamientos</Text>
        </View>
        <TouchableOpacity onPress={() => setStep("header")}
          style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: "#1D4ED8" }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>+ Nuevo</Text>
        </TouchableOpacity>
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#1D4ED8" />
        </View>
      ) : (
        <FlatList
          data={levantamientos}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Text style={{ fontSize: 44, marginBottom: 12 }}>📋</Text>
              <Text style={{ fontSize: 15, fontWeight: "600", color: T.textSub }}>Sin levantamientos</Text>
              <Text style={{ fontSize: 13, color: T.textSub, marginTop: 6, textAlign: "center" }}>
                Toca "+ Nuevo" para crear uno
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const statusColor = item.status === "completada" ? "#22C55E" : item.status === "en_proceso" ? "#3B82F6" : "#F59E0B";
            const statusLabel = item.status === "completada" ? "Completada" : item.status === "en_proceso" ? "En proceso" : "Pendiente";
            const eqTypeLabel = EQ_TYPES.find(t => t.value === item.equipment_type)?.label || "Extintor";
            const eqLabelItem = EQ_LABELS[item.equipment_type || "extintor"] || "Equipo";
            return (
              <TouchableOpacity
                onPress={() => item.status !== "completada" && resumeLevantamiento(item)}
                style={{
                  backgroundColor: T.card, borderRadius: 14, padding: 16, marginBottom: 12,
                  borderWidth: 1, borderColor: item.status === "completada" ? "rgba(34,197,94,0.2)" : T.border,
                  elevation: 2, shadowColor: "#000", shadowOpacity: T.isDark ? 0.2 : 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
                }}
                activeOpacity={item.status === "completada" ? 1 : 0.7}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Text style={{ fontSize: 16, fontWeight: "900", color: T.text }}>{item.folio}</Text>
                  <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, backgroundColor: statusColor }}>
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{statusLabel}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 11, color: "#1D4ED8", fontWeight: "700", marginTop: 4 }}>{eqTypeLabel}</Text>
                {item.cliente_name && (
                  <Text style={{ fontSize: 13, color: T.textSub, marginTop: 5 }}>🏢 {item.cliente_name}</Text>
                )}
                {item.sucursal_name && (
                  <Text style={{ fontSize: 12, color: T.textSub, marginTop: 2 }}>🏗️ {item.sucursal_name}</Text>
                )}
                {item.department ? (
                  <Text style={{ fontSize: 12, color: T.textSub, marginTop: 2 }}>📍 {item.department}</Text>
                ) : null}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                  <Text style={{ fontSize: 12, color: T.textSub }}>
                    {new Date(item.created_at).toLocaleDateString("es-MX")}
                  </Text>
                  {typeof item.puntos_count === "number" && (
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#1D4ED8" }}>
                      {item.puntos_count} {eqLabelItem.toLowerCase()}{item.puntos_count !== 1 ? "s" : ""}
                    </Text>
                  )}
                </View>
                {item.status !== "completada" && (
                  <View style={{ marginTop: 10, padding: 8, borderRadius: 8, backgroundColor: "rgba(59,130,246,0.1)", alignItems: "center" }}>
                    <Text style={{ color: "#3B82F6", fontSize: 11, fontWeight: "700" }}>Toca para continuar →</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
