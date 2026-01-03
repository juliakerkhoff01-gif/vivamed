import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Keyboard } from "react-native";
import * as Speech from "expo-speech";

import { colors } from "../theme/colors";
import { ChatMessage, SessionConfig } from "../types";

import { Card } from "../components/Card";
import { VButton } from "../components/VButton";
import { Screen } from "../components/Screen";
import { ThemedScreen } from "../components/ThemedScreen";
import { ChatBubble } from "../components/ChatBubble";
import { ChatComposer } from "../components/ChatComposer";

import { InvestigationPickerModal } from "../components/InvestigationPickerModal";
import { orderTest, formatResultForChat } from "../logic/investigations";
import { examinerMessageAfterInvestigation } from "../logic/investigationFollowUp";
import { examinerFollowUpAfterUserAnswer } from "../logic/userAnswerHeuristics";

import { interruptMultiplier, profileLabel, getExaminerProfile } from "../logic/examinerProfiles";
import { pickCase, secondsPerTurn, CaseTemplate, phaseForTurn, getCaseById } from "../logic/cases";
import {
  initialExaminerMessage,
  nextExaminerMessage,
  nextExaminerMessageAfterUser,
  interruptExaminerMessage,
} from "../logic/examiner";

import { useSectionTheme } from "../theme/SectionThemeContext";
import { fetchExaminerTurn } from "../logic/aiExaminer";
import {
  getAiBaseUrl,
  pingServerHealth,
  canStartSimulation,
  markDemoSimulationUsed,
} from "../logic/appSettings";

function phaseLabel(p: string) {
  if (p === "intro") return "Einstieg";
  if (p === "ddx") return "DDx";
  if (p === "diagnostics") return "Diagnostik";
  if (p === "management") return "Management";
  return "Abschluss";
}

function mmss(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return `${m}:${ss}`;
}

function rgba(hex: string, alpha: number) {
  const h = (hex ?? "").replace("#", "");
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function Pill({ text }: { text: string }) {
  const { tokens } = useSectionTheme();
  return (
    <View style={[styles.pill, { borderColor: rgba(tokens.tint, 0.18), backgroundColor: rgba(tokens.tint, 0.1) }]}>
      <Text style={styles.pillText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function TogglePill({ text, active, onPress }: { text: string; active?: boolean; onPress: () => void }) {
  const { tokens } = useSectionTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          borderColor: active ? rgba(tokens.tint, 0.28) : rgba(tokens.tint, 0.18),
          backgroundColor: active ? rgba(tokens.tint, 0.14) : rgba(tokens.tint, 0.1),
        },
        pressed ? { opacity: 0.82 } : null,
      ]}
    >
      <Text style={[styles.pillText, active ? { color: colors.text } : null]} numberOfLines={1}>
        {text}
      </Text>
    </Pressable>
  );
}

function withoutSystem(arr: ChatMessage[]) {
  return arr.filter((m) => m.role !== "system");
}

function uiMessagesForServer(arr: ChatMessage[]) {
  return arr
    .filter((m) => m && (m.role === "user" || m.role === "examiner"))
    .map((m) => ({ role: m.role as "user" | "examiner", text: String(m.text ?? "") }));
}

function makeExaminerMsg(text: string): ChatMessage {
  return {
    id: Math.random().toString(16).slice(2),
    role: "examiner",
    text: String(text ?? "").trim(),
    ts: Date.now(),
  };
}

function isPlaceholderUrl(url: string) {
  const s = String(url ?? "").trim();
  if (!s) return true;
  if (s.includes("DEINE_MAC_IP")) return true;
  return false;
}

type AiMode = "checking" | "ai" | "local";

export function SimulationScreen({ route, navigation }: any) {
  const { tokens } = useSectionTheme();

  const cfg: SessionConfig | undefined = route?.params?.cfg;

  // ✅ PRO/Demo Gate (release-safe)
  const [gateReady, setGateReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const runGate = async () => {
      try {
        const gate = await canStartSimulation();
        if (!gate.ok) {
          if (!cancelled) {
            navigation.replace("Paywall", { reason: "Simulationen" });
          }
          return;
        }

        // ✅ wenn Demo: nur einmal marken (idempotent)
        await markDemoSimulationUsed();
      } finally {
        if (!cancelled) setGateReady(true);
      }
    };

    runGate();
    return () => {
      cancelled = true;
    };
  }, [navigation]);

  // optional: von außen übergeben (z.B. KI-generierter Fall)
  const passedGeneratedCase: CaseTemplate | null = (route?.params?.generatedCase as any) ?? null;

  const initialCaseRef = useRef<CaseTemplate | null>(null);
  if (initialCaseRef.current === null && cfg) {
    initialCaseRef.current =
      passedGeneratedCase ??
      ((cfg.caseId ? getCaseById(cfg.caseId) : null) as any) ??
      pickCase(cfg);
  }
  const [theCase] = useState<CaseTemplate | null>(initialCaseRef.current);

  const baseSeconds = useMemo(() => (cfg ? secondsPerTurn(cfg.difficulty) : 60), [cfg]);
  const [secondsLeft, setSecondsLeft] = useState(baseSeconds);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (!cfg || !initialCaseRef.current) return [];
    return [initialExaminerMessage(cfg, initialCaseRef.current)];
  });

  const [draft, setDraft] = useState("");
  const [interruptedThisTurn, setInterruptedThisTurn] = useState(false);

  const [speakerOn, setSpeakerOn] = useState(true);
  const lastSpokenId = useRef<string | null>(null);

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [investigationOpen, setInvestigationOpen] = useState(false);

  // ✅ AI-Mode ausschließlich aus AppSettings
  const [aiMode, setAiMode] = useState<AiMode>("checking");
  const [aiBaseUrl, setAiBaseUrl] = useState<string>("");

  const mainUserTurns = useMemo(
    () => messages.filter((m: any) => m.role === "user" && !m.meta?.followUp).length,
    [messages]
  );

  const activeFocus = useMemo(() => {
    const lastExaminer: any = [...messages].reverse().find((m) => m.role === "examiner");
    return lastExaminer?.meta?.focus ?? null;
  }, [messages]);

  const phase = useMemo(() => {
    if (activeFocus?.phase) return activeFocus.phase;
    return phaseForTurn(mainUserTurns);
  }, [activeFocus, mainUserTurns]);

  // ✅ Initial: Settings lesen + Health check
  useEffect(() => {
    let cancelled = false;

    const initAiMode = async () => {
      try {
        const url = await getAiBaseUrl();
        if (cancelled) return;

        setAiBaseUrl(url);

        if (isPlaceholderUrl(url)) {
          setAiMode("local");
          return;
        }

        setAiMode("checking");
        const ok = await pingServerHealth(url);

        if (cancelled) return;
        setAiMode(ok ? "ai" : "local");
      } catch {
        if (!cancelled) setAiMode("local");
      }
    };

    initAiMode();
    return () => {
      cancelled = true;
    };
  }, []);

  const useAiExaminer = aiMode === "ai";

  // Timer tick
  useEffect(() => {
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setSecondsLeft(baseSeconds);
  }, [baseSeconds]);

  const interruptAt = useMemo(() => {
    if (!cfg) return 999999;
    try {
      return Math.max(10, Math.floor(baseSeconds * interruptMultiplier(cfg)));
    } catch {
      return 999999;
    }
  }, [baseSeconds, cfg]);

  // Auto-advance bei 0
  useEffect(() => {
    if (!cfg || !theCase) return;
    if (secondsLeft !== 0) return;

    setSecondsLeft(baseSeconds);
    setInterruptedThisTurn(false);

    const snapshotNoSys = withoutSystem(messages);

    if (useAiExaminer) {
      setTimeout(async () => {
        try {
          const aiText = await fetchExaminerTurn({
            cfg,
            generatedCase: theCase,
            messages: uiMessagesForServer(snapshotNoSys),
          } as any);
          setMessages((p) => [...p, makeExaminerMsg(aiText)]);
        } catch {
          setAiMode("local");
          setMessages((p) => {
            const pNoSys = withoutSystem(p);
            return [...p, nextExaminerMessage(cfg, pNoSys, theCase)];
          });
        }
      }, 30);
      return;
    }

    setMessages((prev) => {
      const prevNoSys = withoutSystem(prev);
      return [...prev, nextExaminerMessage(cfg, prevNoSys, theCase)];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  // Interrupt
  useEffect(() => {
    if (!cfg || !theCase) return;
    if (cfg.difficulty < 70) return;
    if (interruptedThisTurn) return;
    if (secondsLeft !== interruptAt) return;

    const last = messages[messages.length - 1];
    if (!last || last.role !== "examiner") return;

    const typing = draft.trim().length > 0;
    const veryLateAndSilent = draft.trim().length === 0 && secondsLeft <= 12;
    if (!typing && !veryLateAndSilent) return;

    setInterruptedThisTurn(true);
    setMessages((prev) => {
      const prevNoSys = withoutSystem(prev);
      return [...prev, interruptExaminerMessage(cfg, prevNoSys, theCase)];
    });
  }, [secondsLeft, interruptAt, cfg, theCase, interruptedThisTurn, draft, messages]);

  // Auto-scroll
  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages.length]);

  // Voice
  useEffect(() => {
    if (!cfg) return;
    if (cfg.mode !== "voice") return;
    if (!speakerOn) return;

    const last = messages[messages.length - 1];
    if (!last || last.role !== "examiner") return;
    if (lastSpokenId.current === last.id) return;

    lastSpokenId.current = last.id;
    try {
      Speech.stop();
      Speech.speak(last.text, { language: "de-DE", rate: 0.95 });
    } catch {}
  }, [messages, cfg, speakerOn]);

  useEffect(() => {
    return () => {
      try {
        Speech.stop();
      } catch {}
    };
  }, []);

  const send = (text: string) => {
    if (!cfg || !theCase) return;

    const trimmedLocal = text.trim();
    if (!trimmedLocal) return;

    const lastExaminer: any = [...messages].reverse().find((m) => m.role === "examiner");
    const isFollowUp = Boolean(lastExaminer?.meta?.focus);

    const userMsg: ChatMessage = {
      id: Math.random().toString(16).slice(2),
      role: "user",
      text: trimmedLocal,
      ts: Date.now(),
      meta: isFollowUp ? { followUp: true } : undefined,
    };

    setDraft("");
    setSecondsLeft(baseSeconds);

    setMessages((prev) => {
      const next = [...prev, userMsg];

      setTimeout(async () => {
        setInterruptedThisTurn(false);

        const nextNoSys = withoutSystem(next);
        const lastExaminer2: any = [...nextNoSys].reverse().find((m) => m.role === "examiner");
        const focus = lastExaminer2?.meta?.focus;

        if (focus) {
          setMessages((p2) => {
            const p2NoSys = withoutSystem(p2);
            return [...p2, examinerFollowUpAfterUserAnswer(cfg, p2NoSys, theCase, trimmedLocal, focus)];
          });
          return;
        }

        if (useAiExaminer) {
          try {
            const aiText = await fetchExaminerTurn({
              cfg,
              generatedCase: theCase,
              messages: uiMessagesForServer(nextNoSys),
            } as any);
            setMessages((p2) => [...p2, makeExaminerMsg(aiText)]);
            return;
          } catch {
            setAiMode("local");
          }
        }

        setMessages((p2) => {
          const p2NoSys = withoutSystem(p2);
          return [...p2, nextExaminerMessageAfterUser(cfg, p2NoSys, theCase)];
        });
      }, 450);

      return next;
    });
  };

  const orderInvestigation = (testId: string) => {
    if (!cfg || !theCase) return;

    const ordered = orderTest(testId);

    const userMsg: ChatMessage = {
      id: Math.random().toString(16).slice(2),
      role: "user",
      text: `Ich ordne an: ${ordered.item.label}.`,
      ts: Date.now(),
      meta: { followUp: true },
    };

    const sysMsg: ChatMessage = {
      id: Math.random().toString(16).slice(2),
      role: "system",
      text: formatResultForChat(ordered),
      ts: Date.now() + 1,
    };

    setInvestigationOpen(false);
    setDraft("");
    setSecondsLeft(baseSeconds);

    setMessages((prev) => {
      const next = [...prev, userMsg, sysMsg];

      setTimeout(() => {
        setInterruptedThisTurn(false);
        setMessages((p2) => {
          const p2NoSys = withoutSystem(p2);
          return [...p2, examinerMessageAfterInvestigation(cfg, p2NoSys, theCase, ordered, phase)];
        });
      }, 450);

      return next;
    });
  };

  const end = () => navigation.navigate("Feedback" as never, { cfg, messages, caseId: theCase?.id } as never);

  // ✅ während Gate läuft: nicht rendern (verhindert Flicker/Fehler)
  if (!gateReady) {
    return (
      <ThemedScreen section="simulation" style={{ paddingHorizontal: 0, paddingTop: 0 }}>
        <View style={{ flex: 1, padding: 18, justifyContent: "center" }}>
          <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text }}>Prüfe Zugriff…</Text>
          <Text style={{ color: colors.textMuted, marginTop: 8, fontWeight: "800" }}>Einen Moment.</Text>
        </View>
      </ThemedScreen>
    );
  }

  if (!cfg) {
    return (
      <Screen>
        <View style={{ flex: 1, padding: 18 }}>
          <Text style={{ fontSize: 24, fontWeight: "900", color: colors.text }}>Simulation</Text>
          <Text style={{ color: colors.textMuted, marginTop: 8, fontWeight: "800" }}>
            Keine Konfiguration gefunden. Geh zurück und starte neu.
          </Text>
          <VButton title="Zurück" variant="cta" onPress={() => navigation.popToTop()} style={{ marginTop: 14 }} />
        </View>
      </Screen>
    );
  }

  const aiNote =
    aiMode === "checking"
      ? "KI-Prüfer: prüfe Server…"
      : useAiExaminer
      ? `KI-Prüfer aktiv (Server). ${aiBaseUrl ? `URL: ${aiBaseUrl}` : ""}`
      : "KI-Prüfer aus / nicht erreichbar → lokaler Prüfer aktiv.";

  return (
    <ThemedScreen section="simulation" style={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.headerWrap}>
          <Card accent padding="lg">
            <View style={styles.headerTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Simulation</Text>
                <Text style={styles.subtitle}>
                  {cfg.fachrichtung} • {cfg.tone} • Schwierigkeit {Math.round(cfg.difficulty)} •{" "}
                  {cfg.mode === "voice" ? "Mündlich" : "Schriftlich"}
                </Text>
              </View>

              <VButton title="Beenden" variant="outline" onPress={end} />
            </View>

            <View style={styles.pills}>
              <Pill text={`Phase: ${phaseLabel(phase)}`} />
              <Pill text={`Zeit: ${mmss(secondsLeft)}`} />
              <Pill text={`Turn: ${mmss(baseSeconds)}`} />
              <Pill text={`Profil: ${profileLabel(getExaminerProfile(cfg))}`} />
              {cfg.mode === "voice" ? (
                <TogglePill
                  text={speakerOn ? "🔊 Prüfer spricht" : "🔇 Stumm"}
                  active={speakerOn}
                  onPress={() => setSpeakerOn((s) => !s)}
                />
              ) : null}
            </View>

            {cfg.mode === "voice" ? (
              <View style={[styles.note, { backgroundColor: rgba(tokens.tint, 0.06), borderColor: rgba(tokens.tint, 0.14) }]}>
                <Text style={styles.noteText}>Tipp: Am iPhone kannst du die Diktierfunktion (Mikrofon auf der Tastatur) nutzen.</Text>
              </View>
            ) : null}

            <View style={[styles.note, { marginTop: 10, backgroundColor: rgba(tokens.tint, 0.04), borderColor: rgba(tokens.tint, 0.10) }]}>
              <Text style={styles.noteText}>{aiNote}</Text>
            </View>
          </Card>
        </View>

        {/* Case */}
        {theCase ? (
          <View style={styles.caseWrap}>
            <Card padding="lg">
              <Text style={styles.caseOverline}>Fall</Text>
              <Text style={styles.caseTitle}>{theCase.title}</Text>
              <Text style={styles.caseText}>{theCase.vignette}</Text>
            </Card>
          </View>
        ) : null}

        {/* Chat */}
        <FlatList
          ref={listRef}
          style={{ flex: 1 }}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ChatBubble role={item.role === "user" ? "student" : item.role === "examiner" ? "examiner" : "system"} text={item.text} />
          )}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        <ChatComposer
          value={draft}
          onChangeText={setDraft}
          placeholder={cfg.mode === "voice" ? "Sprich per Diktierfunktion… (oder tippe)" : "Deine Antwort…"}
          onSend={send}
          topSlot={
            <View style={{ flexDirection: "row", gap: 10 }}>
              <VButton
                title="Untersuchung anfordern"
                variant="outline"
                onPress={() => {
                  Keyboard.dismiss();
                  setInvestigationOpen(true);
                }}
              />
            </View>
          }
        />

        <InvestigationPickerModal visible={investigationOpen} onClose={() => setInvestigationOpen(false)} onPick={orderInvestigation} />
      </View>
    </ThemedScreen>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: 16, paddingTop: 10 },
  headerTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },

  title: { fontSize: 22, fontWeight: "900", color: colors.text },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 16, fontWeight: "800" },

  pills: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, maxWidth: "100%" },
  pillText: { fontWeight: "900", fontSize: 12, color: colors.text },

  note: { marginTop: 12, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  noteText: { color: colors.textMuted, fontSize: 12, lineHeight: 16, fontWeight: "800" },

  caseWrap: { paddingHorizontal: 16, marginTop: 12 },
  caseOverline: { color: colors.textMuted, fontSize: 12, fontWeight: "900" },
  caseTitle: { color: colors.text, fontWeight: "900", fontSize: 16, marginTop: 6, marginBottom: 6 },
  caseText: { color: colors.textMuted, lineHeight: 18, fontWeight: "700" },

  listContent: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 160 },
});
