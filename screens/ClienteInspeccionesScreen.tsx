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
  navigation: NativeStackNavigationProp<RootStackParamList, "ClienteInspecciones">;
  route: { params: { user: AppUser; equipment_id?: string; equipment_name?: string } };
};

type Inspeccion = {
  id: string;
  overall_result: string;
  notes: string;
  ai_summary: string;
  submitted_at: string;
  inspector_name: string;
  equipment_name: string;
  equipment_type: string;
  location: string;
  equipment_id?: string;
};

export default function ClienteInspeccionesScreen({ navigation, route }: Props) {
  const { user, equipment_id, equipment_name } = route.params;
  const [inspecciones, setInspecciones] = useState<Inspeccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"todos" | "PASS" | "FAIL" | "CONDITIONAL">("todos");

  useEffect(() => {
    (async () => {
      try {
        let url = `${API_URL}/mobile/cliente/inspecciones?client_id=${user.client_id}`;
        if (equipment_id) url += `&equipment_id=${equipment_id}`;
        const res = await axios.get(url);
        setInspecciones(res.data.data ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [user.client_id, equipment_id]);

  const resultColor = (r: string) =>
    r === "PASS" ? "#10B981" : r === "FAIL" ? "#EF4444" : "#F59E0B";

  const resultLabel = (r: string) =>
    r === "PASS" ? "Aprobado" : r === "FAIL" ? "Rechazado" : "Condicional";

  const filtered = filter === "todos"
    ? inspecciones
    : inspecciones.filter(i => i.overall_result === filter);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Atrás</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {equipment_name ?? "Inspecciones"}
        </Text>
        <Text style={styles.count}>{filtered.length}</Text>
      </View>

      {/* Filtro resultado */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
        {(["todos", "PASS", "FAIL", "CONDITIONAL"] as const).map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.chip, filter === f && styles.chipActive]}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
              {f === "todos" ? "Todos" : resultLabel(f)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color="#3B82F6" size="large" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.length === 0 && (
            <Text style={{ color: "#6B7280", textAlign: "center", marginTop: 30, fontSize: 14 }}>
              Sin inspecciones registradas
            </Text>
          )}
          {filtered.map(ins => (
            <TouchableOpacity
              key={ins.id}
              style={styles.card}
              onPress={() => setExpanded(expanded === ins.id ? null : ins.id)}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardEquip}>{ins.equipment_name}</Text>
                  <Text style={styles.cardMeta}>
                    {ins.submitted_at.slice(0, 10)} · {ins.inspector_name}
                  </Text>
                  {ins.location && (
                    <Text style={styles.cardLocation}>📍 {ins.location}</Text>
                  )}
                </View>
                <View style={[styles.badge, { backgroundColor: resultColor(ins.overall_result) + "22" }]}>
                  <Text style={[styles.badgeText, { color: resultColor(ins.overall_result) }]}>
                    {resultLabel(ins.overall_result)}
                  </Text>
                </View>
              </View>

              {expanded === ins.id && (
                <View style={styles.detail}>
                  {ins.ai_summary ? (
                    <>
                      <Text style={styles.detailLabel}>Resumen IA</Text>
                      <Text style={styles.detailText}>{ins.ai_summary}</Text>
                    </>
                  ) : null}
                  {ins.notes ? (
                    <>
                      <Text style={[styles.detailLabel, { marginTop: 10 }]}>Notas del Inspector</Text>
                      <Text style={styles.detailText}>{ins.notes}</Text>
                    </>
                  ) : null}
                  {!ins.ai_summary && !ins.notes && (
                    <Text style={{ color: "#6B7280", fontSize: 13 }}>Sin notas adicionales</Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: "#0A1628" },
  topBar:         { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  back:           { marginRight: 12 },
  backText:       { color: "#3B82F6", fontSize: 14, fontWeight: "600" },
  title:          { flex: 1, color: "#fff", fontSize: 17, fontWeight: "800" },
  count:          { color: "#4A6A90", fontSize: 14, fontWeight: "700" },
  filterBar:      { paddingHorizontal: 12, paddingVertical: 10, flexGrow: 0 },
  chip:           { marginRight: 8, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.07)" },
  chipActive:     { backgroundColor: "#1E40AF" },
  chipText:       { color: "#7A9CBF", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  list:           { padding: 14, paddingBottom: 40 },
  card:           { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, marginBottom: 10, overflow: "hidden" },
  cardHeader:     { flexDirection: "row", alignItems: "flex-start", padding: 14 },
  cardEquip:      { color: "#fff", fontWeight: "700", fontSize: 15 },
  cardMeta:       { color: "#6B88A8", fontSize: 12, marginTop: 2 },
  cardLocation:   { color: "#4A6A90", fontSize: 11, marginTop: 2 },
  badge:          { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, marginLeft: 8 },
  badgeText:      { fontWeight: "800", fontSize: 11 },
  detail:         { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)", padding: 14 },
  detailLabel:    { color: "#9FC3E8", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  detailText:     { color: "#D1D5DB", fontSize: 13, lineHeight: 20 },
});
