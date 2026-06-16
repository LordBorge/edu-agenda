/**
 * Arquivo: src/components/PreparedContentToggle.tsx
 * Descrição: Componente de Toggle para Material Preparado.
 * Este componente apresenta um controle visual de tipo "Sim" / "Não" (botões lado a lado)
 * para definir se o material didático de uma aula está pronto para ser aplicado.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../theme';

// Propriedades (Props) aceitas pelo componente.
type Props = {
  // O valor atual do toggle (true para Sim, false para Não).
  value: boolean;
  // Callback acionada ao alternar a opção, repassando o novo booleano.
  onChange: (value: boolean) => void;
};

export function PreparedContentToggle({ value, onChange }: Props) {
  // Carrega as cores do tema corrente (claro/escuro).
  const { colors } = useAppTheme();

  return (
    <View style={styles.wrap}>
      {/* Rótulo do campo, atualizado de 'Conteúdo preparado' para 'Material preparado' */}
      <Text style={[styles.label, { color: colors.textMuted }]}>Material preparado</Text>
      
      {/* Linha que renderiza as opções Sim e Não lado a lado */}
      <View style={styles.row}>
        {[
          { label: 'Sim', value: true },
          { label: 'Não', value: false },
        ].map(option => {
          // Determina se a opção iterada é a que está ativa no momento.
          const active = value === option.value;
          return (
            <TouchableOpacity
              key={option.label}
              activeOpacity={0.78}
              style={[
                styles.option,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                // Aplica a cor primária do tema se o botão estiver ativo
                active && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => onChange(option.value)}
            >
              <Text style={[
                styles.optionText,
                { color: colors.text },
                // Aplica texto em branco e negrito destacado se estiver selecionado
                active && { color: '#FFF', fontWeight: '800' },
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 9,
  },
  optionText: { fontSize: 12, fontWeight: '700' },
});
