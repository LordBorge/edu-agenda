import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../theme';
import { formatDate, getMonthCalendarWeeks, isSameDate, normalizeDate } from '../utils/time';
import { BottomSheetModal } from './BottomSheetModal';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function dateFromISO(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);

  if (Number.isNaN(date.getTime())) {
    return normalizeDate(new Date());
  }

  return normalizeDate(date);
}

function isoFromDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function getLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function DatePickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { colors } = useAppTheme();
  const selectedDate = dateFromISO(value);
  const [open, setOpen] = useState(false);
  const [visibleMonthDate, setVisibleMonthDate] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  const visibleYear = visibleMonthDate.getFullYear();
  const visibleMonth = visibleMonthDate.getMonth();
  const weeks = useMemo(
    () => getMonthCalendarWeeks(visibleYear, visibleMonth),
    [visibleMonth, visibleYear]
  );

  const openCalendar = () => {
    setVisibleMonthDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    setOpen(true);
  };

  const moveMonth = (direction: -1 | 1) => {
    setVisibleMonthDate(current => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  };

  const chooseDate = (date: Date) => {
    const nextDate = normalizeDate(date);
    onChange(isoFromDate(nextDate));

    if (nextDate.getMonth() !== visibleMonth || nextDate.getFullYear() !== visibleYear) {
      setVisibleMonthDate(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    }
  };

  return (
    <>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={openCalendar}
        activeOpacity={0.75}
      >
        <Text style={[styles.fieldText, { color: colors.text }]}>{formatDate(isoFromDate(selectedDate))}</Text>
        <Text style={[styles.fieldIcon, { color: colors.secondary }]}>▾</Text>
      </TouchableOpacity>

      <BottomSheetModal visible={open} onClose={() => setOpen(false)} maxHeight="90%">
        <View style={styles.calendarContainer}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.surfaceMuted }]} onPress={() => moveMonth(-1)}>
              <Text style={[styles.navText, { color: colors.primary }]}>‹</Text>
            </TouchableOpacity>
            <Text style={[styles.monthTitle, { color: colors.text }]}>
              {MONTHS[visibleMonth]} {visibleYear}
            </Text>
            <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.surfaceMuted }]} onPress={() => moveMonth(1)}>
              <Text style={[styles.navText, { color: colors.primary }]}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((weekday, index) => (
              <View key={`${weekday}-${index}`} style={styles.weekCell}>
                <Text style={[styles.weekText, {
                  color: index === 0 || index === 6 ? colors.secondary : colors.textMuted,
                }]}>
                  {weekday}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {weeks.map((week, weekIndex) => (
              <View key={`week-${weekIndex}-${getLocalDateKey(week[0])}`} style={styles.daysRow}>
                {week.map(date => {
                  const active = isSameDate(date, selectedDate);
                  const isCurrentMonth = date.getMonth() === visibleMonth;

                  return (
                    <TouchableOpacity
                      key={getLocalDateKey(date)}
                      style={styles.dayCell}
                      onPress={() => chooseDate(date)}
                      activeOpacity={0.75}
                    >
                      <View style={[
                        styles.dayMarker,
                        active && { backgroundColor: colors.primary },
                      ]}>
                        <Text style={[
                          styles.dayText,
                          { color: isCurrentMonth ? colors.text : colors.textMuted },
                          !isCurrentMonth && { opacity: 0.38 },
                          active && { color: '#FFF', fontWeight: '800', opacity: 1 },
                        ]}>
                          {date.getDate()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
            onPress={() => setOpen(false)}
            activeOpacity={0.85}
          >
            <Text style={styles.confirmText}>Confirmar</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0 },
  field: {
    minHeight: 46, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, marginBottom: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  fieldText: { fontSize: 15, fontWeight: '700' },
  fieldIcon: { fontSize: 18, fontWeight: '800' },
  calendarContainer: { width: '100%', paddingBottom: 10 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  navBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 25, lineHeight: 28, fontWeight: '800' },
  monthTitle: { fontSize: 16, fontWeight: '800' },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekCell: { flex: 1, alignItems: 'center', paddingBottom: 4 },
  weekText: { fontSize: 11, fontWeight: '800' },
  daysGrid: { gap: 2 },
  daysRow: { flexDirection: 'row' },
  dayCell: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  dayMarker: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 14, fontWeight: '600' },
  confirmBtn: {
    alignItems: 'center',
    borderRadius: 10,
    marginTop: 14,
    paddingVertical: 11,
  },
  confirmText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
});
