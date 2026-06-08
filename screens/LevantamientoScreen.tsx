import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, Image,
  KeyboardAvoidingView, Platform, FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions } from "expo-camera";
import axios from "axios";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList, Levantamiento, Cliente, Sucursal } from "../types";
import { API_URL } from "../constants/api";
import { useTheme } from "../hooks/useTheme";
import DatePickerField from "../components/DatePickerField";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Levantamiento">;
  route: { params: { inspectorId: string } };
};

type Step = "list" | "header" | "puntos" | "camera";

const TIPOS = ["PQS ABC", "CO2", "Agua", "Clase K", "Halón", "Espuma", "Polvo BC"];
const CAPS = ["1 KG", "2.5 KG", "4 KG", "4.5 KG", "6 KG", "9 KG", "12 KG", "20 KG", "2.5 LB", "5 LB", "10 LB", "2.5 GAL", "2.5 KG CO2", "5 KG CO2", "10 KG CO2"];
const OK_OPTS = ["OK", "MAL", "N/A"];
const SI_NO = ["SI", "NO", "N/A"];

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
    <TextInput
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
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
  area: "", serial_number: "", brand: "", manufacture_date: "",
  extinguisher_type: "PQS ABC", capacity: "4.5 KG", review_date: "",
  accessible: "SI", signaled: "SI", cabinet: "OK", charge_status: "OK",
  hose_nozzle: "OK", safety_pin: "OK", cylinder: "OK", collar_status: "OK",
  wheel_status: "N/A", charge_date: "", expiry_date: "", inspection_card: "OK",
  hydrostatic_test: "N/A", height: "SI", nom002: "SI", co2_weight: "N/A",
  observations: "", photoUri: "",
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
        axios.get<Cliente[]>(`${API_URL}/clients`),
        axios.get<Levantamiento[]>(`${API_URL}/levantamientos?inspector_id=${inspectorId}`),
      ]);
      setClientes(Array.isArray(cRes.data) ? cRes.data : []);
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
      const res = await axios.post<{ id: string; folio: string }>(`${API_URL}/levantamientos`, {
        inspector_id: inspectorId,
        client_id: clientId,
        sucursal_id: sucursalId || null,
        department: dept,
        comments,
        scheduled_at: new Date().toISOString().slice(0, 10),
      });
      const newLev: Levantamiento = {
        id: res.data.id, folio: res.data.folio,
        inspector_id: inspectorId, client_id: clientId, sucursal_id: sucursalId,
        department: dept, scheduled_at: null, completed_at: null,
        status: "en_proceso", comments, created_at: new Date().toISOString(),
      };
      setActiveLev(newLev);
      setPuntos([]);
      setStep("puntos");
    } catch {
      Alert.alert("Error", "No se pudo crear el levantamiento.");
    } finally {
      setLoading(false);
    }
  };

  const resumeLevantamiento = (lev: Levantamiento) => {
    setActiveLev(lev);
    setPuntos([]);
    setCurrentPunto(emptyPunto());
    setStep("puntos");
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
      setCurrentPunto(emptyPunto());
      Alert.alert("✓ Guardado", `Extintor #${puntos.length + 1} registrado.`);
    } catch {
      Alert.alert("Error", "No se pudo guardar el punto.");
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
              {puntos.length} extintore{puntos.length !== 1 ? "s" : ""} agregado{puntos.length !== 1 ? "s" : ""}
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
              Agregar Extintor #{puntos.length + 1}
            </Text>

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
            <FieldRow label="Tipo">
              <Selector options={TIPOS} value={currentPunto.extinguisher_type} onChange={v => setCurrentPunto(p => ({ ...p, extinguisher_type: v }))} />
            </FieldRow>
            <FieldRow label="Capacidad">
              <Selector options={CAPS} value={currentPunto.capacity} onChange={v => setCurrentPunto(p => ({ ...p, capacity: v }))} />
            </FieldRow>
            <FieldRow label="Fecha de Vencimiento">
              <DatePickerField label="" value={currentPunto.expiry_date} onChange={v => setCurrentPunto(p => ({ ...p, expiry_date: v }))} textColor={T.text} borderColor={T.border} bgColor={T.bg} placeholder="Seleccionar" />
            </FieldRow>
            <FieldRow label="Fecha de Carga">
              <DatePickerField label="" value={currentPunto.charge_date} onChange={v => setCurrentPunto(p => ({ ...p, charge_date: v }))} textColor={T.text} borderColor={T.border} bgColor={T.bg} placeholder="Seleccionar" />
            </FieldRow>

            <View style={{ height: 1, backgroundColor: T.border, marginVertical: 16 }} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: T.textSub, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>Revisión Visual</Text>

            <FieldRow label="Accesible"><SIPicker value={currentPunto.accessible} onChange={v => setCurrentPunto(p => ({ ...p, accessible: v }))} /></FieldRow>
            <FieldRow label="Señalizado"><SIPicker value={currentPunto.signaled} onChange={v => setCurrentPunto(p => ({ ...p, signaled: v }))} /></FieldRow>
            <FieldRow label="Gabinete"><OKPicker value={currentPunto.cabinet} onChange={v => setCurrentPunto(p => ({ ...p, cabinet: v }))} /></FieldRow>
            <FieldRow label="Estado de Carga"><OKPicker value={currentPunto.charge_status} onChange={v => setCurrentPunto(p => ({ ...p, charge_status: v }))} /></FieldRow>
            <FieldRow label="Manguera / Boquilla"><OKPicker value={currentPunto.hose_nozzle} onChange={v => setCurrentPunto(p => ({ ...p, hose_nozzle: v }))} /></FieldRow>
            <FieldRow label="Seguro (Cola de Rata)"><OKPicker value={currentPunto.safety_pin} onChange={v => setCurrentPunto(p => ({ ...p, safety_pin: v }))} /></FieldRow>
            <FieldRow label="Cilindro"><OKPicker value={currentPunto.cylinder} onChange={v => setCurrentPunto(p => ({ ...p, cylinder: v }))} /></FieldRow>
            <FieldRow label="Estado Collarín"><OKPicker value={currentPunto.collar_status} onChange={v => setCurrentPunto(p => ({ ...p, collar_status: v }))} /></FieldRow>
            <FieldRow label="Tarjeta de Inspección"><OKPicker value={currentPunto.inspection_card} onChange={v => setCurrentPunto(p => ({ ...p, inspection_card: v }))} /></FieldRow>
            <FieldRow label="Altura NOM"><SIPicker value={currentPunto.height} onChange={v => setCurrentPunto(p => ({ ...p, height: v }))} /></FieldRow>
            <FieldRow label="NOM-002"><SIPicker value={currentPunto.nom002} onChange={v => setCurrentPunto(p => ({ ...p, nom002: v }))} /></FieldRow>

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
                  <Text style={{ color: T.textSub, fontSize: 13 }}>Tomar foto del extintor</Text>
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
                : <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>💾 Guardar Extintor</Text>
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
            <FieldRow label="Compañía *">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
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
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
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
                : <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>Crear y agregar extintores →</Text>
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
                      {item.puntos_count} extintor{item.puntos_count !== 1 ? "es" : ""}
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
