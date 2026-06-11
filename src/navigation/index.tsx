import React from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashboardScreen } from '../screens/Dashboard';
import { AgendaScreen } from '../screens/Agenda';
import { TurmasScreen } from '../screens/Turmas';
import { AtividadesScreen } from '../screens/Atividades';
import { PerfilScreen } from '../screens/Perfil';
import { useAppTheme } from '../theme';
import { OnboardingTourDialog } from '../components/OnboardingTourDialog';

const TAB_ORDER = ['Dashboard', 'Agenda', 'Turmas', 'Atividades', 'Perfil'] as const;

type TabRouteName = typeof TAB_ORDER[number];
type IconName = 'home' | 'calendar' | 'classes' | 'tasks' | 'settings';
type FocusEventName = 'focus' | 'blur';
type RouteParams = Record<string, unknown> | undefined;
type Listener = () => void;

type TourStep = {
  route: TabRouteName;
  title: string;
  message: string;
  confirmLabel: string;
};

type MainRoute = {
  name: TabRouteName;
  label: string;
  icon: IconName;
  component: React.ComponentType<any>;
};

const MAIN_ROUTES: MainRoute[] = [
  { name: 'Dashboard', label: 'Início', icon: 'home', component: DashboardScreen },
  { name: 'Agenda', label: 'Agenda', icon: 'calendar', component: AgendaScreen },
  { name: 'Turmas', label: 'Turmas', icon: 'classes', component: TurmasScreen },
  { name: 'Atividades', label: 'Tarefas', icon: 'tasks', component: AtividadesScreen },
  { name: 'Perfil', label: 'Config', icon: 'settings', component: PerfilScreen },
];

const TOUR_STEPS: TourStep[] = [
  {
    route: 'Dashboard',
    title: 'Início',
    message: 'Veja suas aulas do dia, tarefas próximas e lembretes importantes.',
    confirmLabel: 'Próximo',
  },
  {
    route: 'Agenda',
    title: 'Agenda',
    message: 'Organize seus horários semanais e acompanhe sua rotina por semana ou mês.',
    confirmLabel: 'Próximo',
  },
  {
    route: 'Turmas',
    title: 'Turmas',
    message: 'Cadastre suas turmas, componentes curriculares e cores de identificação.',
    confirmLabel: 'Próximo',
  },
  {
    route: 'Atividades',
    title: 'Tarefas',
    message: 'Registre atividades, avaliações, entregas e lembretes escolares.',
    confirmLabel: 'Próximo',
  },
  {
    route: 'Perfil',
    title: 'Configurações',
    message: 'Ajuste seus horários, intervalos, tema e preferências do aplicativo.',
    confirmLabel: 'Começar a usar',
  },
];

type AppNavigatorProps = {
  initialRouteName?: string;
  guidedTourActive?: boolean;
  setupLocked?: boolean;
  showSetupReminder?: boolean;
  onTourComplete?: () => void | Promise<void>;
  onSetupComplete?: () => void;
};

function routeIndex(routeName: string): number {
  return TAB_ORDER.indexOf(routeName as TabRouteName);
}

function initialParams(): Record<TabRouteName, RouteParams> {
  return {
    Dashboard: undefined,
    Agenda: undefined,
    Turmas: undefined,
    Atividades: undefined,
    Perfil: undefined,
  };
}

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

export function AppNavigator({
  initialRouteName = 'Dashboard',
  guidedTourActive = false,
  setupLocked = false,
  showSetupReminder = false,
  onTourComplete,
  onSetupComplete,
}: AppNavigatorProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const initialIndex = Math.max(0, routeIndex(setupLocked ? 'Perfil' : initialRouteName));
  const translateX = React.useRef(new Animated.Value(-initialIndex * width)).current;
  const listenersRef = React.useRef<Record<TabRouteName, Record<FocusEventName, Set<Listener>>>>({
    Dashboard: { focus: new Set(), blur: new Set() },
    Agenda: { focus: new Set(), blur: new Set() },
    Turmas: { focus: new Set(), blur: new Set() },
    Atividades: { focus: new Set(), blur: new Set() },
    Perfil: { focus: new Set(), blur: new Set() },
  });
  const activeIndexRef = React.useRef(initialIndex);
  const routeParamsRef = React.useRef<Record<TabRouteName, RouteParams>>(initialParams());
  const [activeIndex, setActiveIndex] = React.useState(initialIndex);
  const [routeParams, setRouteParams] = React.useState<Record<TabRouteName, RouteParams>>(initialParams);
  const [dragging, setDragging] = React.useState(false);
  const [tourIndex, setTourIndex] = React.useState(0);
  const tourStep = guidedTourActive ? TOUR_STEPS[tourIndex] : null;

  React.useEffect(() => {
    routeParamsRef.current = routeParams;
  }, [routeParams]);

  const emit = React.useCallback((routeName: TabRouteName, eventName: FocusEventName) => {
    listenersRef.current[routeName][eventName].forEach(listener => listener());
  }, []);

  const animateToIndex = React.useCallback((
    nextIndex: number,
    animated = true,
    onFinished?: () => void
  ) => {
    const toValue = -nextIndex * width;

    if (!animated || width <= 0) {
      translateX.setValue(toValue);
      onFinished?.();
      return;
    }

    Animated.timing(translateX, {
      toValue,
      duration: Math.min(340, 220 + Math.abs(nextIndex - activeIndexRef.current) * 35),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onFinished?.());
  }, [translateX, width]);

  const updateParams = React.useCallback((routeName: TabRouteName, params?: RouteParams) => {
    if (params === undefined) return;

    setRouteParams(current => ({
      ...current,
      [routeName]: {
        ...(current[routeName] ?? {}),
        ...params,
      },
    }));
  }, []);

  const navigateToIndex = React.useCallback((
    nextIndex: number,
    params?: RouteParams,
    animated = true,
    onFinished?: () => void
  ) => {
    if (nextIndex < 0 || nextIndex >= TAB_ORDER.length) {
      onFinished?.();
      return;
    }

    const nextRoute = TAB_ORDER[nextIndex];
    if (setupLocked && nextRoute !== 'Perfil') {
      onFinished?.();
      return;
    }

    updateParams(nextRoute, params);

    const previousIndex = activeIndexRef.current;
    if (nextIndex !== previousIndex) {
      const previousRoute = TAB_ORDER[previousIndex];
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
      emit(previousRoute, 'blur');
      emit(nextRoute, 'focus');
    }

    animateToIndex(nextIndex, animated, onFinished);
  }, [animateToIndex, emit, setupLocked, updateParams]);

  const navigateToRoute = React.useCallback((routeName: string, params?: RouteParams, animated = true) => {
    const nextIndex = routeIndex(routeName);
    if (nextIndex < 0) return;
    navigateToIndex(nextIndex, params, animated);
  }, [navigateToIndex]);

  React.useEffect(() => {
    translateX.setValue(-activeIndexRef.current * width);
  }, [translateX, width]);

  React.useEffect(() => {
    if (setupLocked) {
      navigateToRoute('Perfil', undefined, false);
    }
  }, [navigateToRoute, setupLocked]);

  React.useEffect(() => {
    if (!guidedTourActive) {
      setTourIndex(0);
      return;
    }

    navigateToRoute(TOUR_STEPS[tourIndex]?.route ?? 'Dashboard');
  }, [guidedTourActive, navigateToRoute, tourIndex]);

  const navigationByRoute = React.useMemo(() => {
    return TAB_ORDER.reduce((acc, routeName) => {
      acc[routeName] = {
        navigate: (nextRouteName: string, params?: RouteParams) => navigateToRoute(nextRouteName, params),
        setParams: (params?: RouteParams) => updateParams(routeName, params),
        addListener: (eventName: FocusEventName, listener: Listener) => {
          if (eventName !== 'focus' && eventName !== 'blur') return () => undefined;

          listenersRef.current[routeName][eventName].add(listener);
          return () => {
            listenersRef.current[routeName][eventName].delete(listener);
          };
        },
        isFocused: () => TAB_ORDER[activeIndexRef.current] === routeName,
        canGoBack: () => false,
        goBack: () => undefined,
        dispatch: () => undefined,
        getParent: () => undefined,
        getState: () => ({
          index: activeIndexRef.current,
          routes: TAB_ORDER.map(name => ({
            key: name,
            name,
            params: routeParamsRef.current[name],
          })),
        }),
      };
      return acc;
    }, {} as Record<TabRouteName, any>);
  }, [navigateToRoute, updateParams]);

  const handleTourConfirm = async () => {
    const isLastStep = tourIndex >= TOUR_STEPS.length - 1;
    if (!isLastStep) {
      setTourIndex(current => current + 1);
      return;
    }

    navigateToRoute('Perfil');
    await onTourComplete?.();
  };

  const panResponder = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => (
      !setupLocked
      && !guidedTourActive
      && Math.abs(gesture.dx) > 14
      && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.45
    ),
    onMoveShouldSetPanResponder: (_, gesture) => (
      !setupLocked
      && !guidedTourActive
      && Math.abs(gesture.dx) > 14
      && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.45
    ),
    onPanResponderGrant: () => {
      translateX.stopAnimation();
      setDragging(true);
    },
    onPanResponderMove: (_, gesture) => {
      const current = activeIndexRef.current;
      const atStart = current === 0 && gesture.dx > 0;
      const atEnd = current === TAB_ORDER.length - 1 && gesture.dx < 0;
      const clampedDx = atStart || atEnd ? gesture.dx * 0.25 : gesture.dx;

      translateX.setValue((-current * width) + clampedDx);
    },
    onPanResponderRelease: (_, gesture) => {
      const current = activeIndexRef.current;
      const shouldMove = Math.abs(gesture.dx) > width * 0.22 || Math.abs(gesture.vx) > 0.55;
      const nextIndex = shouldMove
        ? gesture.dx < 0 ? current + 1 : current - 1
        : current;
      const boundedNextIndex = Math.max(0, Math.min(TAB_ORDER.length - 1, nextIndex));

      navigateToIndex(boundedNextIndex, undefined, true, () => setDragging(false));
    },
    onPanResponderTerminate: () => {
      navigateToIndex(activeIndexRef.current, undefined, true, () => setDragging(false));
    },
  }), [guidedTourActive, navigateToIndex, setupLocked, translateX, width]);

  return (
    <View style={[styles.navigatorShell, { backgroundColor: colors.background }]}>
      <View style={styles.pagerWindow} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            styles.pagerTrack,
            {
              width: width * MAIN_ROUTES.length,
              transform: [{ translateX }],
            },
          ]}
        >
          {MAIN_ROUTES.map((route, index) => {
            const ScreenComponent = route.component;
            const navigation = navigationByRoute[route.name];
            const routeObject = {
              key: route.name,
              name: route.name,
              params: routeParams[route.name],
            };

            return (
              <View
                key={route.name}
                pointerEvents={dragging || activeIndex !== index ? 'none' : 'auto'}
                style={[styles.page, { width }]}
              >
                <NavigationContext.Provider value={navigation}>
                  <NavigationRouteContext.Provider value={routeObject}>
                    <ScreenComponent
                      navigation={navigation}
                      route={routeObject}
                      setupLocked={route.name === 'Perfil' ? setupLocked : undefined}
                      showSetupReminder={route.name === 'Perfil' ? showSetupReminder : undefined}
                      onSetupComplete={route.name === 'Perfil' ? onSetupComplete : undefined}
                    />
                  </NavigationRouteContext.Provider>
                </NavigationContext.Provider>
              </View>
            );
          })}
        </Animated.View>
      </View>

      {!setupLocked ? (
        <View
          style={[
            styles.tabBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              height: 60 + Math.max(insets.bottom, 10),
              paddingBottom: Math.max(insets.bottom, 10),
            },
          ]}
        >
          {MAIN_ROUTES.map((route, index) => (
            <TouchableOpacity
              key={route.name}
              style={styles.tabButton}
              activeOpacity={0.78}
              onPress={() => navigateToIndex(index)}
            >
              <TabIcon label={route.label} name={route.icon} focused={activeIndex === index} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <OnboardingTourDialog
        visible={!!tourStep}
        title={tourStep?.title ?? ''}
        message={tourStep?.message ?? ''}
        confirmLabel={tourStep?.confirmLabel ?? 'Próximo'}
        onConfirm={handleTourConfirm}
      />
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

const styles = StyleSheet.create({
  navigatorShell: { flex: 1 },
  pagerWindow: {
    flex: 1,
    overflow: 'hidden',
  },
  pagerTrack: {
    flex: 1,
    flexDirection: 'row',
  },
  page: {
    flex: 1,
  },
  tabBar: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingTop: 6,
  },
  tabButton: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
