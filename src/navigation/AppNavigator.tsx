import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { HomeScreen } from "../screens/HomeScreen";
import { SimulationScreen } from "../screens/SimulationScreen";
import { FeedbackScreen } from "../screens/FeedbackScreen";
import { TrainingScreen } from "../screens/TrainingScreen";
import { ProgressScreen } from "../screens/ProgressScreen";
import { DrillPlayerScreen } from "../screens/DrillPlayerScreen";

import { ExamScreen } from "../screens/ExamScreen";
import { ExamResultScreen } from "../screens/ExamResultScreen";
import { LeitsymptomScreen } from "../screens/LeitsymptomScreen";

import { TrainerHubScreen } from "../screens/TrainerHubScreen";
import { EkgTrainerScreen } from "../screens/EKGTrainerScreen";
import { RoentgenTrainerScreen } from "../screens/RoentgenTrainerScreen";

import { PlanScreen } from "../screens/PlanScreen";
import { CreditsScreen } from "../screens/CreditsScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";

import { SettingsScreen } from "../screens/SettingsScreen";
import { PaywallScreen } from "../screens/PaywallScreen";

export type RootStackParamList = {
  Home: undefined;
  Simulation: { cfg: any; generatedCase?: any } | undefined;
  Feedback: { cfg: any; messages: any[]; caseId?: string } | undefined;

  Training: undefined;
  Progress: undefined;
  DrillPlayer: { drillId: string; id?: string } | undefined;

  Exam: { cfg?: any } | undefined;
  ExamResult: any;

  Leitsymptom: any;

  TrainerHub: undefined;
  EkgTrainer: undefined;
  RoentgenTrainer: undefined;

  Plan: { cfg?: any } | undefined;
  Credits: undefined;
  Onboarding: undefined;

  Settings: undefined;
  Paywall: { reason?: string } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        animation: "fade",
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Simulation" component={SimulationScreen} />
      <Stack.Screen name="Feedback" component={FeedbackScreen} />

      <Stack.Screen name="Training" component={TrainingScreen} />
      <Stack.Screen name="Progress" component={ProgressScreen} />
      <Stack.Screen name="DrillPlayer" component={DrillPlayerScreen} />

      <Stack.Screen name="Exam" component={ExamScreen} />
      <Stack.Screen name="ExamResult" component={ExamResultScreen} />

      <Stack.Screen name="Leitsymptom" component={LeitsymptomScreen} />

      <Stack.Screen name="TrainerHub" component={TrainerHubScreen} />
      <Stack.Screen name="EkgTrainer" component={EkgTrainerScreen} />
      <Stack.Screen name="RoentgenTrainer" component={RoentgenTrainerScreen} />

      <Stack.Screen name="Plan" component={PlanScreen} />
      <Stack.Screen name="Credits" component={CreditsScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />

      {/* ✅ Paywall besser als Modal */}
      <Stack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />

      {/* ✅ Settings auch als Modal (optional, aber nice) */}
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
    </Stack.Navigator>
  );
}
