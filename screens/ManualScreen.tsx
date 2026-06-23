import React, { useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../types";
import { useTheme } from "../hooks/useTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Manual">;
  route: RouteProp<RootStackParamList, "Manual">;
};

type Section = { title: string; icon: string; items: string[] };

const MANUALS: Record<string, { label: string; color: string; sections: Section[] }> = {
  inspector: {
    label: "Manual del Inspector",
    color: "#CE0D0D",
    sections: [
      {
        title: "Inicio de sesión",
        icon: "🔐",
        items: [
          "En la pantalla inicial toca el botón azul oscuro 'MASI'.",
          "Selecciona la pestaña 'Inspector' y escribe tu correo y contraseña.",
          "Si olvidaste tu contraseña, contacta al administrador.",
        ],
      },
      {
        title: "Inspecciones",
        icon: "🔍",
        items: [
          "En el Home, toca 'Mis Inspecciones' para ver el listado.",
          "Escanea el código QR del equipo para iniciar una inspección.",
          "Responde cada ítem del checklist: PASS / FAIL / N/A.",
          "Los ítems marcados en rojo son CRÍTICOS — requieren comentario.",
          "Al finalizar, toca 'Enviar Inspección'. Se sincroniza automáticamente.",
          "Si no hay internet, la inspección se guarda offline y se envía al reconectar.",
        ],
      },
      {
        title: "Rutas de inspección",
        icon: "🗺️",
        items: [
          "Las rutas asignadas aparecen en 'Mis Rutas'.",
          "Cada ruta muestra los equipos a inspeccionar en orden.",
          "Escanea el QR de cada equipo para marcarlo como inspeccionado.",
          "El progreso se actualiza en tiempo real en la plataforma.",
        ],
      },
      {
        title: "Levantamientos",
        icon: "📋",
        items: [
          "Un levantamiento es el registro inicial de equipos en un sitio.",
          "Accede desde 'Levantamiento' en el menú principal.",
          "Registra cada extintor / equipo con sus datos y fotos.",
          "Al completar, el levantamiento queda disponible en la plataforma.",
        ],
      },
      {
        title: "Normativas aplicables",
        icon: "📜",
        items: [
          "Extintores: NOM-002-STPS-2010.",
          "Líneas de vida: NOM-009-STPS-2011.",
          "ERA (Respiración autónoma): NOM-116-STPS-2009.",
          "Sistemas CO₂ y agentes limpios: NFPA 12 / NFPA 2001.",
          "Rociadores automáticos: NFPA 13.",
          "Espuma AFFF: NFPA 16.",
          "Bombas contra incendio: NFPA 20.",
          "Alarmas de incendio: NFPA 72.",
          "Supresión en cocinas: NFPA 96.",
          "Puertas de emergencia: NOM-003-SEGOB-2011.",
        ],
      },
      {
        title: "Soporte",
        icon: "🛠️",
        items: [
          "Problemas técnicos: escribe al chat de la app o llama a soporte.",
          "Para resetear contraseña o permisos: contacta al administrador.",
          "Versión actual: 1.2.20 (versionCode 28). Asegúrate de tener la APK más reciente instalada.",
          "Al cerrar sesión, las inspecciones y jornadas pendientes se limpian del dispositivo. Asegúrate de sincronizar antes de salir.",
        ],
      },
    ],
  },
  taller: {
    label: "Manual del Técnico de Taller",
    color: "#D97706",
    sections: [
      {
        title: "Inicio de sesión",
        icon: "🔐",
        items: [
          "En la pantalla inicial toca el botón azul oscuro 'MASI'.",
          "Selecciona la pestaña 'Taller' y escribe tu correo y contraseña.",
          "Entrarás directamente al módulo de taller.",
        ],
      },
      {
        title: "Órdenes de trabajo",
        icon: "📋",
        items: [
          "Al entrar verás las órdenes de trabajo asignadas.",
          "Filtra por estado: Todas, Abiertas, En proceso o Cerradas.",
          "Toca una orden para ver detalle y actualizar su estado.",
          "Avanza la orden: Abierta → En proceso → Cerrada.",
        ],
      },
      {
        title: "Prueba Hidrostática (PH)",
        icon: "💧",
        items: [
          "Toca el botón 'Prueba PH' en la fila de accesos rápidos (parte superior).",
          "Escanea el código QR del cilindro o ingrésalo manualmente y toca OK.",
          "Selecciona la clase de presión: BAJA (extintores estándar) o ALTA (cartucho / CO₂).",
          "Al escanear el QR, el tipo de agente, número de serie y capacidad se rellenan automáticamente.",
          "Completa: año de fabricación, duración de prueba (segundos) y resultado PASS o FAIL.",
          "Si el resultado es FAIL, aparece el campo 'Causa de rechazo' — es obligatorio llenarlo.",
          "Fotos de evidencia: toca 📷 Cámara o 🖼 Galería para agregar hasta 15 fotos. Aparecen como miniaturas; toca ✕ para eliminar.",
          "Al guardar se genera un folio PH-YYYY-NNNN y las fotos quedan vinculadas al certificado en la plataforma.",
        ],
      },
      {
        title: "Prueba de Mangueras",
        icon: "🌊",
        items: [
          "Toca el botón 'Manguera' en la fila de accesos rápidos (parte superior).",
          "Escanea el código QR de la manguera o ingrésalo manualmente.",
          "Selecciona diámetro, ingresa longitud y presión de prueba.",
          "Fotos de evidencia: toca 📷 Cámara o 🖼 Galería para agregar hasta 15 fotos.",
          "Al guardar se genera un folio MAN-YYYY-NNNN y las fotos quedan en el certificado de la plataforma.",
        ],
      },
      {
        title: "Bitácora de Recarga",
        icon: "🔧",
        items: [
          "Toca el botón '📋 Bitácora' en la fila de accesos rápidos (parte superior).",
          "Selecciona el cliente (opcional) y agrega cada equipo: tipo, capacidad (ej. 6 kg), número de serie y cantidad.",
          "Escribe el nombre del técnico que realiza la recarga.",
          "Puedes agregar hasta 4 fotos como evidencia.",
          "Al enviar se crea una Orden de Trabajo que solo el taller puede cerrar.",
        ],
      },
      {
        title: "Soporte",
        icon: "🛠️",
        items: [
          "Dudas sobre órdenes o clientes: usa el Chat de la app.",
          "Para permisos o contraseña: contacta al administrador.",
        ],
      },
    ],
  },
  vendedor: {
    label: "Manual del Vendedor",
    color: "#2563EB",
    sections: [
      {
        title: "Inicio de sesión",
        icon: "🔐",
        items: [
          "En la pantalla inicial toca el botón azul oscuro 'MASI'.",
          "Selecciona la pestaña 'Vendedor' y escribe tu correo y contraseña.",
          "Tu perfil de vendedor te da acceso a CRM, POS y cotizaciones.",
        ],
      },
      {
        title: "Cotizaciones en campo",
        icon: "📋",
        items: [
          "Toca 'Cotizaciones' para ver el listado y crear una nueva.",
          "Para un cliente nuevo: escribe el nombre y marca 'Guardar como cliente'.",
          "Para un cliente existente: selecciónalo del catálogo — el correo se autocompleta.",
          "Agrega los productos/servicios con descripción, cantidad y precio.",
          "Al enviar, puedes agregar correos CC adicionales para copias.",
          "La cotización llega al cliente con logo y datos fiscales de MASI.",
        ],
      },
      {
        title: "Punto de Venta (POS)",
        icon: "🏪",
        items: [
          "Accede a 'Punto de Venta' para ventas de mostrador.",
          "Escanea el código de barras o QR del producto para agregarlo automáticamente.",
          "También puedes buscar por nombre en la barra de búsqueda.",
          "Selecciona método de pago: efectivo, tarjeta, transferencia o crédito.",
          "Al cobrar, el stock se descuenta automáticamente y se registra en finanzas.",
        ],
      },
      {
        title: "Nuevos Leads",
        icon: "➕",
        items: [
          "Captura prospectos en campo desde 'Nuevo Lead'.",
          "Registra nombre, empresa, teléfono, correo y necesidad.",
          "El lead queda disponible para seguimiento en la plataforma.",
        ],
      },
      {
        title: "Pedidos internos",
        icon: "📦",
        items: [
          "Si necesitas material o muestra para una venta, usa 'Mis Pedidos'.",
          "El pedido es revisado por el almacén y te notifican cuando está listo.",
        ],
      },
      {
        title: "Soporte",
        icon: "🛠️",
        items: [
          "Dudas sobre precios o disponibilidad: usa el Chat de la app.",
          "Para acceso a nuevos clientes o actualización de catálogo: contacta al admin.",
        ],
      },
    ],
  },
  empleado: {
    label: "Manual del Empleado",
    color: "#7C3AED",
    sections: [
      {
        title: "Primer acceso — crea tu contraseña",
        icon: "🔐",
        items: [
          "En la pantalla inicial toca 'MASI' y selecciona la pestaña 'Empleado'.",
          "Escribe tu correo (el que te asignó RH) y toca 'Continuar'.",
          "Opción A — por correo: si tu cuenta tiene correo configurado, recibirás un código de 6 dígitos (revisa también spam).",
          "Opción B — código manual: RH puede mostrarte el código directamente desde la plataforma para compartirlo por WhatsApp.",
          "Ingresa el código, escribe tu nueva contraseña (mín. 6 caracteres) y confírmala.",
          "Toca 'Crear contraseña y entrar'. Tu contraseña es personal — nadie más la conoce.",
          "En accesos posteriores solo escribe tu correo → toca Continuar → ingresa tu contraseña.",
          "Si olvidaste tu contraseña, pide a RH que la restablezca desde la plataforma; luego repite el primer acceso.",
        ],
      },
      {
        title: "Solicitudes",
        icon: "📝",
        items: [
          "Accede a 'Mis Solicitudes' para ver el historial.",
          "Toca 'Nueva Solicitud' para vacaciones, permisos o préstamos.",
          "Recibirás notificación cuando se apruebe o rechace.",
        ],
      },
      {
        title: "Asistencia",
        icon: "⏰",
        items: [
          "Registra tu entrada y salida desde 'Asistencia'.",
          "La ubicación GPS se captura automáticamente al registrar.",
          "Usa el botón ↻ (esquina superior derecha) para actualizar y ver el registro del día en tiempo real.",
          "Si el botón no responde o aparece un aviso rojo: cierra sesión y vuelve a entrar — esto actualiza tu cuenta.",
        ],
      },
      {
        title: "Nómina y Préstamos",
        icon: "💵",
        items: [
          "Consulta tus recibos de nómina en 'Nómina'.",
          "Revisa el saldo de préstamos activos en 'Préstamos'.",
        ],
      },
      {
        title: "Pedidos de material",
        icon: "📦",
        items: [
          "Solicita material para tu área en 'Mis Pedidos'.",
          "El pedido pasa por aprobación antes de surtirse.",
          "Si sale error al enviar: cierra sesión y vuelve a entrar para actualizar tu cuenta.",
        ],
      },
    ],
  },
  cliente: {
    label: "Manual del Cliente",
    color: "#059669",
    sections: [
      {
        title: "Inicio de sesión",
        icon: "🔐",
        items: [
          "En la pantalla inicial toca el botón verde oscuro 'Portal Cliente'.",
          "Ingresa el correo y la contraseña que el equipo de Operaciones MASI te compartió.",
          "Toca 'Ingresar'. Si necesitas cambiar tu contraseña, contacta a tu ejecutivo MASI.",
          "El portal es solo de lectura: podrás ver reportes, equipos, inspecciones y cotizaciones.",
        ],
      },
      {
        title: "Reportes de inspección",
        icon: "📄",
        items: [
          "En 'Inspecciones' ves el historial de cada equipo.",
          "Toca 'PDF' para descargar el reporte oficial con datos de MASI.",
          "Los reportes muestran: resultado, ítems revisados, norm aplicada y observaciones.",
        ],
      },
      {
        title: "Equipos y vencimientos",
        icon: "⚠️",
        items: [
          "En 'Mis Equipos' ves todos los equipos registrados en tus sucursales.",
          "Los equipos próximos a vencer aparecen en amarillo/rojo.",
          "Contacta a MASI para agendar el servicio antes de la fecha de vencimiento.",
        ],
      },
      {
        title: "Cotizaciones",
        icon: "📋",
        items: [
          "Revisa las cotizaciones que MASI te ha enviado.",
          "Puedes ver el detalle, aceptar o solicitar cambios desde la app.",
        ],
      },
    ],
  },
};

export default function ManualScreen({ navigation, route }: Props) {
  const T = useTheme();
  const insets = useSafeAreaInsets();
  const { role, userName } = route.params;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const manualRole = role === "ventas" ? "taller" : role;
  const manual = MANUALS[manualRole] ?? MANUALS.inspector;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: T.isDark ? "#060C1A" : "#F0F4FB" }}>
      {/* Header */}
      <LinearGradient colors={["#0D1B3E", manual.color]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>← Atrás</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{manual.label}</Text>
        <Text style={s.headerSub}>Hola, {userName.split(" ")[0]} · MASI®</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {manual.sections.map((sec, si) => (
            <View
              key={si}
              style={[s.section, { backgroundColor: T.isDark ? "rgba(255,255,255,0.04)" : "#fff", borderColor: T.isDark ? "rgba(255,255,255,0.08)" : "#E5E7EB" }]}
            >
              <View style={s.secHeader}>
                <Text style={s.secIcon}>{sec.icon}</Text>
                <Text style={[s.secTitle, { color: manual.color }]}>{sec.title}</Text>
              </View>
              {sec.items.map((item, ii) => (
                <View key={ii} style={s.item}>
                  <View style={[s.bullet, { backgroundColor: manual.color }]} />
                  <Text style={[s.itemText, { color: T.isDark ? "#CBD5E1" : "#374151" }]}>{item}</Text>
                </View>
              ))}
            </View>
          ))}

          <View style={s.footer}>
            <Text style={s.footerText}>Multiservicios y Artículos de Seguridad Industrial, S.A. de C.V.®</Text>
            <Text style={[s.footerText, { marginTop: 2 }]}>RFC MAS900706QH1 · Monterrey, N.L.</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header:      { paddingBottom: 24, paddingHorizontal: 20 },
  backBtn:     { marginBottom: 12 },
  backText:    { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600" },
  headerTitle: { fontSize: 22, fontWeight: "900", color: "#fff", marginBottom: 4 },
  headerSub:   { fontSize: 12, color: "rgba(255,255,255,0.55)" },
  content:     { padding: 16, paddingBottom: 48 },
  section:     { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  secHeader:   { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 },
  secIcon:     { fontSize: 20 },
  secTitle:    { fontSize: 14, fontWeight: "800", flex: 1 },
  item:        { flexDirection: "row", alignItems: "flex-start", marginBottom: 8, gap: 8 },
  bullet:      { width: 6, height: 6, borderRadius: 3, marginTop: 6, flexShrink: 0 },
  itemText:    { fontSize: 13, lineHeight: 20, flex: 1 },
  footer:      { alignItems: "center", marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.08)" },
  footerText:  { fontSize: 11, color: "#9CA3AF", textAlign: "center" },
});
