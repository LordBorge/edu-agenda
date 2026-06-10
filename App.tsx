import React, { useEffect, useState } from 'react';
import { Image, View, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase } from './src/database/database';
import { getProfessionalProfile } from './src/database/queries';
import { AppNavigator } from './src/navigation';
import { WelcomeScreen } from './src/screens/Welcome';
import { AppThemeProvider } from './src/theme';
import { ThemePreference } from './src/types';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');

  useEffect(() => {
    initDatabase()
      .then(async () => {
        const profile = await getProfessionalProfile();
        setNeedsOnboarding(!profile.onboarded);
        setThemePreference(profile.theme_preference ?? 'system');
        setReady(true);
      })
      .catch(e => {
        console.error('DB init error:', e);
        setError(String(e));
      });
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Erro ao inicializar</Text>
        <Text style={styles.errorMsg}>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.splash}>
        <Image
          source={require('./assets/splash-logo.png')}
          style={styles.splashLogo}
          resizeMode="contain"
        />
      </View>
    );
  }

  if (needsOnboarding) {
    return (
      <SafeAreaProvider>
        <AppThemeProvider initialPreference={themePreference}>
          <WelcomeScreen onComplete={() => setNeedsOnboarding(false)} />
        </AppThemeProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppThemeProvider initialPreference={themePreference}>
        <AppNavigator />
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', gap: 12 },
  splash: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    flex: 1,
    justifyContent: 'center',
  },
  splashLogo: {
    height: 220,
    width: 220,
  },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#C0392B' },
  errorMsg: { fontSize: 12, color: '#64748B', textAlign: 'center', paddingHorizontal: 20 },
});
