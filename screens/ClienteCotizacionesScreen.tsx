import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList, AppUser } from "../types";
import { API_URL } from "../constants/api";
import axios from "axios";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "ClienteCotizaciones">;
  route: { params: { user: AppUser } };
};

type Cotizacion = {
  id: string;
  folio: string;
  client_name: string;
  subtotal: number;
  iva: number;
  total: number;
  status: string;
  valid_days: number;
  notas: string;
  conditions: string;
  created_by: string;
  created_at: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  borrador:  { label: "Borrador",  color: "#6B7280", bg: "#F3F4F6" },
  enviada:   { label: "Enviada",   color: "#1D4ED8", bg: "#EFF6FF" },
  aprobada:  { label: "Aprobada",  color: "#059669", bg: "#ECFDF5" },
  rechazada: { label: "Rechazada", color: "#DC2626", bg: "#FEF2F2" },
  vencida:   { label: "Vencida",   color: "#92400E", bg: "#FFFBEB" },
};

const fmt = (n: number) =>
  "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2 });

export default function ClienteCotizacionesScreen({ navigation, route }: Props) {
  const { user } = route.params;
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [stats, setStats] = useState<{ total: number; pendientes: number; aprobadas: number; monto_aprobado: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user.client_id) return;
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/mobile/cliente/cotizaciones?client_id=${user.client_id}`);
        setCotizaciones(res.data.data ?? []);
        setStats(res.data.stats);
      } catch {
        Alert.alert("Error", "No se pudieron cargar las cotizaciones");
      } finally {
        setLoading(false);
      }
    })();
  }, [user.client_id]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={s.title}>Mis Cotizaciones</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#fff" size="large" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {stats && (
            <View style={s.kpiRow}>
              <View style={s.kpiCard}>
                <Text style={s.kpiVal}>{stats.total}</Text>
                <Text style={s.kpiLbl}>Total</Text>
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiVal}>{stats.pendientes}</Text>
                <Text style={s.kpiLbl}>Pendientes</Text>
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiVal}>{stats.aprobadas}</Text>
                <Text style={s.kpiLbl}>Aprobadas</Text>
              </View>
            </View>
          )}

          {cotizaciones.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>📋</Text>
              <Text style={s.emptyText}>Sin cotizaciones aún</Text>
            </View>
          ) : (
            cotizaciones.map(cot => {
              const st = STATUS_LABELS[cot.status] ?? STATUS_LABELS.borrador;
              const open = expanded === cot.id;
              return (
                <TouchableOpacity
                  key={cot.id}
                  style={s.card}
                  onPress={() => setExpanded(open ? null : cot.id)}
                  activeOpacity={0.85}
                >
                  <View style={s.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.folio}>{cot.folio}</Text>
                      <Text style={s.date}>{cot.created_at.slice(0, 10)} · Elaboró: {cot.created_by}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: st.bg }]}>
                      <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>

                  <View style={s.totalRow}>
                    <Text style={s.totalLabel}>Total</Text>
                    <Text style={s.totalValue}>{fmt(cot.total)}</Text>
                  </View>

                  {open && (
                    <View style={s.detail}>
                      <View style={s.detailRow}>
                        <Text style={s.detailLbl}>Subtotal</Text>
                        <Text style={s.detailVal}>{fmt(cot.subtotal)}</Text>
                      </View>
                      <View style={s.detailRow}>
                        <Text style={s.detailLbl}>IVA (16%)</Text>
                        <Text style={s.detailVal}>{fmt(cot.iva)}</Text>
                      </View>
                      {cot.valid_days > 0 && (
                        <View style={s.detailRow}>
                          <Text style={s.detailLbl}>Vigencia</Text>
                          <Text style={s.detailVal}>{cot.valid_days} días</Text>
                        </View>
                      )}
                      {cot.conditions ? (
                        <View style={s.detailRow}>
                          <Text style={s.detailLbl}>Condiciones</Text>
                          <Text style={s.detailVal}>{cot.conditions}</Text>
                        </View>
                      ) : null}
                      {cot.notas ? (
                        <View style={[s.detailRow, { flexDirection: "column", gap: 4 }]}>
                          <Text style={s.detailLbl}>Notas</Text>
                          <Text style={[s.detailVal, { textAlign: "left" }]}>{cot.notas}</Text>
                        </View>
                      ) : null}
                      <TouchableOpacity
                        style={s.printBtn}
                        onPress={() => Linking.openURL(`https://app.masi.com.mx/cotizaciones/${cot.id}/imprimir`)}
                      >
                        <Text style={s.printBtnText}>🖨 Ver / Descargar PDF</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#0A1628" },
  header:      { flexDirection: "row", alignItems: "center", gap: 12, padding: 20, paddingBottom: 12 },
  back:        { paddingVertical: 6 },
  backText:    { color: "#9FC3E8", fontSize: 14 },
  title:       { color: "#fff", fontSize: 18, fontWeight: "800" },
  scroll:      { padding: 16, paddingBottom: 40 },
  kpiRow:      { flexDirection: "row", gap: 10, marginBottom: 20 },
  kpiCard:     { flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12, padding: 14, alignItems: "center" },
  kpiVal:      { color: "#fff", fontSize: 20, fontWeight: "800" },
  kpiLbl:      { color: "#7A9CBF", fontSize: 11, marginTop: 3, textAlign: "center" },
  empty:       { alignItems: "center", marginTop: 60 },
  emptyIcon:   { fontSize: 48, marginBottom: 12 },
  emptyText:   { color: "#4A6A90", fontSize: 16 },
  card:        { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  cardTop:     { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  folio:       { color: "#fff", fontWeight: "800", fontSize: 15 },
  date:        { color: "#4A6A90", fontSize: 12, marginTop: 2 },
  badge:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  badgeText:   { fontSize: 11, fontWeight: "800" },
  totalRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel:  { color: "#7A9CBF", fontSize: 13 },
  totalValue:  { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  detail:      { marginTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)", paddingTop: 14 },
  detailRow:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  detailLbl:   { color: "#7A9CBF", fontSize: 13 },
  detailVal:   { color: "#CBD5E1", fontSize: 13, textAlign: "right", flex: 1, marginLeft: 16 },
  printBtn:    { marginTop: 8, backgroundColor: "#1E40AF", borderRadius: 8, padding: 12, alignItems: "center" },
  printBtnText:{ color: "#fff", fontWeight: "700", fontSize: 13 },
});
