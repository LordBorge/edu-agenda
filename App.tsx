import React, { useEffect, useState } from 'react';
import { Image, View, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase } from './src/database/database';
import {
  getProfessionalProfile,
  hasCompletedGuidedTour,
  hasCompletedInitialRegistration,
  markGuidedTourComplete,
} from './src/database/queries';
import { AppNavigator } from './src/navigation';
import { WelcomeScreen } from './src/screens/Welcome';
import { AppThemeProvider } from './src/theme';
import { ThemePreference } from './src/types';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  const [initialRouteName, setInitialRouteName] = useState('Dashboard');
  const [guidedTourActive, setGuidedTourActive] = useState(false);
  const [showSetupReminder, setShowSetupReminder] = useState(false);
  const [setupLocked, setSetupLocked] = useState(false);

  useEffect(() => {
    initDatabase()
      .then(async () => {
        const [profile, registrationComplete, tourComplete] = await Promise.all([
          getProfessionalProfile(),
          hasCompletedInitialRegistration(),
          hasCompletedGuidedTour(),
        ]);
        const hasProfileBasics = Boolean(profile.name.trim() && profile.subjects.trim() && profile.work_periods.trim());
        const shouldShowWelcome = !registrationComplete || !hasProfileBasics;
        const shouldShowTour = !shouldShowWelcome && !tourComplete;

        setNeedsOnboarding(shouldShowWelcome);
        setGuidedTourActive(shouldShowTour);
        setSetupLocked(false);
        setInitialRouteName('Dashboard');
        setShowSetupReminder(false);
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
          source={require('./assets/icon.png')}
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
          <WelcomeScreen
            onComplete={() => {
              setInitialRouteName('Dashboard');
              setGuidedTourActive(true);
              setShowSetupReminder(false);
              setSetupLocked(false);
              setNeedsOnboarding(false);
            }}
          />
        </AppThemeProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppThemeProvider initialPreference={themePreference}>
        <AppNavigator
          initialRouteName={initialRouteName}
          guidedTourActive={guidedTourActive}
          setupLocked={setupLocked}
          showSetupReminder={showSetupReminder}
          onTourComplete={async () => {
            await markGuidedTourComplete();
            setGuidedTourActive(false);
            setSetupLocked(false);
            setShowSetupReminder(false);
          }}
          onSetupComplete={() => {
            setSetupLocked(false);
            setShowSetupReminder(false);
            setInitialRouteName('Dashboard');
          }}
        />
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
    height: 150,
    width: 150,
  },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#C0392B' },
  errorMsg: { fontSize: 12, color: '#64748B', textAlign: 'center', paddingHorizontal: 20 },
});
