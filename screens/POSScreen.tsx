import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, Alert, ActivityIndicator, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import axios from "axios";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../types";
import { API_URL } from "../constants/api";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "POS">;
  route: RouteProp<RootStackParamList, "POS">;
};

type Product = { id: string; name: string; code: string; sale_price: number; stock: number; unit: string };
type TicketItem = { product_id: string; description: string; qty: number; unit_price: number; subtotal: number };
const METHODS = ["efectivo", "tarjeta", "transferencia", "credito"];
const MC: Record<string, string> = { efectivo: "#10B981", tarjeta: "#3B82F6", transferencia: "#8B5CF6", credito: "#F59E0B" };

export default function POSScreen({ navigation, route }: Props) {
  const { user } = route.params;
  const [products, setProducts]     = useState<Product[]>([]);
  const [filtered, setFiltered]     = useState<Product[]>([]);
  const [search, setSearch]         = useState("");
  const [items, setItems]           = useState<TicketItem[]>([]);
  const [method, setMethod]         = useState("efectivo");
  const [clientName, setClientName] = useState("");
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [folio, setFolio]           = useState("");

  useEffect(() => {
    axios.get<Product[]>(`${API_URL}/mobile/pos`).then(r => {
      setProducts(r.data);
      setFiltered(r.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSearch = (q: string) => {
    setSearch(q);
    if (!q) { setFiltered(products); return; }
    const lq = q.toLowerCase();
    setFiltered(products.filter(p => p.name.toLowerCase().includes(lq) || p.code?.toLowerCase().includes(lq)));
  };

  const addProduct = (p: Product) => {
    setItems(prev => {
      const ex = prev.find(i => i.product_id === p.id);
      if (ex) return prev.map(i => i.product_id === p.id ? { ...i, qty: i.qty + 1, subtotal: (i.qty + 1) * i.unit_price } : i);
      return [...prev, { product_id: p.id, description: p.name, qty: 1, unit_price: p.sale_price, subtotal: p.sale_price }];
    });
  };

  const changeQty = (productId: string, delta: number) => {
    setItems(prev => prev
      .map(i => i.product_id === productId ? { ...i, qty: Math.max(1, i.qty + delta), subtotal: Math.max(1, i.qty + delta) * i.unit_price } : i)
      .filter(i => i.qty > 0)
    );
  };

  const removeItem = (productId: string) => setItems(prev => prev.filter(i => i.product_id !== productId));

  const subtotal = items.reduce((a, i) => a + i.subtotal, 0);
  const iva = subtotal * 0.16;
  const total = subtotal + iva;
  const fmt = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;

  const handleCobrar = async () => {
    if (!items.length) { Alert.alert("Ticket vacío", "Agrega productos al ticket."); return; }
    Alert.alert("Confirmar venta", `Total: ${fmt(total)}\nMétodo: ${method}\nCliente: ${clientName || "Mostrador"}`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "COBRAR", onPress: async () => {
          setSaving(true);
          try {
            const res = await axios.post(`${API_URL}/mobile/pos`, {
              client_name: clientName || "Mostrador",
              method,
              cashier: user.name,
              items,
            });
            setFolio(res.data.folio || "");
            setItems([]);
            setClientName("");
          } catch {
            Alert.alert("Error", "No se pudo procesar la venta.");
          } finally {
            setSaving(false);
          }
        }
      },
    ]);
  };

  if (folio) {
    return (
      <LinearGradient colors={["#07101f", "#0D1B3E"]} style={styles.container}>
        <View style={styles.successCard}>
          <Text style={{ fontSize: 64 }}>✓</Text>
          <Text style={styles.successTitle}>{folio}</Text>
          <Text style={styles.successSub}>Venta procesada — stock y finanzas actualizados</Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => setFolio("")}>
            <Text style={styles.btnTxt}>Nueva venta</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSec} onPress={() => navigation.goBack()}>
            <Text style={styles.btnSecTxt}>Salir</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#07101f", "#0D1B3E"]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backTxt}>← Salir</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🏪 Punto de Venta</Text>
      </View>

      <View style={styles.layout}>
        {/* LEFT — products */}
        <View style={styles.leftPane}>
          <TextInput
            style={styles.searchBar}
            value={search}
            onChangeText={handleSearch}
            placeholder="Buscar producto..."
            placeholderTextColor="#4A6A90"
          />
          {loading ? (
            <ActivityIndicator color="#CE0D0D" style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={p => p.id}
              numColumns={2}
              columnWrapperStyle={{ gap: 8 }}
              contentContainerStyle={{ gap: 8, paddingBottom: 20 }}
              renderItem={({ item: p }) => (
                <TouchableOpacity style={styles.prodCard} onPress={() => addProduct(p)}>
                  <Text style={styles.prodName} numberOfLines={2}>{p.name}</Text>
                  <Text style={styles.prodPrice}>{fmt(p.sale_price)}</Text>
                  <Text style={styles.prodStock}>{p.stock > 0 ? `${p.stock} ${p.unit || "pza"}` : "Sin stock"}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={{ color: "#4A6A90", textAlign: "center", marginTop: 20 }}>Sin productos</Text>}
            />
          )}
        </View>

        {/* RIGHT — ticket */}
        <View style={styles.rightPane}>
          <Text style={styles.ticketTitle}>🧾 Ticket</Text>

          <TextInput
            style={styles.clientInput}
            value={clientName}
            onChangeText={setClientName}
            placeholder="Cliente (Mostrador)"
            placeholderTextColor="#4A6A90"
          />

          <ScrollView style={{ flex: 1, marginVertical: 8 }} showsVerticalScrollIndicator={false}>
            {items.length === 0 && <Text style={styles.emptyTxt}>Toca un producto para agregar</Text>}
            {items.map(it => (
              <View key={it.product_id} style={styles.ticketItem}>
                <Text style={styles.itemName} numberOfLines={1}>{it.description}</Text>
                <View style={styles.qtyRow}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQty(it.product_id, -1)}>
                    <Text style={styles.qtyBtnTxt}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyVal}>{it.qty}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQty(it.product_id, 1)}>
                    <Text style={styles.qtyBtnTxt}>+</Text>
                  </TouchableOpacity>
                  <Text style={styles.itemSub}>{fmt(it.subtotal)}</Text>
                  <TouchableOpacity onPress={() => removeItem(it.product_id)}>
                    <Text style={{ color: "#EF4444", fontWeight: "700", fontSize: 16, paddingHorizontal: 6 }}>×</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Totals */}
          <View style={styles.totals}>
            <View style={styles.totalRow}><Text style={styles.totalLbl}>Subtotal</Text><Text style={styles.totalVal}>{fmt(subtotal)}</Text></View>
            <View style={styles.totalRow}><Text style={styles.totalLbl}>IVA 16%</Text><Text style={styles.totalVal}>{fmt(iva)}</Text></View>
            <View style={[styles.totalRow, { marginTop: 4 }]}>
              <Text style={[styles.totalLbl, { fontSize: 16, fontWeight: "800", color: "#fff" }]}>TOTAL</Text>
              <Text style={[styles.totalVal, { fontSize: 18, fontWeight: "900", color: "#10B981" }]}>{fmt(total)}</Text>
            </View>
          </View>

          {/* Method */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {METHODS.map(m => (
              <TouchableOpacity key={m} style={[styles.methodBtn, method === m && { borderColor: MC[m], backgroundColor: MC[m] + "18" }]} onPress={() => setMethod(m)}>
                <Text style={[styles.methodTxt, method === m && { color: MC[m] }]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.cobrarBtn} onPress={handleCobrar} disabled={saving || !items.length}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.cobrarTxt}>COBRAR</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 52, paddingHorizontal: 16, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  backBtn: {},
  backTxt: { color: "#60A5FA", fontSize: 13 },
  title: { color: "#fff", fontSize: 18, fontWeight: "800" },
  layout: { flex: 1, flexDirection: "row", gap: 0 },
  leftPane: { flex: 1, padding: 10, borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.06)" },
  rightPane: { width: 200, padding: 10, backgroundColor: "rgba(0,0,0,0.2)" },
  searchBar: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 9, color: "#fff", fontSize: 13, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginBottom: 8 },
  prodCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 9, padding: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", minHeight: 80 },
  prodName: { color: "#fff", fontSize: 12, fontWeight: "700", marginBottom: 4, lineHeight: 16 },
  prodPrice: { color: "#10B981", fontSize: 14, fontWeight: "800", marginBottom: 2 },
  prodStock: { color: "#4A6A90", fontSize: 10 },
  ticketTitle: { color: "#fff", fontWeight: "800", fontSize: 14, marginBottom: 8 },
  clientInput: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 7, padding: 8, color: "#fff", fontSize: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginBottom: 4 },
  emptyTxt: { color: "#4A6A90", fontSize: 12, textAlign: "center", marginTop: 12 },
  ticketItem: { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", paddingVertical: 6 },
  itemName: { color: "#C4D8EE", fontSize: 11, marginBottom: 4, fontWeight: "600" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  qtyBtn: { width: 22, height: 22, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 5, alignItems: "center", justifyContent: "center" },
  qtyBtnTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
  qtyVal: { color: "#fff", fontWeight: "700", fontSize: 13, minWidth: 20, textAlign: "center" },
  itemSub: { color: "#10B981", fontWeight: "700", fontSize: 12, marginLeft: 4, flex: 1, textAlign: "right" },
  totals: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)", paddingTop: 8, marginBottom: 8 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  totalLbl: { color: "#4A6A90", fontSize: 12 },
  totalVal: { color: "#C4D8EE", fontSize: 12, fontWeight: "700" },
  methodBtn: { marginRight: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  methodTxt: { color: "#4A6A90", fontSize: 11, fontWeight: "700" },
  cobrarBtn: { backgroundColor: "#CE0D0D", borderRadius: 10, padding: 13, alignItems: "center", opacity: 1 },
  cobrarTxt: { color: "#fff", fontWeight: "900", fontSize: 15, letterSpacing: 1 },
  successCard: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  successTitle: { color: "#10B981", fontSize: 22, fontWeight: "800", marginBottom: 8, marginTop: 12 },
  successSub: { color: "#4A6A90", fontSize: 13, textAlign: "center", marginBottom: 32 },
  btnPrimary: { backgroundColor: "#CE0D0D", borderRadius: 12, padding: 15, width: "100%", alignItems: "center", marginBottom: 10 },
  btnTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
  btnSec: { borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: 12, padding: 13, width: "100%", alignItems: "center" },
  btnSecTxt: { color: "#4A6A90", fontWeight: "700" },
});
