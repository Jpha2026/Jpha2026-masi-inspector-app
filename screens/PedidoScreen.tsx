import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, FlatList,
} from "react-native";
import { UpperInput } from "../components/UpperInput";
import { LinearGradient } from "expo-linear-gradient";
import axios from "axios";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList, PedidoItem } from "../types";
import { API_URL } from "../constants/api";
import { useTheme } from "../hooks/useTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Pedido">;
  route: RouteProp<RootStackParamList, "Pedido">;
};

const CATEGORIES = [
  { key: "limpieza",    label: "Limpieza",   icon: "🧹", items: ["Escoba", "Trapeador", "Jalador", "Cubeta", "Guantes", "Jabón multiusos", "Cloro", "Desengrasante", "Bolsas basura", "Papel higiénico", "Jabón de manos", "Toallas"] },
  { key: "alimentos",   label: "Alimentos",  icon: "🥗", subcats: [
    { key: "verdura", label: "Verdura",  icon: "🥦", items: ["Jitomate", "Cebolla", "Ajo", "Chiles", "Zanahoria", "Papa", "Brócoli", "Lechuga", "Espinaca", "Calabaza", "Chile serrano"] },
    { key: "fruta",   label: "Fruta",    icon: "🍎", items: ["Manzana", "Naranja", "Plátano", "Limón", "Sandía", "Melón", "Mango", "Papaya", "Uvas", "Fresas"] },
    { key: "carne",   label: "Carne",    icon: "🥩", items: ["Pollo entero", "Pechuga", "Carne molida", "Bistec", "Chuleta", "Milanesa", "Costilla", "Salchicha", "Jamón"] },
    { key: "abarrotes", label: "Abarrotes", icon: "🛒", items: ["Arroz", "Frijol", "Aceite", "Sal", "Azúcar", "Harina", "Pasta", "Atún", "Mayonesa", "Salsa", "Huevo"] },
  ]},
  { key: "utensilios",  label: "Utensilios", icon: "🍽️", items: ["Platos", "Vasos", "Cubiertos", "Ollas", "Sartén", "Tabla cortar", "Cuchillos", "Espátulas", "Colador"] },
  { key: "otro",        label: "Otro",       icon: "📦", items: [] },
];

type ItemDraft = PedidoItem & { tempId: string };

export default function PedidoScreen({ navigation, route }: Props) {
  const T    = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = route.params;

  const [step, setStep]             = useState<"category" | "items" | "review">("category");
  const [selCategory, setSelCategory] = useState<string>("");
  const [selSubcat, setSelSubcat]   = useState<string>("");
  const [items, setItems]           = useState<ItemDraft[]>([]);
  const [department, setDepartment] = useState("");
  const [notes, setNotes]           = useState("");
  const [customItem, setCustomItem] = useState("");
  const [loading, setLoading]       = useState(false);

  const bg       = T.isDark ? ["#050C1A", "#0D1B3E"] as const : ["#F0F4FA", "#E8EFF8"] as const;
  const cardBg   = T.isDark ? "#1A2740" : "#fff";
  const cardBdr  = T.isDark ? "#243556" : "#E2E8F5";
  const textColor = T.isDark ? "#E6EDF3" : "#1A2740";
  const lblColor  = T.isDark ? "#4A6A90" : "#6B84A8";
  const inputBg   = T.isDark ? "rgba(255,255,255,0.05)" : "#F0F4FB";
  const inputBdr  = T.isDark ? "rgba(255,255,255,0.09)" : "#D5DCF0";

  const cat = CATEGORIES.find(c => c.key === selCategory);
  const subcat = cat?.subcats?.find(s => s.key === selSubcat);
  const currentItems: string[] = subcat ? subcat.items : (cat?.items ?? []);

  const addItem = (item_name: string) => {
    const existing = items.find(i => i.item_name === item_name && i.category === (selSubcat || selCategory));
    if (existing) {
      setItems(prev => prev.map(i => i.tempId === existing.tempId ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setItems(prev => [...prev, {
        tempId: Math.random().toString(36).slice(2),
        category: selSubcat || selCategory,
        item_name,
        quantity: 1,
        unit: "pza",
      }]);
    }
  };

  const removeItem = (tempId: string) => setItems(prev => prev.filter(i => i.tempId !== tempId));
  const changeQty  = (tempId: string, qty: number) => {
    if (qty <= 0) { removeItem(tempId); return; }
    setItems(prev => prev.map(i => i.tempId === tempId ? { ...i, quantity: qty } : i));
  };

  const handleSubmit = async () => {
    if (items.length === 0) { Alert.alert("Sin artículos", "Agrega al menos un artículo al pedido."); return; }
    setLoading(true);
    try {
      const payload = { employee_id: user.employee_id, department, notes, items };
      const res = await axios.post(`${API_URL}/mobile/supply-requests`, payload);
      const { folio } = res.data as { folio: string };
      Alert.alert(
        "Pedido enviado ✅",
        `Tu pedido ${folio} fue enviado a tu supervisor. Te avisarán cuando sea autorizado.`,
        [{ text: "Aceptar", onPress: () => navigation.goBack() }]
      );
    } catch {
      Alert.alert("Error", "No se pudo enviar el pedido. Inténtalo de nuevo.");
    } finally { setLoading(false); }
  };

  return (
    <LinearGradient colors={bg} style={{ flex: 1 }}>
      {/* Navbar */}
      <LinearGradient colors={["#0D1B3E", "#122B60"]} style={[s.nav, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => step === "category" ? navigation.goBack() : setStep(step === "review" ? "items" : "category")} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.navTitle}>
          {step === "category" ? "Pedido de Insumos" : step === "items" ? (cat?.icon + " " + cat?.label) : "Revisar pedido"}
        </Text>
        {items.length > 0 && step !== "review" && (
          <TouchableOpacity onPress={() => setStep("review")} style={s.reviewBtn}>
            <Text style={{ color: "#60A5FA", fontSize: 12, fontWeight: "700" }}>Ver pedido ({items.length})</Text>
          </TouchableOpacity>
        )}
        {items.length === 0 && <View style={{ width: 80 }} />}
      </LinearGradient>

      {/* Step 1: Choose category */}
      {step === "category" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={[s.sectionLabel, { color: T.isDark ? "#60A5FA" : "#122B60" }]}>¿Qué necesitas?</Text>
          <View style={s.catGrid}>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c.key}
                style={[s.catCard, { backgroundColor: cardBg, borderColor: cardBdr }]}
                onPress={() => { setSelCategory(c.key); setSelSubcat(""); setStep("items"); }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 36 }}>{c.icon}</Text>
                <Text style={[s.catLabel, { color: textColor }]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Step 2: Pick items */}
      {step === "items" && cat && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

          {/* Subcategory tabs if applicable */}
          {cat.subcats && (
            <>
              <Text style={[s.sectionLabel, { color: T.isDark ? "#60A5FA" : "#122B60" }]}>Subcategoría</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {cat.subcats.map(sc => (
                    <TouchableOpacity
                      key={sc.key}
                      style={[s.tabChip, { backgroundColor: selSubcat === sc.key ? "#1D4ED8" : cardBg, borderColor: selSubcat === sc.key ? "#3B82F6" : cardBdr }]}
                      onPress={() => setSelSubcat(sc.key)}
                    >
                      <Text style={{ fontSize: 16 }}>{sc.icon}</Text>
                      <Text style={[s.tabLabel, { color: selSubcat === sc.key ? "#fff" : textColor }]}>{sc.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </>
          )}

          <Text style={[s.sectionLabel, { color: T.isDark ? "#60A5FA" : "#122B60" }]}>Artículos disponibles</Text>

          {currentItems.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {currentItems.map(item => {
                const existing = items.find(i => i.item_name === item && i.category === (selSubcat || selCategory));
                return (
                  <TouchableOpacity
                    key={item}
                    style={[s.itemChip, {
                      backgroundColor: existing ? "#1D4ED822" : cardBg,
                      borderColor: existing ? "#3B82F6" : cardBdr,
                    }]}
                    onPress={() => addItem(item)}
                    activeOpacity={0.75}
                  >
                    <Text style={[{ fontSize: 13, color: existing ? "#60A5FA" : textColor, fontWeight: existing ? "700" : "500" }]}>
                      {item} {existing ? `(${existing.quantity})` : ""}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Text style={[{ color: lblColor, fontSize: 13, marginBottom: 12 }]}>Selecciona una subcategoría para ver artículos.</Text>
          )}

          {/* Custom item */}
          <Text style={[s.sectionLabel, { color: T.isDark ? "#60A5FA" : "#122B60" }]}>Otro artículo (escribe)</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <UpperInput
              style={[s.input, { flex: 1, backgroundColor: inputBg, borderColor: inputBdr, color: textColor }]}
              value={customItem}
              onChangeText={setCustomItem}
              placeholder="Escribe el nombre del artículo..."
              placeholderTextColor={lblColor}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (customItem.trim()) { addItem(customItem.trim()); setCustomItem(""); }
              }}
            />
            <TouchableOpacity
              style={[s.addBtn, { backgroundColor: "#1D4ED8" }]}
              onPress={() => { if (customItem.trim()) { addItem(customItem.trim()); setCustomItem(""); } }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 20 }}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Selected items summary */}
          {items.length > 0 && (
            <>
              <Text style={[s.sectionLabel, { color: T.isDark ? "#60A5FA" : "#122B60", marginTop: 20 }]}>
                Tu pedido ({items.length} artículo{items.length !== 1 ? "s" : ""})
              </Text>
              {items.map(i => (
                <View key={i.tempId} style={[s.selectedItem, { backgroundColor: cardBg, borderColor: cardBdr }]}>
                  <Text style={[{ flex: 1, color: textColor, fontSize: 14 }]}>{i.item_name}</Text>
                  <TouchableOpacity onPress={() => changeQty(i.tempId, i.quantity - 1)} style={s.qtyBtn}>
                    <Text style={{ color: "#EF4444", fontWeight: "900", fontSize: 18 }}>−</Text>
                  </TouchableOpacity>
                  <Text style={[{ width: 28, textAlign: "center", color: textColor, fontWeight: "700" }]}>{i.quantity}</Text>
                  <TouchableOpacity onPress={() => changeQty(i.tempId, i.quantity + 1)} style={s.qtyBtn}>
                    <Text style={{ color: "#10B981", fontWeight: "900", fontSize: 18 }}>+</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <LinearGradient colors={["#5B21B6", "#8B5CF6"]} style={[s.submitBtn, { marginTop: 20 }]}>
                <TouchableOpacity style={s.submitInner} onPress={() => setStep("review")} activeOpacity={0.85}>
                  <Text style={s.submitText}>Continuar al resumen →</Text>
                </TouchableOpacity>
              </LinearGradient>
            </>
          )}
        </ScrollView>
      )}

      {/* Step 3: Review and send */}
      {step === "review" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={[s.sectionLabel, { color: T.isDark ? "#60A5FA" : "#122B60" }]}>Resumen del pedido</Text>

          {items.map(i => (
            <View key={i.tempId} style={[s.selectedItem, { backgroundColor: cardBg, borderColor: cardBdr }]}>
              <Text style={[{ flex: 1, color: textColor, fontSize: 14 }]}>{i.item_name}</Text>
              <Text style={[{ color: lblColor, fontSize: 12 }]}>{i.category}</Text>
              <TouchableOpacity onPress={() => changeQty(i.tempId, i.quantity - 1)} style={s.qtyBtn}>
                <Text style={{ color: "#EF4444", fontWeight: "900", fontSize: 18 }}>−</Text>
              </TouchableOpacity>
              <Text style={[{ width: 28, textAlign: "center", color: textColor, fontWeight: "700" }]}>{i.quantity}</Text>
              <TouchableOpacity onPress={() => changeQty(i.tempId, i.quantity + 1)} style={s.qtyBtn}>
                <Text style={{ color: "#10B981", fontWeight: "900", fontSize: 18 }}>+</Text>
              </TouchableOpacity>
            </View>
          ))}

          <Text style={[s.fieldLabel, { color: lblColor, marginTop: 20 }]}>Área / Departamento</Text>
          <UpperInput
            style={[s.input, { backgroundColor: inputBg, borderColor: inputBdr, color: textColor }]}
            value={department}
            onChangeText={setDepartment}
            placeholder="Ej. Cocina, Limpieza, Operaciones..."
            placeholderTextColor={lblColor}
          />

          <Text style={[s.fieldLabel, { color: lblColor }]}>Notas adicionales (opcional)</Text>
          <UpperInput
            style={[s.input, s.textArea, { backgroundColor: inputBg, borderColor: inputBdr, color: textColor }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Urgente, marca específica, instrucciones especiales..."
            placeholderTextColor={lblColor}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <View style={{ height: 16 }} />

          <LinearGradient colors={["#5B21B6", "#8B5CF6"]} style={s.submitBtn}>
            <TouchableOpacity style={s.submitInner} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitText}>Enviar pedido al supervisor 📦</Text>
              }
            </TouchableOpacity>
          </LinearGradient>
        </ScrollView>
      )}
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  nav:          { paddingBottom: 16, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn:      { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backArrow:    { color: "#fff", fontSize: 22, fontWeight: "700" },
  navTitle:     { color: "#fff", fontSize: 17, fontWeight: "800", flex: 1, textAlign: "center" },
  reviewBtn:    { paddingHorizontal: 8 },
  sectionLabel: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 },
  catGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  catCard:      { width: "46%", flexGrow: 1, borderRadius: 16, padding: 20, alignItems: "center", borderWidth: 1, gap: 8 },
  catLabel:     { fontSize: 15, fontWeight: "700", textAlign: "center" },
  tabChip:      { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  tabLabel:     { fontSize: 13, fontWeight: "600" },
  itemChip:     { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
  input:        { borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  textArea:     { height: 80, paddingTop: 10 },
  addBtn:       { borderRadius: 12, width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  selectedItem: { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, gap: 8 },
  qtyBtn:       { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  fieldLabel:   { fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 14 },
  submitBtn:    { borderRadius: 16, overflow: "hidden", elevation: 5, shadowColor: "#5B21B6", shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  submitInner:  { paddingVertical: 18, alignItems: "center" },
  submitText:   { color: "#fff", fontSize: 16, fontWeight: "800" },
});
