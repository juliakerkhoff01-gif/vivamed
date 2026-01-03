// src/components/InvestigationPickerModal.tsx
import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { INVESTIGATIONS, INVESTIGATION_CATEGORIES, InvestigationCategory } from "../logic/investigations";

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (testId: string) => void;
};

export function InvestigationPickerModal({ visible, onClose, onPick }: Props) {
  const [category, setCategory] = useState<InvestigationCategory>("LAB");

  const filtered = useMemo(() => INVESTIGATIONS.filter((i) => i.category === category), [category]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}>
        <View
          style={{
            backgroundColor: "white",
            padding: 16,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            maxHeight: "75%",
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>Untersuchung anfordern</Text>
            <Pressable onPress={onClose}>
              <Text style={{ fontSize: 16 }}>Schließen</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {INVESTIGATION_CATEGORIES.map((c) => {
                const active = c.key === category;
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => setCategory(c.key)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? "#111" : "#ddd",
                      backgroundColor: active ? "#111" : "transparent",
                    }}
                  >
                    <Text style={{ color: active ? "white" : "#111", fontWeight: "600" }}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <ScrollView style={{ marginTop: 12 }}>
            <View style={{ gap: 10, paddingBottom: 18 }}>
              {filtered.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => onPick(t.id)}
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: "#eee",
                    backgroundColor: "#fafafa",
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "700" }}>{t.label}</Text>
                  <Text style={{ marginTop: 4, color: "#444" }}>{t.result.summary}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
