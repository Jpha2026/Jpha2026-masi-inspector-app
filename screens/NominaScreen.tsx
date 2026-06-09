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
  navigation: NativeStackNavigationProp<RootStackParamList, "Nomina">;
  route: { params: { user: AppUser } };
};

type PagoRow = {
  id: string;
  folio: string;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  periodo_status: string;
  salario_base: number;
  bonos: number;
  deducciones: number;
  neto: number;
  pagado: number;
  fecha_pago: string | null;
  notas: string;
};

export default function NominaScreen({ navigation, route }: Props) {
  const { user } = route.params;
  const [pagos, setPagos] = useState<PagoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(
          `${API_URL}/mobile/nomina?employee_id=${user.employee_id}`
        );
        setPagos(res.data.data ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [user.employee_id]);

  const totalAnio = pagos
    .filter(p => p.pagado && p.fecha_inicio.startsWith(new Date().getFullYear().toString()))
    .reduce((s, p) => s + p.neto, 0);

  const tipoLabel: Record<string, string> = {
    quincenal: "Quincenal",
    semanal: "Semanal",
    mensual: "Mensual",
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Atrás</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mis Pagos</Text>
      </View>

      {/* Resumen anual */}
      <View style={styles.summary}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>
            ${totalAnio.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </Text>
          <Text style={styles.summaryLabel}>Total cobrado {new Date().getFullYear()}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{pagos.filter(p => p.pagado).length}</Text>
          <Text style={styles.summaryLabel}>Períodos pagados</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: "#F59E0B" }]}>
            {pagos.filter(p => !p.pagado).length}
          </Text>
          <Text style={styles.summaryLabel}>Pendientes</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#7C3AED" size="large" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {pagos.length === 0 && (
            <Text style={styles.empty}>Sin períodos de nómina registrados</Text>
          )}
          {pagos.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.card, !p.pagado && styles.cardPending]}
              onPress={() => setExpanded(expanded === p.id ? null : p.id)}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardFolio}>{p.folio}</Text>
                  <Text style={styles.cardPeriodo}>
                    {tipoLabel[p.tipo] ?? p.tipo} · {p.fecha_inicio.slice(0, 10)} – {p.fecha_fin.slice(0, 10)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={styles.cardNeto}>
                    ${p.neto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: p.pagado ? "#D1FAE522" : "#FEF3C722" }]}>
                    <Text style={[styles.badgeText, { color: p.pagado ? "#10B981" : "#F59E0B" }]}>
                      {p.pagado ? `✓ Pagado` : "Pendiente"}
                    </Text>
                  </View>
                </View>
              </View>

              {expanded === p.id && (
                <View style={styles.detail}>
                  <Row label="Salario base" value={`$${p.salario_base.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`} />
                  {p.bonos > 0 && (
                    <Row label="Bonos" value={`+$${p.bonos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`} valueColor="#10B981" />
                  )}
                  {p.deducciones > 0 && (
                    <Row label="Deducciones" value={`-$${p.deducciones.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`} valueColor="#EF4444" />
                  )}
                  <View style={styles.divider} />
                  <Row label="Neto" value={`$${p.neto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`} bold />
                  {p.fecha_pago && (
                    <Row label="Fecha pago" value={p.fecha_pago.slice(0, 10)} />
                  )}
                  {p.notas ? <Row label="Notas" value={p.notas} /> : null}
                </View>
              )}
            </TouchableOpacity>
          ))}
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
      <Text style={{ color: valueColor ?? "#F1F5F9", fontSize: 12, fontWeight: bold ? "800" : "500" }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: "#0A1628" },
  topBar:        { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  back:          { marginRight: 12 },
  backText:      { color: "#7C3AED", fontSize: 14, fontWeight: "600" },
  title:         { flex: 1, color: "#fff", fontSize: 18, fontWeight: "800" },
  summary:       { flexDirection: "row", gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  summaryCard:   { flex: 1, backgroundColor: "rgba(124,58,237,0.12)", borderRadius: 10, padding: 12, alignItems: "center" },
  summaryValue:  { color: "#C4B5FD", fontSize: 16, fontWeight: "800" },
  summaryLabel:  { color: "#7A6A9F", fontSize: 10, marginTop: 3, textAlign: "center" },
  list:          { padding: 14, paddingBottom: 40 },
  empty:         { color: "#6B7280", textAlign: "center", marginTop: 30, fontSize: 14 },
  card:          { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, marginBottom: 10, overflow: "hidden" },
  cardPending:   { borderWidth: 1, borderColor: "rgba(245,158,11,0.2)" },
  cardHeader:    { flexDirection: "row", alignItems: "flex-start", padding: 14 },
  cardFolio:     { color: "#fff", fontWeight: "700", fontSize: 15 },
  cardPeriodo:   { color: "#6B88A8", fontSize: 12, marginTop: 2 },
  cardNeto:      { color: "#C4B5FD", fontWeight: "800", fontSize: 16 },
  badge:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badgeText:     { fontSize: 11, fontWeight: "700" },
  detail:        { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)", padding: 14 },
  divider:       { height: 1, backgroundColor: "rgba(255,255,255,0.07)", marginVertical: 6 },
});
