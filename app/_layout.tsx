import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/providers/AuthProvider";
import { ThemeProvider, useTheme } from "@/providers/ThemeProvider";
import { InsightCacheProvider } from "@/providers/InsightCacheProvider";
import { cycleTracking } from "@/services/cycle-tracking";
import { useAuth } from "@/providers/AuthProvider";
import { useHealthIntegrations } from "@/hooks/useHealthIntegrations";

const queryClient = new QueryClient();

function RootLayoutContent() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { syncAllIntegrationsSilent } = useHealthIntegrations();
  
  // Initialize cycle mock data and auto-sync on startup
  useEffect(() => {
    console.log('🚀 Root Layout: Initializing cycle mock data');
    cycleTracking.getCycleEntries().then(entries => {
      console.log('🎯 Root Layout: Got cycle entries:', entries.length);
    }).catch(err => console.error('❌ Failed to initialize cycle data:', err));
  }, []);

  // Auto-sync integrations silently in background when user is authenticated
  useEffect(() => {
    if (user) {
      console.log('🔄 Auto-syncing integrations in background...');
      syncAllIntegrationsSilent().then(success => {
        if (success) console.log('✅ Background sync completed');
      }).catch(err => console.error('Background sync error:', err));
    }
  }, [user, syncAllIntegrationsSilent]);
  
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" options={{ presentation: "modal" }} />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <InsightCacheProvider>
                <RootLayoutContent />
              </InsightCacheProvider>
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}