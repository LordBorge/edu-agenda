# EduAgenda

EduAgenda e um aplicativo mobile para planejamento pedagogico, organizacao de aulas, turmas, atividades, lembretes e horarios escolares. O app foi desenvolvido com React Native, Expo e SQLite local, funcionando offline no dispositivo.

<p align="center">
  <img src="./assets/icon.png" width="160" alt="Logo EduAgenda" />
</p>

## Status

Primeira versao do projeto, preparada para versionamento no GitHub.

## Funcionalidades

- Dashboard com aulas do dia, pendencias e lembretes.
- Agenda semanal e mensal.
- Cadastro e edicao de aulas.
- Grade mensal baseada na rotina semanal.
- Conteudo, atividade, status e observacoes salvos por data.
- Cadastro de turmas com componente curricular e cor.
- Atividades e lembretes com tipos personalizados.
- Configuracao de horarios por periodo.
- Mascara reutilizavel de horario no formato `HH:mm`.
- Calendarios padronizados com domingo na primeira coluna.
- Bottom sheets e dialogs reutilizaveis.
- Banco SQLite local.
- Funcionamento offline.

## Prints

Ainda nao foi incluido print real da interface nesta primeira versao porque este ambiente local nao possui suporte web instalado (`react-native-web`) nem emulador/dispositivo acessivel para capturar a tela com seguranca.

Quando houver uma captura real, salve os arquivos em:

```text
docs/screenshots/
```

E adicione no README, por exemplo:

```md
![Dashboard](./docs/screenshots/dashboard.png)
```

## Stack

- React Native
- Expo
- TypeScript
- SQLite com `expo-sqlite`
- React Navigation

## Como rodar

Instale as dependencias:

```bash
npm install
```

Inicie o Expo:

```bash
npx expo start
```

Abra no dispositivo:

- Instale o Expo Go.
- Escaneie o QR Code exibido no terminal.

## Scripts

```bash
npm run start
npm run android
npm run ios
npm run web
```

Observacao: para usar `npm run web`, pode ser necessario instalar dependencias web do Expo, como `react-native-web`, caso o projeto ainda nao tenha esse suporte configurado.

## Estrutura

```text
edu-agenda/
├── App.tsx
├── app.json
├── assets/
├── src/
│   ├── components/
│   ├── database/
│   ├── navigation/
│   ├── screens/
│   ├── theme/
│   ├── types/
│   └── utils/
├── package.json
└── tsconfig.json
```

## Banco de dados

O banco local e criado automaticamente na inicializacao do aplicativo. As principais tabelas incluem:

- `professional_profile`
- `period_schedule_settings`
- `classes`
- `lessons`
- `lesson_entries`
- `lesson_activity_options`
- `activities`
- `activity_types`
- `reminders`

## Observacoes de desenvolvimento

- A grade de horarios e calculada por uma funcao unica em `src/utils/time.ts`.
- Os campos de horario usam o componente reutilizavel `TimeInput`.
- Os calendarios usam a mesma base de geracao mensal em `getMonthCalendarWeeks`.
- Pop-ups e formularios usam `BottomSheetModal`.
- Confirmacoes de exclusao usam `ConfirmDialog`.
