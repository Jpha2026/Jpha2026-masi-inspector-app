import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS_SEMANA = ["D","L","M","M","J","V","S"];

function fmt(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function display(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  textColor?: string;
  borderColor?: string;
  bgColor?: string;
  placeholder?: string;
};

export default function DatePickerField({
  label, value, onChange,
  minimumDate, maximumDate,
  textColor = "#1A2740",
  borderColor = "#D0D9EB",
  bgColor = "#fff",
  placeholder = "Seleccionar fecha",
}: Props) {
  const today = new Date();
  const [show, setShow] = useState(false);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const open = () => {
    const d = value ? new Date(value + "T12:00:00") : today;
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setShow(true);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const isDisabled = (day: number) => {
    const d = new Date(viewYear, viewMonth, day, 12);
    if (minimumDate) {
      const min = new Date(minimumDate); min.setHours(0, 0, 0, 0);
      if (d < min) return true;
    }
    if (maximumDate) {
      const max = new Date(maximumDate); max.setHours(23, 59, 59, 999);
      if (d > max) return true;
    }
    return false;
  };

  const isSelected = (day: number) => value === fmt(viewYear, viewMonth, day);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: "#5A6E8C", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 7 }}>
        {label}
      </Text>
      <TouchableOpacity
        onPress={open}
        style={{ backgroundColor: bgColor, borderWidth: 1, borderColor: value ? "#122B60" : borderColor, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        activeOpacity={0.75}
      >
        <Text style={{ fontSize: 14, color: value ? textColor : "#8A9BBE" }}>
          {value ? display(value) : placeholder}
        </Text>
        <Text style={{ fontSize: 18 }}>📅</Text>
      </TouchableOpacity>

      <Modal visible={show} transparent animationType="fade" statusBarTranslucent>
        <View style={ss.overlay}>
          <View style={ss.picker}>
            <View style={ss.calHeader}>
              <TouchableOpacity onPress={prevMonth} style={ss.navBtn}>
                <Text style={ss.navArrow}>‹</Text>
              </TouchableOpacity>
              <Text style={ss.monthYear}>{MESES[viewMonth]} {viewYear}</Text>
              <TouchableOpacity onPress={nextMonth} style={ss.navBtn}>
                <Text style={ss.navArrow}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={ss.weekRow}>
              {DIAS_SEMANA.map((d, i) => (
                <Text key={i} style={ss.weekDay}>{d}</Text>
              ))}
            </View>

            <View style={ss.grid}>
              {cells.map((day, i) => {
                const disabled = !day || isDisabled(day);
                const selected = !!day && isSelected(day);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[ss.cell, selected && ss.cellSelected, disabled && ss.cellDisabled]}
                    onPress={() => { if (day && !isDisabled(day)) { onChange(fmt(viewYear, viewMonth, day)); setShow(false); } }}
                    disabled={disabled}
                    activeOpacity={0.7}
                  >
                    {day ? (
                      <Text style={[ss.cellText, selected && ss.cellTextSel, disabled && ss.cellTextDis]}>
                        {day}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity onPress={() => setShow(false)} style={ss.cancelBtn}>
              <Text style={ss.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const ss = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  picker:       { backgroundColor: "#fff", borderRadius: 20, padding: 20, width: 320, elevation: 24, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
  calHeader:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  navBtn:       { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#EEF2FB" },
  navArrow:     { fontSize: 22, color: "#122B60", fontWeight: "700", lineHeight: 24 },
  monthYear:    { fontSize: 16, fontWeight: "800", color: "#122B60" },
  weekRow:      { flexDirection: "row", marginBottom: 6 },
  weekDay:      { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: "#8A9BBE" },
  grid:         { flexDirection: "row", flexWrap: "wrap" },
  cell:         { width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 100 },
  cellSelected: { backgroundColor: "#122B60" },
  cellDisabled: { opacity: 0.35 },
  cellText:     { fontSize: 14, color: "#1A2740" },
  cellTextSel:  { color: "#fff", fontWeight: "800" },
  cellTextDis:  { color: "#B0BDCE" },
  cancelBtn:    { marginTop: 12, paddingTop: 12, alignItems: "center", borderTopWidth: 1, borderTopColor: "#EEF2FB" },
  cancelText:   { fontSize: 14, color: "#6B84A8", fontWeight: "600" },
});
