import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import axios from "axios";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../types";
import { API_URL } from "../constants/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "NuevoLead">;
  route: RouteProp<RootStackParamList, "NuevoLead">;
};

const SOURCES = ["campo","referido","instagram","facebook","web","directo","feria","whatsapp"];

export default function NuevoLeadScreen({ navigation, route }: Props) {
  const { user } = route.params;
  const insets = useSafeAreaInsets();

  const [name, setName]         = useState("");
  const [company, setCompany]   = useState("");
  const [phone, setPhone]       = useState("");
  const [email, setEmail]       = useState("");
  const [service, setService]   = useState("");
  const [notes, setNotes]       = useState("");
  const [source, setSource]     = useState("campo");
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [savedFolio, setSavedFolio] = useState("");

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Campo requerido", "Ingresa el nombre del prospecto.");
      return;
    }
    setSaving(true);
    try {
      const res = await axios.post(`${API_URL}/mobile/leads`, {
        name: name.trim(),
        company: company.trim(),
        phone: phone.trim(),
        email: email.trim(),
        service: service.trim(),
        notes: notes.trim(),
        source,
        assigned_to: user.name,
      });
      setSavedFolio(res.data.folio || "");
      setSaved(true);
    } catch {
      Alert.alert("Error", "No se pudo guardar el lead. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const handleNew = () => {
    setName(""); setCompany(""); setPhone(""); setEmail("");
    setService(""); setNotes(""); setSource("campo");
    setSaved(false); setSavedFolio("");
  };

  return (
    <LinearGradient colors={["#07101f", "#0D1B3E", "#122B60"]} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backTxt}>← Regresar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>📣 Nuevo Lead</Text>
          <Text style={styles.sub}>Captura un prospecto desde campo</Text>
        </View>

        {saved ? (
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>{savedFolio} guardado</Text>
            <Text style={styles.successSub}>El lead fue registrado en el sistema.</Text>
            <TouchableOpacity style={styles.btnPrimary} onPress={handleNew}>
              <Text style={styles.btnPrimaryTxt}>+ Capturar otro lead</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSec} onPress={() => navigation.goBack()}>
              <Text style={styles.btnSecTxt}>Regresar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
            <Text style={styles.lbl}>Nombre del contacto *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nombre completo" placeholderTextColor="#4A6A90" />

            <Text style={styles.lbl}>Empresa / Negocio</Text>
            <TextInput style={styles.input} value={company} onChangeText={setCompany} placeholder="Razón social o nombre comercial" placeholderTextColor="#4A6A90" />

            <Text style={styles.lbl}>Teléfono</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="81 XXXX XXXX" placeholderTextColor="#4A6A90" keyboardType="phone-pad" />

            <Text style={styles.lbl}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="contacto@empresa.com" placeholderTextColor="#4A6A90" keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.lbl}>Servicio de interés</Text>
            <TextInput style={styles.input} value={service} onChangeText={setService} placeholder="Ej. Mantenimiento extintores, inspección NOM" placeholderTextColor="#4A6A90" />

            <Text style={styles.lbl}>Origen</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {SOURCES.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sourceChip, source === s && styles.sourceChipSel]}
                  onPress={() => setSource(s)}
                >
                  <Text style={[styles.sourceChipTxt, source === s && styles.sourceChipTxtSel]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.lbl}>Notas / Contexto</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Necesidades, fecha de seguimiento, observaciones..."
              placeholderTextColor="#4A6A90"
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity style={styles.btnPrimary} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryTxt}>Guardar lead</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSec} onPress={() => navigation.goBack()}>
              <Text style={styles.btnSecTxt}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  backBtn: { marginBottom: 12 },
  backTxt: { color: "#60A5FA", fontSize: 14 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 2 },
  sub: { color: "#4A6A90", fontSize: 13 },
  form: { padding: 20, paddingBottom: 40 },
  lbl: { color: "#4A6A90", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: 10, padding: 12, color: "#fff", fontSize: 14 },
  textarea: { height: 90, textAlignVertical: "top" },
  sourceChip: { marginRight: 8, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.04)" },
  sourceChipSel: { borderColor: "#CE0D0D", backgroundColor: "rgba(206,13,13,0.15)" },
  sourceChipTxt: { color: "#4A6A90", fontSize: 13, fontWeight: "700" },
  sourceChipTxtSel: { color: "#CE0D0D" },
  btnPrimary: { backgroundColor: "#CE0D0D", borderRadius: 12, padding: 15, alignItems: "center", marginTop: 20 },
  btnPrimaryTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
  btnSec: { borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: 12, padding: 14, alignItems: "center", marginTop: 10 },
  btnSecTxt: { color: "#4A6A90", fontWeight: "700", fontSize: 14 },
  successCard: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  successIcon: { fontSize: 64, marginBottom: 16 },
  successTitle: { color: "#10B981", fontSize: 22, fontWeight: "800", marginBottom: 8 },
  successSub: { color: "#4A6A90", fontSize: 14, textAlign: "center", marginBottom: 32 },
});
