import React from 'react';
import { PanResponder, View, Text, StyleSheet } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DashboardScreen } from '../screens/Dashboard';
import { AgendaScreen } from '../screens/Agenda';
import { TurmasScreen } from '../screens/Turmas';
import { AtividadesScreen } from '../screens/Atividades';
import { PerfilScreen } from '../screens/Perfil';
import { useAppTheme } from '../theme';

const Tab = createBottomTabNavigator();
const TAB_ORDER = ['Dashboard', 'Agenda', 'Turmas', 'Atividades', 'Perfil'];

type IconName = 'home' | 'calendar' | 'classes' | 'tasks' | 'settings';

function LineIcon({ name, color }: { name: IconName; color: string }) {
  if (name === 'home') {
    return (
      <View style={iconStyles.homeBox}>
        <View style={[iconStyles.homeRoof, { borderColor: color }]} />
        <View style={[iconStyles.homeBase, { borderColor: color }]}>
          <View style={[iconStyles.homeCalendar, { borderColor: color }]}>
            <View style={[iconStyles.homeCalendarHeader, { backgroundColor: color }]} />
          </View>
          <View style={[iconStyles.homeBoardLine, { backgroundColor: color }]} />
        </View>
      </View>
    );
  }

  if (name === 'calendar') {
    return (
      <View style={iconStyles.plannerBox}>
        <View style={[iconStyles.plannerPage, iconStyles.plannerLeft, { borderColor: color }]}>
          <View style={[iconStyles.plannerLine, { backgroundColor: color, width: 7 }]} />
          <View style={[iconStyles.plannerLine, { backgroundColor: color, width: 5 }]} />
        </View>
        <View style={[iconStyles.plannerPage, iconStyles.plannerRight, { borderColor: color }]}>
          <View style={[iconStyles.pencilBody, { backgroundColor: color }]} />
        </View>
        <View style={[iconStyles.plannerRing, { backgroundColor: color, top: 6 }]} />
        <View style={[iconStyles.plannerRing, { backgroundColor: color, top: 13 }]} />
      </View>
    );
  }

  if (name === 'classes') {
    return (
      <View style={iconStyles.classroomBox}>
        <View style={[iconStyles.classBoard, { borderColor: color }]}>
          <View style={[iconStyles.classBoardLine, { backgroundColor: color }]} />
        </View>
        <View style={iconStyles.peopleRow}>
          <View style={iconStyles.personWrap}>
            <View style={[iconStyles.personHead, { borderColor: color }]} />
            <View style={[iconStyles.personBody, { borderColor: color }]} />
          </View>
          <View style={iconStyles.personWrap}>
            <View style={[iconStyles.personHead, { borderColor: color }]} />
            <View style={[iconStyles.personBody, { borderColor: color }]} />
          </View>
        </View>
      </View>
    );
  }

  if (name === 'tasks') {
    return (
      <View style={[iconStyles.clipboard, { borderColor: color }]}>
        <View style={[iconStyles.clip, { borderColor: color }]} />
        <View style={[iconStyles.clipLine, { backgroundColor: color, width: 8 }]} />
        <View style={[iconStyles.clipLine, { backgroundColor: color, width: 11 }]} />
        <View style={[iconStyles.checkStem, { backgroundColor: color }]} />
        <View style={[iconStyles.checkArm, { backgroundColor: color }]} />
      </View>
    );
  }

  return (
    <View style={iconStyles.gearBox}>
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
        <View
          key={i}
          style={[
            iconStyles.gearTooth,
            {
              backgroundColor: color,
              transform: [{ rotate: `${i * 45}deg` }, { translateY: -9 }],
            },
          ]}
        />
      ))}
      <View style={[iconStyles.gearOuter, { borderColor: color }]}>
        <View style={[iconStyles.gearInner, { borderColor: color }]} />
      </View>
    </View>
  );
}

function TabIcon({ label, name, focused }: { label: string; name: IconName; focused: boolean }) {
  const { colors } = useAppTheme();
  const color = focused ? colors.primary : colors.tabInactive;

  return (
    <View style={tabStyles.wrap}>
      <LineIcon name={name} color={color} />
      <Text style={[
        tabStyles.label,
        { color: colors.tabInactive },
        focused && { color: colors.primary },
      ]}>{label}</Text>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 4, minWidth: 56 },
  label: { fontSize: 10, fontWeight: '600' },
});

const iconStyles = StyleSheet.create({
  homeBox: { width: 26, height: 24, alignItems: 'center' },
  homeRoof: {
    width: 15, height: 15, borderLeftWidth: 2, borderTopWidth: 2,
    transform: [{ rotate: '45deg' }], position: 'absolute', top: 1,
  },
  homeBase: {
    width: 18, height: 13, borderWidth: 2, borderTopWidth: 0,
    borderRadius: 3, position: 'absolute', bottom: 1, paddingTop: 3,
    alignItems: 'center',
  },
  homeCalendar: { width: 7, height: 6, borderWidth: 1.4, borderRadius: 1, overflow: 'hidden', alignSelf: 'flex-start', marginLeft: 2 },
  homeCalendarHeader: { height: 2, width: '100%' },
  homeBoardLine: { width: 8, height: 1.7, borderRadius: 1, position: 'absolute', right: 2, top: 5 },
  plannerBox: { width: 26, height: 23, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  plannerPage: { width: 11, height: 19, borderWidth: 1.7, paddingTop: 5 },
  plannerLeft: { borderTopLeftRadius: 4, borderBottomLeftRadius: 4, borderRightWidth: 0 },
  plannerRight: { borderTopRightRadius: 4, borderBottomRightRadius: 4, borderLeftWidth: 0, alignItems: 'center' },
  plannerRing: { position: 'absolute', left: 12, width: 4, height: 2, borderRadius: 1 },
  plannerLine: { height: 1.5, borderRadius: 1, marginLeft: 3, marginBottom: 3 },
  pencilBody: { width: 2, height: 11, borderRadius: 1, marginTop: 2, transform: [{ rotate: '35deg' }] },
  classroomBox: { width: 26, height: 24, alignItems: 'center' },
  classBoard: { width: 22, height: 13, borderWidth: 2, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  classBoardLine: { width: 12, height: 2, borderRadius: 1 },
  peopleRow: { flexDirection: 'row', gap: 4, marginTop: 1 },
  personWrap: { width: 7, height: 10, alignItems: 'center' },
  personHead: { width: 5, height: 5, borderRadius: 3, borderWidth: 1.5 },
  personBody: { width: 7, height: 5, borderWidth: 1.5, borderTopWidth: 0, borderRadius: 3, marginTop: -1 },
  clipboard: { width: 20, height: 22, borderWidth: 2, borderRadius: 4, paddingTop: 6, paddingLeft: 5 },
  clip: { width: 8, height: 4, borderWidth: 1.5, borderRadius: 2, position: 'absolute', top: -3, alignSelf: 'center', backgroundColor: 'transparent' },
  clipLine: { height: 1.7, borderRadius: 1, marginBottom: 3 },
  checkStem: { width: 2, height: 6, borderRadius: 1, position: 'absolute', left: 7, top: 13, transform: [{ rotate: '-35deg' }] },
  checkArm: { width: 2, height: 10, borderRadius: 1, position: 'absolute', left: 11, top: 9, transform: [{ rotate: '45deg' }] },
  gearBox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  gearTooth: { width: 4, height: 6, borderRadius: 1, position: 'absolute' },
  gearOuter: { width: 18, height: 18, borderWidth: 2, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  gearInner: { width: 6, height: 6, borderWidth: 1.7, borderRadius: 3 },
});

export function AppNavigator() {
  const { colors } = useAppTheme();
  const navigationRef = useNavigationContainerRef<any>();

  const swipeResponder = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => (
      Math.abs(gesture.dx) > 70
      && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.8
    ),
    onPanResponderRelease: (_, gesture) => {
      const current = navigationRef.getCurrentRoute()?.name;
      const currentIndex = current ? TAB_ORDER.indexOf(current) : -1;
      if (currentIndex < 0) return;

      const nextIndex = gesture.dx < 0 ? currentIndex + 1 : currentIndex - 1;
      const next = TAB_ORDER[nextIndex];
      if (next) {
        navigationRef.navigate(next);
      }
    },
  }), [navigationRef]);

  return (
    <View style={styles.navigatorShell} {...swipeResponder.panHandlers}>
    <NavigationContainer ref={navigationRef}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 70,
            paddingBottom: 10,
            paddingTop: 6,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarShowLabel: false,
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon name="home" label="Início" focused={focused} /> }}
        />
        <Tab.Screen
          name="Agenda"
          component={AgendaScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon name="calendar" label="Agenda" focused={focused} /> }}
        />
        <Tab.Screen
          name="Turmas"
          component={TurmasScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon name="classes" label="Turmas" focused={focused} /> }}
        />
        <Tab.Screen
          name="Atividades"
          component={AtividadesScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon name="tasks" label="Tarefas" focused={focused} /> }}
        />
        <Tab.Screen
          name="Perfil"
          component={PerfilScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon name="settings" label="Config" focused={focused} /> }}
        />
      </Tab.Navigator>
    </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  navigatorShell: { flex: 1 },
});
