/**
 * Arquivo: src/components/LessonCard.tsx
 * Descrição: Componente de Cartão de Aula (LessonCard).
 * Exibe as informações básicas de uma aula em uma lista, como horários, nome da turma,
 * componente curricular (disciplina), resumo do conteúdo trabalhado, status da aula e o chip
 * indicativo de "Aula preparada" ou "Aula não preparada". Usado tanto no Dashboard quanto na Agenda.
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Lesson } from '../types';
import { lightenColor } from '../utils/colors';
import { formatLessonActivities } from '../utils/lessonActivities';
import { hasPendingLessonContent, isLessonContentPrepared } from '../utils/lessonContent';
import { useAppTheme } from '../theme';

// Propriedades (Props) aceitas pelo LessonCard.
interface Props {
  // A aula cujas informações serão exibidas.
  lesson: Lesson;
  // Ação opcional disparada ao clicar no cartão.
  onPress?: () => void;
  // Se true, renderiza um layout menor/compactado (ex: sem conteúdo, sem chip e sem status).
  compact?: boolean;
}

export function LessonCard({ lesson, onPress, compact = false }: Props) {
  // Obtém o tema atual do app.
  const { colors } = useAppTheme();

  // Cor principal associada à turma da aula (usa a cor da turma ou a cor primária do tema como fallback).
  const color = lesson.class_color || colors.primary;

  // Cor de fundo do card (suave/transparente baseada na cor da turma).
  const bg = colors.mode === 'dark' ? `${color}22` : lightenColor(color);

  // Formata a lista de atividades associadas à aula (transforma de array/string para texto amigável).
  const activities = formatLessonActivities(lesson.activity);

  // Verifica se o horário é reservado para eventos da instituição (ou seja, não é uma aula letiva comum).
  const isReserved = lesson.kind === 'reserved';

  // Verifica se a aula possui algum conteúdo de aula pendente de preenchimento (mantido para compatibilidade).
  const hasPendingContent = hasPendingLessonContent(lesson);

  // Título do card: se for reservado mostra o título do evento, senão mostra "Turma · Disciplina".
  const title = isReserved
    ? lesson.title || 'Horário reservado'
    : `${lesson.class_name ?? 'Turma'} · ${lesson.subject ?? 'Componente Curricular'}`;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.card,
        { backgroundColor: bg, borderLeftColor: color, borderColor: colors.mode === 'dark' ? `${color}33` : 'transparent' },
        compact && styles.compact,
      ]}
    >
      {/* Horário de início e término da aula */}
      <Text style={[styles.time, { color }]}>{lesson.start_time} – {lesson.end_time}</Text>
      
      {/* Título principal (Turma/Matéria ou Reserva) */}
      <Text style={[styles.class, { color }]} numberOfLines={1}>{title}</Text>
      
      {/* Se não for versão compacta, exibe a descrição do conteúdo lecionado */}
      {!compact && (
        <Text style={[styles.content, { color: colors.text }]} numberOfLines={2}>
          {isReserved ? 'Evento institucional' : lesson.content || 'Sem conteúdo'}
        </Text>
      )}
      
      {/* Se existirem atividades e não for compacto, exibe a listagem de atividades */}
      {activities && !compact && (
        <Text style={[styles.activity, { color: colors.textMuted }]} numberOfLines={1}>Atividade: {activities}</Text>
      )}
      
      {/* Se houver status de aula (ex: concluída, pendente, cancelada) e não for compacto, exibe-o */}
      {lesson.status && !compact && (
        <Text style={[styles.activity, { color: colors.textMuted }]} numberOfLines={1}>Status: {lesson.status}</Text>
      )}
      
      {/* Chip de preparação: se for aula letiva (não reservada) e não compacto, exibe o chip colorido */}
      {!isReserved && !compact && (
        <View
          style={[
            styles.pendingChip,
            {
              // Se o material estiver preparado: verde. Se não: amarelo/laranja.
              backgroundColor: isLessonContentPrepared(lesson)
                ? (colors.mode === 'dark' ? '#114B3E' : '#E8F8F5')
                : (colors.mode === 'dark' ? '#4A3412' : '#FFF4D6')
            },
          ]}
        >
          <Text
            style={[
              styles.pendingChipText,
              {
                // Altera a cor do texto conforme o status para legibilidade perfeita.
                color: isLessonContentPrepared(lesson)
                  ? (colors.mode === 'dark' ? '#1ABC9C' : '#0E6251')
                  : (colors.mode === 'dark' ? '#FFB74D' : '#9A5B00')
              }
            ]}
          >
            {isLessonContentPrepared(lesson) ? 'Aula preparada' : 'Aula não preparada'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderLeftWidth: 3,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  compact: {
    padding: 6,
    marginBottom: 4,
  },
  time: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
    opacity: 0.8,
  },
  class: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 3,
  },
  content: {
    fontSize: 12,
    color: '#555',
    marginBottom: 3,
    lineHeight: 17,
  },
  activity: {
    fontSize: 11,
    color: '#777',
  },
  pendingChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendingChipText: {
    color: '#9A5B00',
    fontSize: 10,
    fontWeight: '800',
  },
});
