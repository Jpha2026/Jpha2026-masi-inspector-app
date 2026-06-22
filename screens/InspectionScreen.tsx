import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Alert, Image, Modal,
} from "react-native";
import { UpperInput } from "../components/UpperInput";
import { SafeAreaView } from "react-native-safe-area-context";
import axios from "axios";
import NetInfo from "@react-native-community/netinfo";
import { CameraView, useCameraPermissions } from "expo-camera";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList, InspectionItem, ItemResult } from "../types";
import { API_URL } from "../constants/api";
import { queueInspection } from "../hooks/useOfflineSync";
import * as Location from "expo-location";
import { useLocation } from "../hooks/useLocation";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Inspection">;
  route: RouteProp<RootStackParamList, "Inspection">;
};

type Category = { label: string; items: string[] };
type ChecklistDef = { categories: Category[]; safetyCategory: string };

// ─── Checklists por tipo de equipo (procedimientos MASI) ─────────────────────

const CHECKLIST_EXTINTOR: ChecklistDef = {
  safetyCategory: "Cumplimiento técnico",
  categories: [
    {
      label: "Componentes",
      items: [
        "Válvula de control",
        "Manómetro (presión correcta)",
        "Manguera / boquilla",
        "Cuerpo del extintor (sin daños)",
      ],
    },
    {
      label: "Señalización",
      items: [
        "Señalamientos visibles",
        "Delimitación y altura de montaje",
        "Tarjeta de registro de inspecciones",
      ],
    },
    {
      label: "Cumplimiento técnico",
      items: [
        "Prueba Hidrostática vigente (máx. 5 años / 12 años cartucho exterior)",
        "Fecha de recarga vigente (máx. 12 meses)",
      ],
    },
    {
      label: "Ubicación",
      items: ["Ubicación del extintor adecuada"],
    },
  ],
};

// PTS-INSP-H-02 — 18 ítems
const CHECKLIST_HIDRANTE: ChecklistDef = {
  safetyCategory: "Pruebas y vigencias",
  categories: [
    {
      label: "Acceso y señalización",
      items: ["Accesibilidad al gabinete", "Señalización visible", "Delimitación"],
    },
    {
      label: "Gabinete",
      items: [
        "Estado del gabinete",
        "Mica / puerta del gabinete",
        "Limpieza de gabinete",
        "Instrucciones de uso visibles",
        "Reporte de reparación anterior",
      ],
    },
    {
      label: "Manguera",
      items: [
        "Limpieza y acomodo de manguera",
        "Coples en buen estado",
        "Llave de ajuste",
        "Boquilla / chiflón",
        "Enrollamiento correcto",
      ],
    },
    {
      label: "Pruebas y vigencias",
      items: [
        "Prueba Hidrostática vigente (máx. 5 años NOM-002-STPS-2010)",
        "Prueba de presión (96–148 lbs)",
        "Sin fugas en el sistema",
        "Sistema de espuma / supresión",
        "Tarjeta de inspección mensual al día",
      ],
    },
  ],
};

// PTS-INSP-C-03 — 7 ítems
const CHECKLIST_CAMILLA: ChecklistDef = {
  safetyCategory: "Componentes",
  categories: [
    {
      label: "Estado físico",
      items: ["Limpieza general", "Estructura de la camilla (sin daños)"],
    },
    {
      label: "Componentes",
      items: [
        "Inmovilizador de cráneo",
        "Araña (cinturones de sujeción)",
      ],
    },
    {
      label: "Ubicación",
      items: [
        "Señales de uso / identificación",
        "Gabinete o almacenamiento adecuado",
        "Delimitación",
      ],
    },
  ],
};

// Sistemas Contra Incendio (SCI) — inspección mensual NFPA / FO-NFPA
// Aplica a: CO2, Agentes Limpios, Rociadores, Agua/Espuma
const CHECKLIST_SCI: ChecklistDef = {
  safetyCategory: "Activación y descarga",
  categories: [
    {
      label: "Cilindros y almacenamiento",
      items: [
        "Cilindros sin daños, limpios y completos",
        "Libres de obstrucciones y material combustible cercano",
        "Etiquetas de identificación legibles",
        "Soportes y fijaciones de cilindros en su lugar",
      ],
    },
    {
      label: "Activación y descarga",
      items: [
        "Estaciones de activación manual accesibles y sin obstrucciones",
        "Actuadores de descarga en su lugar y conexiones apretadas",
        "Válvulas de bloqueo y retardos en posición correcta",
        "Mangueras de descarga: PH vigente, sin daños en roscas",
        "Boquillas y difusores libres de obstrucciones",
      ],
    },
    {
      label: "Alarma y detección",
      items: [
        "Tablero de alarma: sin fallas ni indicadores de error",
        "Sirenas y estrobos libres de obstrucciones",
        "Detectores de humo/calor/flama limpios y sin obstrucciones",
        "Fuente de alimentación principal confiable",
        "Batería de respaldo funcional (24 hrs mínimo)",
      ],
    },
    {
      label: "Área protegida",
      items: [
        "Puertas del espacio protegido cerradas",
        "Rutas de evacuación despejadas",
        "Señalización de área protegida visible",
        "Personal capacitado en procedimiento de evacuación",
        "Sin modificaciones al espacio protegido desde último servicio",
      ],
    },
  ],
};

// Regadera de Emergencia / Lavaojo
// Regadera de emergencia fija — ANSI/ISEA Z358.1-2014 + NOM-026-STPS
const CHECKLIST_REGADERA_FIJA: ChecklistDef = {
  safetyCategory: "Funcionamiento ANSI/ISEA Z358.1",
  categories: [
    {
      label: "Acceso y señalización",
      items: [
        "Señalización verde visible (NOM-026 / ANSI Z358.1)",
        "Acceso libre en ≤10 segundos (≤16.8 m)",
        "Sin obstrucciones en la ruta de acceso",
        "Área bien iluminada",
        "Piso antiderrapante en zona de activación",
      ],
    },
    {
      label: "Funcionamiento",
      items: [
        "Válvula de acción única (activación en ≤1 segundo)",
        "Permanece activa sin sostener (stay-open valve)",
        "Flujo de agua mínimo 76 L/min (20 gal/min)",
        "Temperatura del agua tibia 15–37 °C",
        "Flujo continuo garantizado por mínimo 15 minutos",
        "Patrón de agua cubre cabeza y hombros completos",
      ],
    },
    {
      label: "Estado físico",
      items: [
        "Sin corrosión ni herrumbre en tubería y cabezal",
        "Sin fugas en válvula, tubería o cabezal",
        "Cabezal limpio y sin obstrucciones",
        "Cubierta del cabezal presente (protección de polvo)",
      ],
    },
    {
      label: "Documentación",
      items: [
        "Prueba semanal registrada y vigente",
        "Inspección anual documentada",
        "Placa o identificación del equipo legible",
      ],
    },
  ],
};

// Regadera portátil por gravedad — ANSI/ISEA Z358.1-2014
const CHECKLIST_REGADERA_PORTATIL_GRAVEDAD: ChecklistDef = {
  safetyCategory: "Funcionamiento ANSI/ISEA Z358.1",
  categories: [
    {
      label: "Acceso y señalización",
      items: [
        "Señalización verde visible (NOM-026 / ANSI Z358.1)",
        "Acceso libre en ≤10 segundos",
        "Sin obstrucciones en la ruta de acceso",
        "Área bien iluminada",
      ],
    },
    {
      label: "Nivel y contenido",
      items: [
        "Nivel de agua suficiente para ≥15 minutos de flujo",
        "Agua limpia, sin contaminación visible",
        "Tapa del tanque hermética y sin daños",
        "Sello de tamper intacto (sin uso no autorizado)",
      ],
    },
    {
      label: "Funcionamiento",
      items: [
        "Válvula de acción única (activación en ≤1 segundo)",
        "Flujo de agua adecuado por gravedad",
        "Temperatura del agua tibia 15–37 °C",
        "Patrón de agua cubre cabeza y hombros",
      ],
    },
    {
      label: "Estado físico",
      items: [
        "Tanque sin golpes, grietas ni deformaciones",
        "Sin fugas en válvula o conexiones",
        "Cabezal limpio y funcional",
        "Soporte/base estable y seguro",
      ],
    },
    {
      label: "Documentación",
      items: [
        "Fecha de última recarga visible y vigente",
        "Prueba semanal registrada",
        "Placa o identificación del equipo legible",
      ],
    },
  ],
};

// Regadera portátil a presión — ANSI/ISEA Z358.1-2014
const CHECKLIST_REGADERA_PORTATIL_PRESION: ChecklistDef = {
  safetyCategory: "Funcionamiento ANSI/ISEA Z358.1",
  categories: [
    {
      label: "Acceso y señalización",
      items: [
        "Señalización verde visible (NOM-026 / ANSI Z358.1)",
        "Acceso libre en ≤10 segundos",
        "Sin obstrucciones en la ruta de acceso",
        "Área bien iluminada",
      ],
    },
    {
      label: "Presión y contenido",
      items: [
        "Manómetro/indicador de presión en zona verde",
        "Presión dentro del rango especificado por fabricante",
        "Sello de seguridad intacto (sin uso no autorizado)",
        "Fecha de última recarga visible y vigente",
      ],
    },
    {
      label: "Funcionamiento",
      items: [
        "Válvula de acción única (activación en ≤1 segundo)",
        "Flujo de agua adecuado y constante",
        "Temperatura del agua tibia 15–37 °C",
        "Flujo continuo garantizado por mínimo 15 minutos",
      ],
    },
    {
      label: "Estado físico",
      items: [
        "Cilindro sin golpes, corrosión ni deformaciones",
        "Sin fugas en válvula, manguera o cabezal",
        "Cabezal limpio y sin obstrucciones",
        "Soporte/base estable y seguro",
      ],
    },
    {
      label: "Documentación",
      items: [
        "Prueba semanal registrada y vigente",
        "Inspección anual documentada",
        "Placa o identificación del equipo legible",
      ],
    },
  ],
};

// Lavaojos fijo — ANSI/ISEA Z358.1-2014 + NOM-026-STPS
const CHECKLIST_LAVAOJOS_FIJO: ChecklistDef = {
  safetyCategory: "Funcionamiento ANSI/ISEA Z358.1",
  categories: [
    {
      label: "Acceso y señalización",
      items: [
        "Señalización verde visible (NOM-026 / ANSI Z358.1)",
        "Acceso libre en ≤10 segundos (≤16.8 m)",
        "Sin obstrucciones en la ruta de acceso",
        "Área bien iluminada",
        "Altura de boquillas entre 83–114 cm del piso (ANSI)",
      ],
    },
    {
      label: "Funcionamiento",
      items: [
        "Ambas boquillas funcionan simultáneamente",
        "Flujo mínimo 1.5 L/min por boquilla (ANSI Z358.1)",
        "Flujo suave hacia arriba (no traumático para ojos)",
        "Temperatura del agua tibia 15–37 °C",
        "Activación en ≤1 segundo",
        "Permanece activo sin sostener",
        "Flujo continuo garantizado por mínimo 15 minutos",
      ],
    },
    {
      label: "Estado físico",
      items: [
        "Protectores/tapas de boquillas presentes y limpias",
        "Boquillas sin obstrucción ni depósitos de cal",
        "Sin corrosión en cuerpo y conexiones",
        "Sin fugas visibles",
      ],
    },
    {
      label: "Documentación",
      items: [
        "Prueba semanal registrada y vigente",
        "Inspección anual documentada",
        "Placa o identificación del equipo legible",
      ],
    },
  ],
};

// Lavaojos portátil por gravedad — ANSI/ISEA Z358.1-2014
const CHECKLIST_LAVAOJOS_PORTATIL_GRAVEDAD: ChecklistDef = {
  safetyCategory: "Funcionamiento ANSI/ISEA Z358.1",
  categories: [
    {
      label: "Acceso y señalización",
      items: [
        "Señalización verde visible (NOM-026 / ANSI Z358.1)",
        "Acceso libre en ≤10 segundos",
        "Área bien iluminada",
      ],
    },
    {
      label: "Solución y nivel",
      items: [
        "Nivel de solución suficiente para ≥15 minutos",
        "Fecha de caducidad de la solución vigente",
        "Solución isotónica oftálmica (pH 6.5–7.5)",
        "Solución sin contaminación ni cambio de color",
        "Sello de tamper intacto",
        "Tapa hermética y sin daños",
      ],
    },
    {
      label: "Funcionamiento",
      items: [
        "Ambas boquillas funcionan simultáneamente",
        "Flujo suave y adecuado por gravedad",
        "Activación en ≤1 segundo",
      ],
    },
    {
      label: "Estado físico",
      items: [
        "Recipiente sin golpes, grietas ni deformaciones",
        "Sin fugas en válvulas o conexiones",
        "Boquillas limpias y sin obstrucción",
        "Soporte/base estable",
      ],
    },
    {
      label: "Documentación",
      items: [
        "Fecha de última recarga/reemplazo de solución",
        "Prueba semanal registrada",
        "Placa o identificación del equipo legible",
      ],
    },
  ],
};

// Lavaojos portátil a presión — ANSI/ISEA Z358.1-2014
const CHECKLIST_LAVAOJOS_PORTATIL_PRESION: ChecklistDef = {
  safetyCategory: "Funcionamiento ANSI/ISEA Z358.1",
  categories: [
    {
      label: "Acceso y señalización",
      items: [
        "Señalización verde visible (NOM-026 / ANSI Z358.1)",
        "Acceso libre en ≤10 segundos",
        "Área bien iluminada",
      ],
    },
    {
      label: "Presión y solución",
      items: [
        "Manómetro/indicador de presión en zona verde",
        "Presión dentro del rango especificado por fabricante",
        "Fecha de última recarga visible y vigente",
        "Solución isotónica oftálmica (pH 6.5–7.5)",
        "Sello de seguridad intacto",
      ],
    },
    {
      label: "Funcionamiento",
      items: [
        "Ambas boquillas funcionan simultáneamente",
        "Flujo suave y constante a presión controlada",
        "Activación en ≤1 segundo",
        "Flujo continuo por mínimo 15 minutos",
      ],
    },
    {
      label: "Estado físico",
      items: [
        "Cilindro sin golpes, corrosión ni deformaciones",
        "Sin fugas en válvula, manguera o boquillas",
        "Boquillas limpias y sin obstrucción",
        "Soporte/base estable",
      ],
    },
    {
      label: "Documentación",
      items: [
        "Inspección anual documentada",
        "Prueba semanal registrada",
        "Placa o identificación del equipo legible",
      ],
    },
  ],
};

// Unidad combinada fija — ANSI/ISEA Z358.1-2014 Sección 7
const CHECKLIST_COMBINADA_FIJA: ChecklistDef = {
  safetyCategory: "Funcionamiento ANSI/ISEA Z358.1 Sección 7",
  categories: [
    {
      label: "Acceso y señalización",
      items: [
        "Señalización verde visible (NOM-026 / ANSI Z358.1)",
        "Acceso libre en ≤10 segundos (≤16.8 m)",
        "Sin obstrucciones en la ruta de acceso",
        "Área bien iluminada",
        "Piso antiderrapante en zona de activación",
      ],
    },
    {
      label: "Regadera de emergencia",
      items: [
        "Válvula de acción única, activación en ≤1 segundo",
        "Permanece activa sin sostener (stay-open valve)",
        "Flujo de agua mínimo 76 L/min",
        "Patrón de agua cubre cabeza y hombros completos",
        "Cabezal limpio y sin obstrucciones",
      ],
    },
    {
      label: "Lavaojos",
      items: [
        "Ambas boquillas funcionan simultáneamente",
        "Flujo mínimo 1.5 L/min por boquilla",
        "Flujo suave hacia arriba (no traumático)",
        "Boquillas limpias y con protector",
        "Altura boquillas 83–114 cm del piso",
      ],
    },
    {
      label: "Agua y temperatura",
      items: [
        "Temperatura tibia 15–37 °C (ambas funciones)",
        "Flujo continuo garantizado ≥15 minutos",
        "Activación simultánea posible regadera + lavaojos",
      ],
    },
    {
      label: "Estado físico",
      items: [
        "Sin corrosión ni herrumbre en tubería y cuerpo",
        "Sin fugas en válvula, tubería o conexiones",
        "Cubierta/protector de boquillas presente",
      ],
    },
    {
      label: "Documentación",
      items: [
        "Prueba semanal registrada y vigente",
        "Inspección anual documentada",
        "Placa de identificación legible",
      ],
    },
  ],
};

// Unidad combinada portátil gravedad
const CHECKLIST_COMBINADA_PORTATIL_GRAVEDAD: ChecklistDef = {
  safetyCategory: "Funcionamiento ANSI/ISEA Z358.1 Sección 7",
  categories: [
    {
      label: "Acceso y señalización",
      items: [
        "Señalización verde visible",
        "Acceso libre en ≤10 segundos",
        "Área bien iluminada",
      ],
    },
    {
      label: "Nivel y contenido",
      items: [
        "Nivel de agua suficiente para ≥15 minutos",
        "Agua limpia sin contaminación visible",
        "Tapa hermética y sin daños",
        "Sello de tamper intacto",
      ],
    },
    {
      label: "Regadera de emergencia",
      items: [
        "Válvula de acción única, activación en ≤1 segundo",
        "Flujo de agua adecuado por gravedad",
        "Cabezal limpio y funcional",
      ],
    },
    {
      label: "Lavaojos",
      items: [
        "Ambas boquillas funcionan simultáneamente",
        "Flujo suave y adecuado",
        "Boquillas limpias y con protector",
      ],
    },
    {
      label: "Estado físico",
      items: [
        "Tanque sin golpes, grietas ni deformaciones",
        "Sin fugas en válvulas o conexiones",
        "Soporte/base estable y seguro",
      ],
    },
    {
      label: "Documentación",
      items: [
        "Fecha de última recarga visible y vigente",
        "Prueba semanal registrada",
        "Placa de identificación legible",
      ],
    },
  ],
};

// Unidad combinada portátil presión
const CHECKLIST_COMBINADA_PORTATIL_PRESION: ChecklistDef = {
  safetyCategory: "Funcionamiento ANSI/ISEA Z358.1 Sección 7",
  categories: [
    {
      label: "Acceso y señalización",
      items: [
        "Señalización verde visible",
        "Acceso libre en ≤10 segundos",
        "Área bien iluminada",
      ],
    },
    {
      label: "Presión y contenido",
      items: [
        "Manómetro/indicador de presión en zona verde",
        "Presión dentro del rango especificado por fabricante",
        "Fecha de última recarga visible y vigente",
        "Sello de seguridad intacto",
      ],
    },
    {
      label: "Regadera de emergencia",
      items: [
        "Válvula de acción única, activación en ≤1 segundo",
        "Flujo de agua adecuado y constante",
        "Cabezal limpio y sin obstrucciones",
      ],
    },
    {
      label: "Lavaojos",
      items: [
        "Ambas boquillas funcionan simultáneamente",
        "Flujo suave a presión controlada",
        "Boquillas limpias y con protector",
      ],
    },
    {
      label: "Estado físico",
      items: [
        "Cilindro sin golpes, corrosión ni deformaciones",
        "Sin fugas en válvula, manguera o boquillas",
        "Soporte/base estable",
      ],
    },
    {
      label: "Documentación",
      items: [
        "Inspección anual documentada",
        "Prueba semanal registrada",
        "Placa de identificación legible",
      ],
    },
  ],
};

// Mantener alias para compatibilidad con datos existentes
const CHECKLIST_REGADERA = CHECKLIST_REGADERA_FIJA;

const CHECKLIST_GENERAL: ChecklistDef = {
  safetyCategory: "Seguridad",
  categories: [
    {
      label: "Seguridad",
      items: [
        "Protecciones y guardas en su lugar",
        "Señalización de riesgo visible",
        "Dispositivo de paro de emergencia funcional",
      ],
    },
    {
      label: "Estado Visual",
      items: [
        "Estado general sin daños",
        "Sin fugas visibles",
        "Sin oxidación o corrosión severa",
      ],
    },
    {
      label: "Documentación",
      items: ["Placa de identificación legible", "Registro de mantenimiento al día"],
    },
  ],
};

function getChecklist(equipmentType: string): ChecklistDef {
  const t = (equipmentType ?? "").toLowerCase();
  if (t.includes("extintor")) return CHECKLIST_EXTINTOR;
  if (t.includes("hidrante") || t.includes("manguera") || t.includes("caseta")) return CHECKLIST_HIDRANTE;
  if (t.includes("camilla")) return CHECKLIST_CAMILLA;
  if (t.includes("nfpa") || t.includes("sci") || t.includes("rociador") || t.includes("supresion") || t.includes("co2") || t.includes("agente limpio")) return CHECKLIST_SCI;
  if (t.includes("regadera") && (t.includes("lavaojo") || t.includes("lavaojos"))) {
    if (t.includes("presion") || t.includes("presión")) return CHECKLIST_COMBINADA_PORTATIL_PRESION;
    if (t.includes("gravedad") || t.includes("portatil") || t.includes("portátil")) return CHECKLIST_COMBINADA_PORTATIL_GRAVEDAD;
    return CHECKLIST_COMBINADA_FIJA;
  }
  if (t.includes("lavaojo") || t.includes("lavaojos")) {
    if (t.includes("presion") || t.includes("presión")) return CHECKLIST_LAVAOJOS_PORTATIL_PRESION;
    if (t.includes("gravedad") || t.includes("portatil") || t.includes("portátil")) return CHECKLIST_LAVAOJOS_PORTATIL_GRAVEDAD;
    return CHECKLIST_LAVAOJOS_FIJO;
  }
  if (t.includes("regadera")) {
    if (t.includes("presion") || t.includes("presión")) return CHECKLIST_REGADERA_PORTATIL_PRESION;
    if (t.includes("gravedad") || t.includes("portatil") || t.includes("portátil")) return CHECKLIST_REGADERA_PORTATIL_GRAVEDAD;
    return CHECKLIST_REGADERA_FIJA;
  }
  return CHECKLIST_GENERAL;
}

// ─── State builders ───────────────────────────────────────────────────────────

function buildInitialItems(def: ChecklistDef): InspectionItem[] {
  return def.categories.flatMap((cat) =>
    cat.items.map((item) => ({
      category: cat.label,
      item_name: item,
      result: "NA" as ItemResult,
      comment: "",
    }))
  );
}

async function fetchChecklistFromApi(type: string): Promise<ChecklistDef | null> {
  try {
    const res = await axios.get(`${API_URL}/mobile/checklist?type=${encodeURIComponent(type)}`, { timeout: 4000 });
    const data = res.data as { categories: { label: string; items: string[] }[]; safetyCategory: string };
    if (data.categories?.length > 0) {
      return { categories: data.categories.map(c => ({ label: c.label, items: c.items })), safetyCategory: data.safetyCategory };
    }
  } catch {}
  return null;
}

const RESULT_OPTIONS: { value: ItemResult; label: string; color: string }[] = [
  { value: "PASS", label: "OK", color: "#00875A" },
  { value: "FAIL", label: "FALLA", color: "#CE0D0D" },
  { value: "NA", label: "N/A", color: "#8A9BBE" },
];

function calcOverall(items: InspectionItem[], safetyCategory: string): "PASS" | "FAIL" | "CONDITIONAL" {
  const answered = items.filter((i) => i.result !== "NA");
  if (answered.length === 0) return "CONDITIONAL";
  if (answered.some((i) => i.result === "FAIL")) {
    const criticalFail = items.some((i) => i.category === safetyCategory && i.result === "FAIL");
    return criticalFail ? "FAIL" : "CONDITIONAL";
  }
  return "PASS";
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InspectionScreen({ navigation, route }: Props) {
  const { inspectorId, equipment, rutaId, rutaItemId } = route.params;
  const fallback = getChecklist(equipment.type);
  const [checklist, setChecklist] = useState<ChecklistDef>(fallback);
  const [items, setItems] = useState<InspectionItem[]>(buildInitialItems(fallback));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const idempotencyKey = useRef(`insp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
  const { location } = useLocation();

  // Try loading from DB; replace if successful
  useEffect(() => {
    fetchChecklistFromApi(equipment.type).then(def => {
      if (def) {
        setChecklist(def);
        setItems(buildInitialItems(def));
      }
    });
  }, [equipment.type]);

  const setItemResult = (idx: number, result: ItemResult) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, result } : it)));
  };

  const overall = calcOverall(items, checklist.safetyCategory);
  const overallColor = overall === "PASS" ? "#00875A" : overall === "FAIL" ? "#CE0D0D" : "#E07B00";
  const overallLabel = overall === "PASS" ? "APROBADO" : overall === "FAIL" ? "RECHAZADO" : "CONDICIONAL";

  const handleAddPhoto = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert("Permiso requerido", "Se necesita acceso a la cámara para tomar fotos.");
        return;
      }
    }
    setShowCamera(true);
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const pic = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (pic?.uri) {
        setPhotos(prev => [...prev, pic.uri]);
        setShowCamera(false);
      }
    } catch {
      Alert.alert("Error", "No se pudo tomar la foto.");
    }
  };

  const handleSubmit = async () => {
    const answered = items.filter((i) => i.result !== "NA").length;
    if (answered === 0) {
      Alert.alert("Formulario incompleto", "Evalúa al menos un ítem antes de enviar.");
      return;
    }
    setSubmitting(true);

    // Try to get fresh GPS if not yet available
    let lat = location?.lat ?? null;
    let lng = location?.lng ?? null;
    if ((lat === null || lng === null) && (await Location.requestForegroundPermissionsAsync()).status === "granted") {
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {}
    }

    const payload = {
      inspector_id: inspectorId,
      equipment_id: equipment.id,
      overall_result: overall,
      notes,
      items,
      photos,
      lat,
      lng,
      idempotency_key: idempotencyKey.current,
    };

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      await queueInspection(payload);
      setSubmitting(false);
      Alert.alert(
        "Sin conexión — Guardado localmente",
        "Se enviará automáticamente cuando haya internet.",
        [{ text: "OK", onPress: () => navigation.navigate("Home", { inspectorId }) }]
      );
      return;
    }

    try {
      const res = await axios.post<{ id: string }>(`${API_URL}/inspections`, payload);
      const inspectionId = res.data?.id;

      // If part of a route, mark the item as inspected
      if (rutaId && rutaItemId) {
        try {
          await axios.patch(`${API_URL}/mobile/rutas`, {
            item_id: rutaItemId,
            status: "inspeccionado",
            inspection_id: inspectionId,
            ruta_id: rutaId,
          });
        } catch { /* non-blocking */ }
      }

      const onOk = () => rutaId
        ? navigation.goBack()  // go back to RouteScreen
        : navigation.navigate("Home", { inspectorId });

      Alert.alert("Inspección enviada", `Resultado: ${overallLabel}`, [
        { text: "OK", onPress: onOk },
      ]);
    } catch {
      await queueInspection(payload);
      Alert.alert(
        "Error de red — Guardado localmente",
        "Se subirá automáticamente al reconectarse.",
        [{ text: "OK", onPress: () => navigation.navigate("Home", { inspectorId }) }]
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inspección</Text>
        <View style={{ width: 70 }}>
          {location && <Text style={styles.gpsText}>📍 GPS</Text>}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Equipment card */}
        <View style={styles.equipCard}>
          <View style={styles.equipBadge}>
            <Text style={styles.equipBadgeText}>{equipment.type || "EQUIPO"}</Text>
          </View>
          <Text style={styles.equipName}>{equipment.name}</Text>
          <Text style={styles.equipDetail}>📍 {equipment.location || "Sin ubicación"}</Text>
          <Text style={styles.equipDetail}>🔖 S/N: {equipment.serial_number || "—"}</Text>
          <Text style={styles.equipDetail}>QR: {equipment.qr_code}</Text>
        </View>

        {/* Overall result indicator */}
        <View style={[styles.overallBar, { backgroundColor: overallColor }]}>
          <Text style={styles.overallText}>Resultado actual: {overallLabel}</Text>
        </View>

        {/* Checklist por categoría */}
        {checklist.categories.map((cat) => (
          <View key={cat.label} style={styles.catSection}>
            <Text style={[
              styles.catLabel,
              cat.label === checklist.safetyCategory && styles.catLabelCritical,
            ]}>
              {cat.label === checklist.safetyCategory ? "⚠ " : ""}{cat.label}
            </Text>
            {items
              .filter((it) => it.category === cat.label)
              .map((item) => {
                const absIdx = items.findIndex(
                  (it) => it.category === cat.label && it.item_name === item.item_name
                );
                return (
                  <View key={item.item_name} style={styles.itemRow}>
                    <Text style={styles.itemName}>{item.item_name}</Text>
                    <View style={styles.resultBtns}>
                      {RESULT_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[
                            styles.resultBtn,
                            item.result === opt.value && { backgroundColor: opt.color, borderColor: opt.color },
                          ]}
                          onPress={() => setItemResult(absIdx, opt.value)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.resultBtnText, item.result === opt.value && { color: "#fff" }]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })}
          </View>
        ))}

        {/* Photos */}
        <View style={styles.notesSection}>
          <Text style={styles.catLabel}>Fotografías de evidencia</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {photos.map((uri, i) => (
              <View key={i} style={styles.photoThumb}>
                <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                >
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 8 && (
              <TouchableOpacity style={styles.addPhotoBtn} onPress={handleAddPhoto} activeOpacity={0.75}>
                <Text style={{ fontSize: 28, color: "#8A9BBE" }}>📷</Text>
                <Text style={{ fontSize: 11, color: "#8A9BBE", marginTop: 4 }}>Agregar</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* Notes */}
        <View style={styles.notesSection}>
          <Text style={styles.catLabel}>Observaciones</Text>
          <UpperInput
            style={styles.notesInput}
            value={notes}
            onChangeText={v => setNotes(v.toUpperCase())}
            autoCapitalize="characters"
            placeholder="OBSERVACIONES ADICIONALES..."
            placeholderTextColor="#8A9BBE"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: overallColor }, submitting && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.submitText}>Enviar Inspección</Text>
              <Text style={styles.submitSub}>{overallLabel}</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Camera modal */}
      <Modal visible={showCamera} animationType="slide" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
          <View style={styles.camControls}>
            <TouchableOpacity style={styles.camCancel} onPress={() => setShowCamera(false)}>
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.camShutter} onPress={takePhoto} activeOpacity={0.8}>
              <View style={styles.camShutterInner} />
            </TouchableOpacity>
            <View style={{ width: 90 }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const BLUE = "#122B60";

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F4F6FB" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: BLUE, paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  backText: { color: "#8AAEE0", fontSize: 14 },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  gpsText: { color: "#4ADE80", fontSize: 12, fontWeight: "700", textAlign: "right" },
  content: { padding: 16 },
  equipCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 12,
    elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  equipBadge: {
    alignSelf: "flex-start", backgroundColor: "#EEF2FB",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 8,
  },
  equipBadgeText: { color: BLUE, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  equipName: { fontSize: 18, fontWeight: "800", color: "#1A2740", marginBottom: 6 },
  equipDetail: { fontSize: 13, color: "#5A6E8C", marginTop: 3 },
  overallBar: { borderRadius: 10, paddingVertical: 10, alignItems: "center", marginBottom: 20 },
  overallText: { color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: 0.5 },
  catSection: { marginBottom: 20 },
  catLabel: { fontSize: 12, fontWeight: "700", color: "#5A6E8C", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  catLabelCritical: { color: "#CE0D0D" },
  itemRow: {
    backgroundColor: "#fff", borderRadius: 10, padding: 12, marginBottom: 8,
    elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  itemName: { fontSize: 13, color: "#1A2740", marginBottom: 10, lineHeight: 18 },
  resultBtns: { flexDirection: "row", gap: 8 },
  resultBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: "#D0D9EB", alignItems: "center" },
  resultBtnText: { fontSize: 12, fontWeight: "700", color: "#8A9BBE" },
  notesSection: { marginBottom: 20 },
  notesInput: {
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: "#1A2740", borderWidth: 1.5, borderColor: "#D0D9EB", minHeight: 100,
  },
  submitBtn: { borderRadius: 14, paddingVertical: 18, alignItems: "center", elevation: 4, shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  btnDisabled: { opacity: 0.7 },
  submitText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  submitSub: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 3 },
  photoThumb: { position: "relative" },
  photoRemove: { position: "absolute", top: -6, right: -6, backgroundColor: "#CE0D0D", borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  addPhotoBtn: { width: 80, height: 80, borderRadius: 8, borderWidth: 2, borderColor: "#D0D9EB", borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  camControls: { paddingBottom: 40, paddingTop: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, backgroundColor: "rgba(0,0,0,0.7)" },
  camCancel: { paddingVertical: 10, paddingHorizontal: 18 },
  camShutter: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff" },
  camShutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff" },
});
