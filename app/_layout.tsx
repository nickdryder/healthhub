import React, { useEffect, useCallback, useRef } from "react";
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
import { ErrorBoundary } from "@/components/ErrorBoundary";

const queryClient = new QueryClient();

function RootLayoutContent() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { syncAllIntegrationsSilent } = useHealthIntegrations();
  const isMountedRef = useRef(true);

  // Initialize cycle data on mount
  useEffect(() => {
    let cancelled = false;

    const initializeCycleData = async () => {
      try {
        const entries = await cycleTracking.getCycleEntries();
        if (!cancelled && isMountedRef.current) {
          console.log('Cycle data initialized:', entries.length, 'entries');
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to initialize cycle data:', err);
        }
      }
    };

    initializeCycleData();

    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-sync integrations when user logs in
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const autoSync = async () => {
      try {
        const success = await syncAllIntegrationsSilent();
        if (!cancelled && isMountedRef.current && success) {
          console.log('Background sync completed');
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Background sync error:', err);
        }
      }
    };

    autoSync();

    return () => {
      cancelled = true;
    };
  }, [user?.id]); // Only depend on user ID, not the function

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}