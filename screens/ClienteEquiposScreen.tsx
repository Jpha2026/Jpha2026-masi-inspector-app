import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, TextInput,
} from "react-native";
import { UpperInput } from "../components/UpperInput";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList, AppUser } from "../types";
import { API_URL } from "../constants/api";
import axios from "axios";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "ClienteEquipos">;
  route: { params: { user: AppUser; sucursal_id?: string } };
};

type Equipo = {
  id: string;
  name: string;
  type: string;
  location: string;
  serial_number: string;
  qr_code: string;
  expiry_date: string | null;
  capacity: string;
  agent_type: string;
  status: string;
  install_date: string | null;
  inspection_count: number;
  last_inspection: string | null;
};

type Sucursal = { id: string; name: string; address: string };

export default function ClienteEquiposScreen({ navigation, route }: Props) {
  const { user } = route.params;
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [selectedSucursal, setSelectedSucursal] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    load(selectedSucursal);
  }, [selectedSucursal]);

  async function load(suc: string) {
    if (!user.client_id) { setLoading(false); return; }
    setLoading(true);
    try {
      const url = `${API_URL}/mobile/cliente/equipos?client_id=${user.client_id}${suc ? `&sucursal_id=${suc}` : ""}`;
      const res = await axios.get(url);
      setEquipos(res.data.data ?? []);
      if (sucursales.length === 0) setSucursales(res.data.sucursales ?? []);
    } catch {
      setEquipos([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = equipos.filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.location.toLowerCase().includes(search.toLowerCase()) ||
    e.serial_number.toLowerCase().includes(search.toLowerCase())
  );

  const expiryColor = (date: string | null) => {
    if (!date) return "#6B7280";
    const d = new Date(date);
    const diff = (d.getTime() - Date.now()) / (1000 * 3600 * 24);
    if (diff < 0) return "#EF4444";
    if (diff < 30) return "#F59E0B";
    return "#10B981";
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Inicio</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mis Equipos</Text>
        <Text style={styles.count}>{filtered.length}</Text>
      </View>

      <View style={styles.filters}>
        <UpperInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nombre, ubicación..."
          placeholderTextColor="#4A6A90"
          style={styles.searchInput}
        />
        {sucursales.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            <TouchableOpacity
              onPress={() => setSelectedSucursal("")}
              style={[styles.chip, !selectedSucursal && styles.chipActive]}
            >
              <Text style={[styles.chipText, !selectedSucursal && styles.chipTextActive]}>Todas</Text>
            </TouchableOpacity>
            {sucursales.map(s => (
              <TouchableOpacity
                key={s.id}
                onPress={() => setSelectedSucursal(s.id)}
                style={[styles.chip, selectedSucursal === s.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, selectedSucursal === s.id && styles.chipTextActive]}>{s.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color="#3B82F6" size="large" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.length === 0 && (
            <Text style={{ color: "#6B7280", textAlign: "center", marginTop: 30 }}>Sin equipos</Text>
          )}
          {filtered.map(eq => (
            <TouchableOpacity
              key={eq.id}
              style={styles.card}
              onPress={() => setExpanded(expanded === eq.id ? null : eq.id)}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{eq.name}</Text>
                  <Text style={styles.cardSub}>{eq.type} · {eq.location}</Text>
                </View>
                <View style={styles.inspBadge}>
                  <Text style={styles.inspBadgeText}>{eq.inspection_count} insp.</Text>
                </View>
              </View>
              {expanded === eq.id && (
                <View style={styles.detail}>
                  <Row label="Serie" value={eq.serial_number || "—"} />
                  <Row label="Capacidad" value={eq.capacity || "—"} />
                  <Row label="Agente" value={eq.agent_type || "—"} />
                  <Row label="Instalación" value={eq.install_date?.slice(0, 10) ?? "—"} />
                  <Row
                    label="Vencimiento"
                    value={eq.expiry_date?.slice(0, 10) ?? "—"}
                    valueColor={expiryColor(eq.expiry_date)}
                  />
                  <Row label="Última insp." value={eq.last_inspection?.slice(0, 10) ?? "Sin inspecciones"} />
                  <TouchableOpacity
                    style={styles.detailBtn}
                    onPress={() =>
                      navigation.navigate("ClienteInspecciones", {
                        user,
                        equipment_id: eq.id,
                        equipment_name: eq.name,
                      })
                    }
                  >
                    <Text style={styles.detailBtnText}>Ver Inspecciones →</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
      <Text style={{ color: "#9CA3AF", fontSize: 12 }}>{label}</Text>
      <Text style={{ color: valueColor ?? "#fff", fontSize: 12, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: "#0A1628" },
  topBar:         { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  back:           { marginRight: 12 },
  backText:       { color: "#3B82F6", fontSize: 14, fontWeight: "600" },
  title:          { flex: 1, color: "#fff", fontSize: 18, fontWeight: "800" },
  count:          { color: "#4A6A90", fontSize: 14, fontWeight: "700" },
  filters:        { padding: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  searchInput:    { backgroundColor: "rgba(255,255,255,0.07)", color: "#fff", borderRadius: 10, padding: 10, fontSize: 14 },
  chip:           { marginRight: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.07)" },
  chipActive:     { backgroundColor: "#1E40AF" },
  chipText:       { color: "#7A9CBF", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  list:           { padding: 14, paddingBottom: 40 },
  card:           { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, marginBottom: 10, overflow: "hidden" },
  cardHeader:     { flexDirection: "row", alignItems: "center", padding: 14 },
  cardName:       { color: "#fff", fontWeight: "700", fontSize: 15 },
  cardSub:        { color: "#6B88A8", fontSize: 12, marginTop: 2 },
  inspBadge:      { backgroundColor: "rgba(59,130,246,0.2)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  inspBadgeText:  { color: "#60A5FA", fontSize: 11, fontWeight: "700" },
  detail:         { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)", padding: 14 },
  detailBtn:      { marginTop: 10, backgroundColor: "#1E40AF", borderRadius: 8, padding: 10, alignItems: "center" },
  detailBtnText:  { color: "#fff", fontWeight: "700", fontSize: 13 },
});
