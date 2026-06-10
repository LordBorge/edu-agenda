import React from 'react';
import { TextInput } from 'react-native';
import type { TextInputProps } from 'react-native';
import { maskTimeInput } from '../utils/time';

type TimeInputProps = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (value: string) => void;
};

export function TimeInput({ onChangeText, ...props }: TimeInputProps) {
  return (
    <TextInput
      {...props}
      keyboardType={props.keyboardType ?? 'number-pad'}
      maxLength={props.maxLength ?? 5}
      onChangeText={value => onChangeText(maskTimeInput(value))}
    />
  );
}
