import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList, AppUser } from "../types";
import { API_URL } from "../constants/api";
import axios from "axios";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Prestamos">;
  route: { params: { user: AppUser } };
};

type Prestamo = {
  id: string;
  folio: string;
  monto_total: number;
  monto_pagado: number;
  saldo: number;
  cuotas: number;
  frecuencia: string;
  status: string;
  notas: string;
  created_at: string;
};

const FREQ_LABEL: Record<string, string> = {
  semanal: "Semanal", quincenal: "Quincenal", mensual: "Mensual",
};

export default function PrestamosScreen({ navigation, route }: Props) {
  const { user } = route.params;
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/mobile/prestamos?employee_id=${user.employee_id}`);
        setPrestamos(res.data.data ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [user.employee_id]);

  const activos = prestamos.filter(p => p.status === "activo");
  const totalDeuda = activos.reduce((s, p) => s + p.saldo, 0);
  const totalPagado = prestamos.reduce((s, p) => s + p.monto_pagado, 0);

  return (
    <SafeAreaView style={st.safe}>
      <View style={st.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.back}>
          <Text style={st.backText}>← Atrás</Text>
        </TouchableOpacity>
        <Text style={st.title}>Mis Préstamos</Text>
      </View>

      {/* Resumen */}
      <View style={st.summary}>
        <View style={st.summaryCard}>
          <Text style={[st.summaryValue, { color: "#EF4444" }]}>
            ${totalDeuda.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </Text>
          <Text style={st.summaryLabel}>Saldo pendiente</Text>
        </View>
        <View style={st.summaryCard}>
          <Text style={[st.summaryValue, { color: "#10B981" }]}>
            ${totalPagado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </Text>
          <Text style={st.summaryLabel}>Total pagado</Text>
        </View>
        <View style={st.summaryCard}>
          <Text style={[st.summaryValue, { color: "#F59E0B" }]}>
            {activos.length}
          </Text>
          <Text style={st.summaryLabel}>Préstamos activos</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#8B5CF6" size="large" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={st.list}>
          {prestamos.length === 0 && (
            <Text style={st.empty}>Sin préstamos registrados</Text>
          )}
          {prestamos.map(p => {
            const isActive = p.status === "activo";
            const pct = p.monto_total > 0 ? p.monto_pagado / p.monto_total : 1;
            return (
              <TouchableOpacity
                key={p.id}
                style={[st.card, isActive && st.cardActive]}
                onPress={() => setExpanded(expanded === p.id ? null : p.id)}
              >
                <View style={st.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.cardFolio}>{p.folio}</Text>
                    <Text style={st.cardSub}>
                      {FREQ_LABEL[p.frecuencia] ?? p.frecuencia} · {p.cuotas} cuotas
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={[st.cardSaldo, { color: isActive ? "#EF4444" : "#10B981" }]}>
                      {isActive
                        ? `$${p.saldo.toLocaleString("es-MX", { minimumFractionDigits: 2 })} restante`
                        : "✓ Liquidado"}
                    </Text>
                    <View style={[st.badge, { backgroundColor: isActive ? "#FEF3C722" : "#D1FAE522" }]}>
                      <Text style={[st.badgeText, { color: isActive ? "#F59E0B" : "#10B981" }]}>
                        {isActive ? "Activo" : "Pagado"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Barra de progreso */}
                <View style={st.barBg}>
                  <View style={[st.barFill, { width: `${Math.min(pct * 100, 100)}%` as any }]} />
                </View>
                <Text style={st.barLabel}>
                  ${p.monto_pagado.toLocaleString("es-MX", { minimumFractionDigits: 0 })} de ${p.monto_total.toLocaleString("es-MX", { minimumFractionDigits: 0 })} pagado ({Math.round(pct * 100)}%)
                </Text>

                {expanded === p.id && (
                  <View style={st.detail}>
                    <Row label="Préstamo total" value={`$${p.monto_total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`} />
                    <Row label="Pagado" value={`$${p.monto_pagado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`} valueColor="#10B981" />
                    {isActive && (
                      <Row label="Saldo restante" value={`$${p.saldo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`} valueColor="#EF4444" bold />
                    )}
                    <Row label="Frecuencia de pago" value={FREQ_LABEL[p.frecuencia] ?? p.frecuencia} />
                    <Row label="Número de cuotas" value={String(p.cuotas)} />
                    <Row label="Fecha de solicitud" value={p.created_at.slice(0, 10)} />
                    {p.notas ? <Row label="Notas" value={p.notas} /> : null}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value, valueColor, bold }: {
  label: string; value: string; valueColor?: string; bold?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
      <Text style={{ color: "#9CA3AF", fontSize: 12 }}>{label}</Text>
      <Text style={{ color: valueColor ?? "#F1F5F9", fontSize: 12, fontWeight: bold ? "800" : "500", flexShrink: 1, textAlign: "right", marginLeft: 8 }}>
        {value}
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: "#0A1628" },
  topBar:       { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  back:         { marginRight: 12 },
  backText:     { color: "#8B5CF6", fontSize: 14, fontWeight: "600" },
  title:        { flex: 1, color: "#fff", fontSize: 18, fontWeight: "800" },
  summary:      { flexDirection: "row", gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  summaryCard:  { flex: 1, backgroundColor: "rgba(139,92,246,0.1)", borderRadius: 10, padding: 12, alignItems: "center" },
  summaryValue: { fontSize: 15, fontWeight: "800" },
  summaryLabel: { color: "#6B7280", fontSize: 10, marginTop: 3, textAlign: "center" },
  list:         { padding: 14, paddingBottom: 40 },
  empty:        { color: "#6B7280", textAlign: "center", marginTop: 30, fontSize: 14 },
  card:         { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, marginBottom: 10, padding: 14, overflow: "hidden" },
  cardActive:   { borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  cardHeader:   { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  cardFolio:    { color: "#fff", fontWeight: "700", fontSize: 15 },
  cardSub:      { color: "#6B88A8", fontSize: 12, marginTop: 2 },
  cardSaldo:    { fontWeight: "800", fontSize: 14 },
  badge:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badgeText:    { fontSize: 11, fontWeight: "700" },
  barBg:        { height: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 99, marginBottom: 4 },
  barFill:      { height: 6, backgroundColor: "#10B981", borderRadius: 99 },
  barLabel:     { color: "#6B7280", fontSize: 10, marginBottom: 4 },
  detail:       { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)", paddingTop: 12, marginTop: 8 },
});
