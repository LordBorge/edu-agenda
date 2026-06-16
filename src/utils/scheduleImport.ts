import type { Class, Weekday } from '../types';

export type ScheduleImportItemKind = 'class' | 'reserved';

export type ScheduleImportItem = {
  id: string;
  kind: ScheduleImportItemKind;
  weekday: Weekday;
  start_time: string;
  end_time: string;
  className: string;
  grade: string;
  subject: string;
  title: string;
  sourceText: string;
};

export type ScheduleImportPreview = {
  items: ScheduleImportItem[];
  warnings: string[];
};

export type ScheduleOcrBlock = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  source?: 'line' | 'element' | string;
};

export type ScheduleOcrParseInput = {
  text: string;
  blocks?: ScheduleOcrBlock[];
};

type TimeRange = {
  start: string;
  end: string;
};

type NormalizedTime = {
  value: string;
  compact: boolean;
  ambiguous: boolean;
};

const TIME_TOKEN_PATTERN = '(?:\\d{1,2}\\s*[:hH]\\s*\\d{2}|\\d{3,4})';

const WEEKDAY_ALIASES: Array<{ weekday: Weekday; aliases: string[] }> = [
  { weekday: 0, aliases: ['segunda', 'seg', '2a', '2ª', 'segunda-feira'] },
  { weekday: 1, aliases: ['terça', 'terca', 'ter', '3a', '3ª', 'terça-feira', 'terca-feira'] },
  { weekday: 2, aliases: ['quarta', 'qua', '4a', '4ª', 'quarta-feira'] },
  { weekday: 3, aliases: ['quinta', 'qui', '5a', '5ª', 'quinta-feira'] },
  { weekday: 4, aliases: ['sexta', 'sex', '6a', '6ª', 'sexta-feira'] },
];

const SPECIAL_TERMS = [
  'AREA',
  'ÁREA',
  'EOI',
  'PLANEJAMENTO',
  'REUNIAO',
  'REUNIÃO',
  'HTPC',
  'ATPC',
  'ELET',
  'ELETIVA',
  'COORDENACAO',
  'COORDENAÇÃO',
];

const SUBJECT_ALIASES: Record<string, string> = {
  INGLES: 'Inglês',
  INGLÊS: 'Inglês',
  LINGUA: 'Língua Inglesa',
  L_NGUA: 'Língua Inglesa',
  LINGUA_INGLESA: 'Língua Inglesa',
  LINGUA_INGLES: 'Língua Inglesa',
  LINGUA_ING: 'Língua Inglesa',
  PORTUGUES: 'Português',
  PORTUGUÊS: 'Português',
  MATEMATICA: 'Matemática',
  MATEMÁTICA: 'Matemática',
  HISTORIA: 'História',
  HISTÓRIA: 'História',
  HIST: 'História',
  HIST_RO: 'História',
  GEOGRAFIA: 'Geografia',
  GEOG: 'Geografia',
  GEORO: 'Geografia',
  CIENCIAS: 'Ciências',
  CIÊNCIAS: 'Ciências',
  QUIMICA: 'Química',
  QUÍMICA: 'Química',
  QUIM: 'Química',
  QUIN: 'Química',
  FISICA: 'Física',
  FÍSICA: 'Física',
  BIOLOGIA: 'Biologia',
  BIO: 'Biologia',
  ARTE: 'Arte',
  ARTES: 'Artes',
  EDUCACAO_FISICA: 'Educação Física',
  EDUCAÇÃO_FÍSICA: 'Educação Física',
  REDACAO: 'Redação',
  REDAÇÃO: 'Redação',
  POS_MEDIO: 'Pós-Médio',
  PÓS_MEDIO: 'Pós-Médio',
  P_EXP: 'P. Exp.',
  PROTAGONISMO_JUVENIL: 'Protagonismo Juvenil',
  TRILHA_A: 'Trilha A',
  TRILHA_B: 'Trilha B',
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[|]+/g, ' | ')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(value: string): string {
  return normalizeText(value).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function textHasAlias(text: string, alias: string): boolean {
  const normalizedText = normalizeText(text).toLowerCase();
  const normalizedAlias = normalizeText(alias).toLowerCase();

  if (/^\d/.test(normalizedAlias)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedAlias)}($|[^a-z0-9/\\\\])`).test(normalizedText);
  }

  if (normalizedAlias.length <= 3) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedAlias)}(?=$|[^a-z0-9])`).test(normalizedText);
  }

  return normalizedText.includes(normalizedAlias);
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeSubject(value: string): string {
  const trimmed = value.trim();
  const key = normalizeKey(trimmed);
  const compactKey = key.replace(/_/g, '');
  if (
    /L.?NGUA/.test(compactKey)
    && (/INGL|INGI|INGE/.test(compactKey) || compactKey === 'LINGUA' || compactKey === 'LNGUA')
  ) {
    return 'Língua Inglesa';
  }
  return SUBJECT_ALIASES[key] ?? titleCase(trimmed);
}

function normalizeReservedTitle(value: string): string {
  const key = normalizeKey(value);
  if (key === 'AREA') return 'Área';
  if (key === 'EOI') return 'EOI';
  if (key === 'HTPC') return 'HTPC';
  if (key === 'ATPC') return 'ATPC';
  if (key === 'ELET' || key === 'ELETIVA') return 'Eletiva';
  if (key === 'REUNIAO') return 'Reunião';
  if (key === 'COORDENACAO') return 'Coordenação';
  return titleCase(value);
}

function createTimeRangeRegex(): RegExp {
  return new RegExp(`(${TIME_TOKEN_PATTERN})\\s*(?:-|a|as|às|ate|até|→|>|\\s+)\\s*(${TIME_TOKEN_PATTERN})`, 'i');
}

function createLeadingTimeRegex(): RegExp {
  return new RegExp(`^\\s*(${TIME_TOKEN_PATTERN})(?!\\d)`, 'i');
}

function normalizeTimeCandidate(value: string): NormalizedTime | null {
  const raw = value.trim().replace(/\s+/g, '');
  const explicitMatch = raw.match(/^(\d{1,2})[:hH](\d{2})$/);
  const digitMatch = raw.match(/^\d{3,4}$/);
  let hourText = '';
  let minuteText = '';
  let compact = false;

  if (explicitMatch) {
    hourText = explicitMatch[1];
    minuteText = explicitMatch[2];
  } else if (digitMatch) {
    compact = true;
    hourText = raw.length === 3 ? raw.slice(0, 1) : raw.slice(0, 2);
    minuteText = raw.length === 3 ? raw.slice(1) : raw.slice(2);
  } else {
    return null;
  }

  let hour = Number(hourText);
  const minute = Number(minuteText);
  let ambiguous = false;

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) return null;

  // Horários escolares não acontecem de madrugada; "1:02"/"102" costuma ser OCR de "11:02".
  if (hour === 1 && !hourText.startsWith('0')) {
    hour = 11;
    ambiguous = true;
  }

  if (hour < 5 || hour > 23) return null;

  return {
    value: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    compact,
    ambiguous,
  };
}

function parseTimeRange(value: string): TimeRange | null {
  const match = value.match(createTimeRangeRegex());
  if (!match) return null;

  const start = normalizeTimeCandidate(match[1]);
  const end = normalizeTimeCandidate(match[2]);
  if (!start || !end) return null;

  return {
    start: start.value,
    end: end.value,
  };
}

function parseSingleStartTime(value: string): string | null {
  const match = value.match(createLeadingTimeRegex());
  if (!match) return null;

  return normalizeTimeCandidate(match[1])?.value ?? null;
}

function stripTimeRange(value: string): string {
  return value.replace(createTimeRangeRegex(), '').trim();
}

function stripLeadingStartTime(value: string): string {
  return value.replace(createLeadingTimeRegex(), '').trim();
}

function stripWeekdayWords(value: string): string {
  return value
    .replace(/(^|[^a-z0-9])(?:segunda-feira|segunda|terça-feira|terca-feira|terça|terca|quarta-feira|quarta|quinta-feira|quinta|sexta-feira|sexta|seg|ter|qua|qui|sex)(?=$|[^a-z0-9])/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectTimeNormalizationWarnings(lines: string[]): string[] {
  let normalizedCompact = false;
  let correctedAmbiguous = false;

  lines.forEach(line => {
    const candidates: string[] = [];
    const leadingMatch = line.match(createLeadingTimeRegex());
    const rangeMatch = line.match(createTimeRangeRegex());
    if (leadingMatch) candidates.push(leadingMatch[1]);
    if (rangeMatch) candidates.push(rangeMatch[1], rangeMatch[2]);

    candidates.forEach(candidate => {
      const normalized = normalizeTimeCandidate(candidate);
      if (!normalized) return;
      normalizedCompact = normalizedCompact || normalized.compact;
      correctedAmbiguous = correctedAmbiguous || normalized.ambiguous;
    });
  });

  const warnings: string[] = [];
  if (normalizedCompact) {
    warnings.push('Alguns horários vieram sem dois-pontos e foram normalizados. Revise a prévia antes de salvar.');
  }
  if (correctedAmbiguous) {
    warnings.push('Alguns horários parecem ter sido corrigidos automaticamente pelo OCR. Revise a prévia antes de salvar.');
  }
  return warnings;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [hour, minute] = time.split(':').map(Number);
  const total = hour * 60 + minute + minutes;
  const nextHour = Math.floor(total / 60);
  const nextMinute = total % 60;
  return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`;
}

function minutesFromTime(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function inferEndTime(start: string, nextStart?: string): string {
  if (!nextStart) return addMinutesToTime(start, 48);

  const gap = minutesFromTime(nextStart) - minutesFromTime(start);
  return gap > 0 && gap <= 90 ? nextStart : addMinutesToTime(start, 48);
}

function getWeekdayFromToken(value: string): Weekday | null {
  const found = WEEKDAY_ALIASES.find(day => day.aliases.some(alias => textHasAlias(value, alias)));
  return found?.weekday ?? null;
}

function getStrictWeekdayFromLine(value: string): Weekday | null {
  const normalized = normalizeText(value).toLowerCase();
  const found = WEEKDAY_ALIASES.find(day => (
    day.aliases.some(alias => {
      const normalizedAlias = normalizeText(alias).toLowerCase();
      return !/^\d/.test(normalizedAlias) && normalized === normalizedAlias;
    })
  ));
  return found?.weekday ?? null;
}

function countWeekdaysInLine(line: string): number {
  return WEEKDAY_ALIASES.filter(day => (
    day.aliases.some(alias => !/^\d/.test(normalizeText(alias)) && textHasAlias(line, alias))
  )).length;
}

function isWeekdayHeaderLine(line: string): boolean {
  return countWeekdaysInLine(line) >= 2;
}

function getHeaderSections(lines: string[]): Array<{
  headerIndex: number;
  headerWeekdays: Array<{ index: number; weekday: Weekday }>;
  rows: string[];
}> {
  const headerIndices = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => isWeekdayHeaderLine(line))
    .map(({ index }) => index);

  return headerIndices
    .map((headerIndex, sectionIndex) => {
      const headerLine = lines[headerIndex];
      const headerCells = splitCells(headerLine);
      let headerWeekdays = headerCells
        .map((cell, index) => ({ index, weekday: getWeekdayFromToken(cell) }))
        .filter((cell): cell is { index: number; weekday: Weekday } => cell.weekday !== null);

      if (headerWeekdays.length < 2) {
        headerWeekdays = WEEKDAY_ALIASES
          .filter(day => day.aliases.some(alias => textHasAlias(headerLine, alias)))
          .map((day, index) => ({ index, weekday: day.weekday }));
      }

      const nextHeaderIndex = headerIndices[sectionIndex + 1] ?? lines.length;
      return {
        headerIndex,
        headerWeekdays,
        rows: lines.slice(headerIndex + 1, nextHeaderIndex),
      };
    })
    .filter(section => section.headerWeekdays.length >= 2);
}

function splitCells(line: string): string[] {
  const cleaned = line
    .replace(/\t/g, ' | ')
    .replace(/\s{2,}/g, ' | ')
    .replace(/;/g, ' | ')
    .replace(/\s*\|\s*/g, '|');

  return cleaned
    .replace(/^\|+|\|+$/g, '')
    .split('|')
    .map(cell => cell.trim());
}

function normalizeGrade(rawGrade: string): { name: string; grade: string } {
  const normalized = rawGrade.trim().toUpperCase().replace(/\s+/g, '');
  const match = normalized.match(/^(\d{1,2})[º°ªO?]?\s*([A-Z])?$/);
  if (!match) {
    const fallback = titleCase(rawGrade.replace(/[º°]/g, 'º '));
    return { name: fallback, grade: fallback };
  }

  const year = Number(match[1]);
  const suffix = match[2] ? ` ${match[2]}` : '';
  const name = `${year}º Ano${suffix}`;
  return { name, grade: `${year}º Ano` };
}

function normalizeImportedClass(rawGrade: string): { name: string; grade: string } {
  const normalized = normalizeText(rawGrade)
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[O?](?=[A-Z]?$)/, '');
  const match = normalized.match(/^(\d{1,2})(?:[\u00BA\u00B0\u00AA])?([A-Z])?$/);
  if (!match) return normalizeGrade(rawGrade);

  const className = `${Number(match[1])}\u00BA${match[2] ?? ''}`;
  return { name: className, grade: className };
}

function parseCell(cell: string): Omit<ScheduleImportItem, 'id' | 'weekday' | 'start_time' | 'end_time'> | null {
  const trimmed = cell
    .replace(/^[•\-]+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!trimmed || isBlankCellToken(trimmed)) return null;

  const specialTerm = SPECIAL_TERMS.find(term => normalizeKey(trimmed).includes(normalizeKey(term)));
  if (specialTerm) {
    return {
      kind: 'reserved',
      className: '',
      grade: '',
      subject: '',
      title: normalizeReservedTitle(specialTerm),
      sourceText: cell,
    };
  }

  const pieces = trimmed.split(/[\/\\|-]+/).map(piece => piece.trim()).filter(Boolean);
  let gradePiece = pieces[0] ?? '';
  let subjectPiece = pieces.slice(1).join(' ') || pieces[1] || '';

  if (!subjectPiece) {
    const missingSeparatorMatch = trimmed.match(/^(\d{1,2}\s*[º°ªO?]?\s*[A-Za-z])\s*(.+)$/i);
    if (missingSeparatorMatch) {
      gradePiece = missingSeparatorMatch[1];
      subjectPiece = missingSeparatorMatch[2];
    }
  }

  const broadClassMatch = gradePiece.match(/\d{1,2}\s*(?:[\u00BA\u00B0\u00AA]|[^\w\s])?\s*[A-Za-z]?/);
  const classMatch = gradePiece.match(/\d{1,2}\s*[º°ªO?]?\s*[A-Za-z]?/);

  const selectedClassMatch = broadClassMatch ?? classMatch;
  if (!selectedClassMatch || !subjectPiece) return null;

  const gradeInfo = normalizeImportedClass(selectedClassMatch[0]);
  return {
    kind: 'class',
    className: gradeInfo.name,
    grade: gradeInfo.grade,
    subject: normalizeSubject(subjectPiece),
    title: '',
    sourceText: cell,
  };
}

function mergeConsecutiveItems(items: ScheduleImportItem[]): ScheduleImportItem[] {
  const sorted = [...items].sort((a, b) => (
    a.weekday - b.weekday
    || a.start_time.localeCompare(b.start_time)
    || a.end_time.localeCompare(b.end_time)
  ));
  const merged: ScheduleImportItem[] = [];

  for (const item of sorted) {
    const last = merged[merged.length - 1];
    const sameBlock = last
      && last.weekday === item.weekday
      && last.kind === item.kind
      && last.end_time === item.start_time
      && last.className === item.className
      && last.subject === item.subject
      && last.title === item.title;

    if (sameBlock) {
      last.end_time = item.end_time;
      last.sourceText = `${last.sourceText} / ${item.sourceText}`;
    } else {
      merged.push({ ...item });
    }
  }

  return merged;
}

function parseMatrixRows(lines: string[]): ScheduleImportItem[] {
  const sections = getHeaderSections(lines);
  const items: ScheduleImportItem[] = [];

  sections.forEach(section => {
    section.rows.forEach((line, rowIndex) => {
      const range = parseTimeRange(line);
      if (!range) return;

      const rowWithoutTime = stripTimeRange(line);
      const cells = splitCells(rowWithoutTime);

      section.headerWeekdays.forEach((header, weekdayIndex) => {
        const parsed = parseCell(cells[weekdayIndex] ?? '');
        if (!parsed) return;

        items.push({
          ...parsed,
          id: `ocr-${section.headerIndex}-${rowIndex}-${header.weekday}-${range.start}-${weekdayIndex}`,
          weekday: header.weekday,
          start_time: range.start,
          end_time: range.end,
        });
      });
    });
  });

  return items;
}

function parseSingleStartMatrixRows(lines: string[]): ScheduleImportItem[] {
  const sections = getHeaderSections(lines);
  const items: ScheduleImportItem[] = [];

  sections.forEach(section => {
    const rows = section.rows
      .map((line, index) => ({ line, index, start: parseSingleStartTime(line) }))
      .filter((row): row is { line: string; index: number; start: string } => row.start !== null);

    rows.forEach((row, rowIndex) => {
      if (parseTimeRange(row.line)) return;

      const end = inferEndTime(row.start, rows[rowIndex + 1]?.start);
      const rowWithoutTime = stripLeadingStartTime(row.line);
      const cells = splitCells(rowWithoutTime);
      if (cells.length < section.headerWeekdays.length) return;

      section.headerWeekdays.forEach((header, weekdayIndex) => {
        const expectedCells = section.headerWeekdays.length;
        const candidates = cells.length >= expectedCells
          ? [cells[weekdayIndex]]
          : [
            cells[weekdayIndex],
            cells[header.index],
            cells[weekdayIndex + 1],
          ];

        const parsed = candidates
          .map(parseCell)
          .find((candidate): candidate is Omit<ScheduleImportItem, 'id' | 'weekday' | 'start_time' | 'end_time'> => candidate !== null);

        if (!parsed) return;

        items.push({
          ...parsed,
          id: `single-${section.headerIndex}-${row.index}-${header.weekday}-${row.start}-${weekdayIndex}`,
          weekday: header.weekday,
          start_time: row.start,
          end_time: end,
        });
      });
    });
  });

  return items;
}

function isBlankCellToken(value: string): boolean {
  const compact = normalizeText(value).replace(/\s+/g, '');
  if (!compact) return true;
  return compact.length >= 3 && /^[.\-_]+$/.test(compact);
}

function isNewCellToken(value: string): boolean {
  const key = normalizeKey(value);
  return (
    /\d{1,2}\s*[^\s\/\\-]?\s*[A-Za-z]?\s*[\/\\-]/.test(value)
    || /^\d{1,2}\s*[º°ªO?]?\s*[A-Za-z]?$/i.test(normalizeText(value))
    || SPECIAL_TERMS.some(term => key.includes(normalizeKey(term)))
    || isBlankCellToken(value)
  );
}

function splitWhitespaceTableCells(value: string, expectedCells: number): string[] {
  const tokens = value.split(/\s+/).map(token => token.trim()).filter(Boolean);
  const cells: string[] = [];

  tokens.forEach(token => {
    if (isBlankCellToken(token)) {
      if (cells.length < expectedCells) cells.push('');
      return;
    }

    if (cells.length === 0 || (isNewCellToken(token) && cells.length < expectedCells)) {
      cells.push(token);
      return;
    }

    cells[cells.length - 1] = `${cells[cells.length - 1]} ${token}`.trim();
  });

  return cells;
}

function parseWhitespaceMatrixRows(lines: string[]): ScheduleImportItem[] {
  const sections = getHeaderSections(lines);
  const items: ScheduleImportItem[] = [];

  sections.forEach(section => {
    const headerWeekdays = section.headerWeekdays
      .map(header => header.weekday)
      .filter((weekday, index, weekdays) => weekdays.indexOf(weekday) === index);

    const rows = section.rows
      .map((line, index) => ({ line, index, start: parseSingleStartTime(line) }))
      .filter((row): row is { line: string; index: number; start: string } => row.start !== null);

    rows.forEach((row, rowIndex) => {
      if (parseTimeRange(row.line)) return;

      const end = inferEndTime(row.start, rows[rowIndex + 1]?.start);
      const rowWithoutTime = stripLeadingStartTime(row.line);
      if (rowWithoutTime.includes('|')) return;
      const cells = splitWhitespaceTableCells(rowWithoutTime, headerWeekdays.length);

      headerWeekdays.forEach((weekday, weekdayIndex) => {
        const parsed = parseCell(cells[weekdayIndex] ?? '');
        if (!parsed) return;

        items.push({
          ...parsed,
          id: `space-${section.headerIndex}-${row.index}-${weekday}-${row.start}-${weekdayIndex}`,
          weekday,
          start_time: row.start,
          end_time: end,
        });
      });
    });
  });

  return items;
}

type NormalizedOcrBlock = ScheduleOcrBlock & {
  text: string;
  key: string;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
};

type OcrColumn = {
  weekday: Weekday;
  centerX: number;
  left: number;
  right: number;
};

type OcrHeaderRow = {
  y: number;
  bottom: number;
  columns: OcrColumn[];
  leftBoundary: number;
  rightBoundary: number;
  avgColumnGap: number;
};

type OcrTimeRow = {
  start: string;
  end: string;
  y: number;
  top: number;
  bottom: number;
};

function normalizeOcrBlock(block: ScheduleOcrBlock): NormalizedOcrBlock | null {
  const text = block.text.trim();
  const values = [block.x, block.y, block.width, block.height];
  if (!text || !values.every(Number.isFinite)) return null;
  if (block.width <= 0 || block.height <= 0) return null;

  return {
    ...block,
    text,
    key: normalizeKey(text),
    right: block.x + block.width,
    bottom: block.y + block.height,
    centerX: block.x + block.width / 2,
    centerY: block.y + block.height / 2,
  };
}

function median(values: number[], fallback: number): number {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return fallback;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function groupBlocksByY(blocks: NormalizedOcrBlock[], tolerance: number): NormalizedOcrBlock[][] {
  const groups: NormalizedOcrBlock[][] = [];

  blocks
    .slice()
    .sort((a, b) => a.centerY - b.centerY)
    .forEach(block => {
      const group = groups.find(current => Math.abs(median(current.map(item => item.centerY), block.centerY) - block.centerY) <= tolerance);
      if (group) {
        group.push(block);
      } else {
        groups.push([block]);
      }
    });

  return groups;
}

function getWeekdayFromHeaderToken(value: string): Weekday | null {
  const key = normalizeKey(value);
  if (key === 'LER') return 1; // OCR sometimes reads "Ter" as "ler".

  const found = WEEKDAY_ALIASES.find(day => (
    day.aliases.some(alias => !/^\d/.test(normalizeText(alias)) && textHasAlias(value, alias))
  ));
  return found?.weekday ?? null;
}

function getWeekdaysFromHeaderText(value: string): Weekday[] {
  return WEEKDAY_ALIASES
    .filter(day => day.aliases.some(alias => !/^\d/.test(normalizeText(alias)) && textHasAlias(value, alias)))
    .map(day => day.weekday);
}

function buildHeaderRowFromColumns(columns: Array<{ weekday: Weekday; centerX: number }>, y: number, bottom: number): OcrHeaderRow | null {
  const uniqueColumns = new Map<Weekday, { weekday: Weekday; centerX: number }>();
  columns.forEach(column => {
    const existing = uniqueColumns.get(column.weekday);
    if (!existing) uniqueColumns.set(column.weekday, column);
  });

  const sorted = Array.from(uniqueColumns.values()).sort((a, b) => a.centerX - b.centerX);
  if (sorted.length < 2) return null;

  const gaps = sorted.slice(1).map((column, index) => column.centerX - sorted[index].centerX);
  const avgColumnGap = Math.max(40, median(gaps, gaps[0] ?? 120));

  const finalColumns = sorted.map((column, index): OcrColumn => {
    const previous = sorted[index - 1];
    const next = sorted[index + 1];
    return {
      weekday: column.weekday,
      centerX: column.centerX,
      left: previous ? (previous.centerX + column.centerX) / 2 : column.centerX - avgColumnGap / 2,
      right: next ? (column.centerX + next.centerX) / 2 : column.centerX + avgColumnGap / 2,
    };
  });

  return {
    y,
    bottom,
    columns: finalColumns,
    leftBoundary: finalColumns[0].left,
    rightBoundary: finalColumns[finalColumns.length - 1].right,
    avgColumnGap,
  };
}

function detectHeaderRows(blocks: NormalizedOcrBlock[]): OcrHeaderRow[] {
  const medianHeight = median(blocks.map(block => block.height), 12);
  const headerTokenBlocks = blocks.filter(block => getWeekdayFromHeaderToken(block.text) !== null);
  const groupedHeaders = groupBlocksByY(headerTokenBlocks, Math.max(8, medianHeight * 1.6));
  const rows: OcrHeaderRow[] = [];

  groupedHeaders.forEach(group => {
    const columns = group
      .map(block => {
        const weekday = getWeekdayFromHeaderToken(block.text);
        return weekday === null ? null : { weekday, centerX: block.centerX };
      })
      .filter((column): column is { weekday: Weekday; centerX: number } => column !== null);

    const row = buildHeaderRowFromColumns(
      columns,
      median(group.map(block => block.y), group[0].y),
      Math.max(...group.map(block => block.bottom))
    );
    if (row) rows.push(row);
  });

  blocks
    .filter(block => block.source === 'line' && countWeekdaysInLine(block.text) >= 2)
    .forEach(block => {
      const weekdays = getWeekdaysFromHeaderText(block.text);
      const uniqueWeekdays = weekdays.filter((weekday, index) => weekdays.indexOf(weekday) === index);
      if (uniqueWeekdays.length < 2) return;

      const hasHourHeader = /\bhor\b/i.test(normalizeText(block.text));
      const virtualColumnCount = uniqueWeekdays.length + (hasHourHeader ? 1 : 0);
      const virtualWidth = block.width / virtualColumnCount;
      const startX = block.x + (hasHourHeader ? virtualWidth : 0);
      const columns = uniqueWeekdays.map((weekday, index) => ({
        weekday,
        centerX: startX + virtualWidth * index + virtualWidth / 2,
      }));
      const row = buildHeaderRowFromColumns(columns, block.y, block.bottom);
      if (row) rows.push(row);
    });

  return rows
    .sort((a, b) => a.y - b.y)
    .reduce<OcrHeaderRow[]>((acc, row) => {
      const existingIndex = acc.findIndex(item => Math.abs(item.y - row.y) <= Math.max(10, medianHeight));
      if (existingIndex < 0) {
        acc.push(row);
      } else if (row.columns.length > acc[existingIndex].columns.length) {
        acc[existingIndex] = row;
      }
      return acc;
    }, []);
}

function detectTimeRows(blocks: NormalizedOcrBlock[], header: OcrHeaderRow, nextHeaderY: number): OcrTimeRow[] {
  const sectionBlocks = blocks.filter(block => (
    block.centerY > header.bottom
    && block.centerY < nextHeaderY
  ));
  let candidates = sectionBlocks.filter(block => (
    parseSingleStartTime(block.text)
    && block.centerX < header.leftBoundary
  ));

  const elementCandidates = candidates.filter(block => block.source === 'element');
  if (elementCandidates.length >= 3) candidates = elementCandidates;

  if (candidates.length < 2) {
    candidates = sectionBlocks.filter(block => parseSingleStartTime(block.text));
  }

  const grouped: Array<{ start: string; y: number; height: number }> = [];
  candidates
    .slice()
    .sort((a, b) => a.centerY - b.centerY || a.centerX - b.centerX)
    .forEach(block => {
      const start = parseSingleStartTime(block.text);
      if (!start) return;

      const existing = grouped.find(row => row.start === start && Math.abs(row.y - block.centerY) <= Math.max(8, block.height));
      if (existing) {
        existing.y = Math.min(existing.y, block.centerY);
        existing.height = Math.max(existing.height, block.height);
      } else {
        grouped.push({ start, y: block.centerY, height: block.height });
      }
    });

  const sorted = grouped.sort((a, b) => a.y - b.y);
  return sorted.map((row, index): OcrTimeRow => {
    const previous = sorted[index - 1];
    const next = sorted[index + 1];
    return {
      start: row.start,
      end: inferEndTime(row.start, next?.start),
      y: row.y,
      top: previous ? (previous.y + row.y) / 2 : header.bottom,
      bottom: next ? (row.y + next.y) / 2 : row.y + Math.max(28, row.height * 2.2),
    };
  });
}

function parseCoordinateTableBlocks(blocks: ScheduleOcrBlock[] | undefined): ScheduleImportItem[] {
  const normalizedBlocks = (blocks ?? [])
    .map(normalizeOcrBlock)
    .filter((block): block is NormalizedOcrBlock => block !== null);

  if (normalizedBlocks.length < 8) return [];

  const headers = detectHeaderRows(normalizedBlocks);
  if (headers.length === 0) return [];

  const items: ScheduleImportItem[] = [];

  headers.forEach((header, sectionIndex) => {
    const nextHeaderY = headers[sectionIndex + 1]?.y ?? Number.POSITIVE_INFINITY;
    const timeRows = detectTimeRows(normalizedBlocks, header, nextHeaderY);
    if (timeRows.length < 2) return;

    const sectionBlocks = normalizedBlocks.filter(block => (
      block.centerY > header.bottom
      && block.centerY < nextHeaderY
      && block.centerX >= header.leftBoundary
      && block.centerX <= header.rightBoundary
    ));
    const hasElementBlocks = sectionBlocks.some(block => block.source === 'element');
    const cellBlocks = sectionBlocks.filter(block => {
      if (hasElementBlocks && block.source !== 'element') return false;
      if (!hasElementBlocks && block.width > header.avgColumnGap * 1.35) return false;
      if (parseSingleStartTime(block.text)) return false;
      if (getWeekdayFromHeaderToken(block.text) !== null) return false;
      if (/HORARIO|PAGINA|WWW|COM\.?BR/i.test(normalizeText(block.text))) return false;
      return true;
    });

    const groups = new Map<string, {
      weekday: Weekday;
      row: OcrTimeRow;
      blocks: NormalizedOcrBlock[];
    }>();

    cellBlocks.forEach(block => {
      const column = header.columns.find(item => block.centerX >= item.left && block.centerX < item.right);
      const row = timeRows.find(item => block.centerY >= item.top && block.centerY < item.bottom);
      if (!column || !row) return;

      const key = `${sectionIndex}-${row.start}-${column.weekday}`;
      const current = groups.get(key);
      if (current) {
        current.blocks.push(block);
      } else {
        groups.set(key, { weekday: column.weekday, row, blocks: [block] });
      }
    });

    groups.forEach((group, key) => {
      const cellText = group.blocks
        .slice()
        .sort((a, b) => (
          Math.abs(a.centerY - b.centerY) > Math.max(6, median([a.height, b.height], 10) * 0.8)
            ? a.centerY - b.centerY
            : a.centerX - b.centerX
        ))
        .map(block => block.text)
        .join(' ')
        .replace(/\s+([\/\\|-])\s+/g, '$1')
        .trim();
      const parsed = parseCell(cellText);
      if (!parsed) return;

      items.push({
        ...parsed,
        id: `table-${key}`,
        weekday: group.weekday,
        start_time: group.row.start,
        end_time: group.row.end,
      });
    });
  });

  return items;
}

function parseLineItems(lines: string[]): ScheduleImportItem[] {
  const items: ScheduleImportItem[] = [];

  lines.forEach((line, index) => {
    const range = parseTimeRange(line);
    const weekday = getWeekdayFromToken(line);
    if (!range || weekday === null) return;

    const withoutRange = line
      .replace(createTimeRangeRegex(), '')
      .trim();
    const withoutWeekday = stripWeekdayWords(withoutRange);

    const parsed = parseCell(withoutWeekday);
    if (!parsed) return;

    items.push({
      ...parsed,
      id: `line-${index}-${weekday}-${range.start}`,
      weekday,
      start_time: range.start,
      end_time: range.end,
    });
  });

  return items;
}

function getDetectedWeekdays(lines: string[]): Weekday[] {
  const weekdays = new Set<Weekday>();
  lines.forEach(line => {
    const weekday = getWeekdayFromToken(line);
    if (weekday !== null) weekdays.add(weekday);
  });
  return Array.from(weekdays);
}

function parseSingleDetectedDayRows(lines: string[]): ScheduleImportItem[] {
  const detectedWeekdays = getDetectedWeekdays(lines);
  if (detectedWeekdays.length !== 1 || isWeekdayHeaderLine(lines.join(' '))) return [];

  const weekday = detectedWeekdays[0];
  const rows = lines
    .map((line, index) => ({ line, index, start: parseSingleStartTime(line) }))
    .filter((row): row is { line: string; index: number; start: string } => row.start !== null);

  return rows
    .map((row, rowIndex): ScheduleImportItem | null => {
      const end = inferEndTime(row.start, rows[rowIndex + 1]?.start);
      const withoutTime = stripLeadingStartTime(row.line);
      const withoutWeekday = stripWeekdayWords(withoutTime);
      const candidates = [withoutWeekday, ...splitCells(withoutWeekday)].filter(Boolean);
      const parsed = candidates
        .map(parseCell)
        .find((candidate): candidate is Omit<ScheduleImportItem, 'id' | 'weekday' | 'start_time' | 'end_time'> => candidate !== null);

      if (!parsed) return null;

      return {
        ...parsed,
        id: `single-day-${row.index}-${weekday}-${row.start}`,
        weekday,
        start_time: row.start,
        end_time: end,
      };
    })
    .filter((item): item is ScheduleImportItem => item !== null);
}

function isTimeOnlyLine(line: string): boolean {
  const start = parseSingleStartTime(line);
  if (!start) return false;
  return normalizeText(line).replace(/\s+/g, '') === start;
}

function parseColumnarDaySections(lines: string[]): ScheduleImportItem[] {
  const firstDayIndex = lines.findIndex(line => getStrictWeekdayFromLine(line) !== null);
  if (firstDayIndex < 0) return [];

  const times = lines
    .slice(0, firstDayIndex)
    .map(line => parseSingleStartTime(line))
    .filter((time): time is string => time !== null);

  if (times.length < 2) return [];

  const items: ScheduleImportItem[] = [];
  const dayIndexes = lines
    .map((line, index) => ({ index, weekday: getStrictWeekdayFromLine(line) }))
    .filter((entry): entry is { index: number; weekday: Weekday } => entry.weekday !== null);

  dayIndexes.forEach((dayEntry, dayIndex) => {
    const nextDayIndex = dayIndexes[dayIndex + 1]?.index ?? lines.length;
    const entries = lines
      .slice(dayEntry.index + 1, nextDayIndex)
      .filter(line => !isTimeOnlyLine(line))
      .map(line => ({ line, parsed: parseCell(line) }))
      .filter((entry): entry is { line: string; parsed: Omit<ScheduleImportItem, 'id' | 'weekday' | 'start_time' | 'end_time'> } => entry.parsed !== null);

    entries.forEach((entry, entryIndex) => {
      const start = times[entryIndex];
      if (!start) return;

      items.push({
        ...entry.parsed,
        id: `column-${dayEntry.index}-${entryIndex}-${dayEntry.weekday}-${start}`,
        weekday: dayEntry.weekday,
        start_time: start,
        end_time: inferEndTime(start, times[entryIndex + 1]),
      });
    });
  });

  return items;
}

export function parseScheduleOcrText(text: string): ScheduleImportPreview {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const items = mergeConsecutiveItems([
    ...parseMatrixRows(lines),
    ...parseSingleStartMatrixRows(lines),
    ...parseWhitespaceMatrixRows(lines),
    ...parseLineItems(lines),
    ...parseSingleDetectedDayRows(lines),
    ...parseColumnarDaySections(lines),
  ]);

  const uniqueItems = new Map<string, ScheduleImportItem>();
  items.forEach(item => {
    uniqueItems.set(`${item.kind}-${item.weekday}-${item.start_time}-${item.end_time}-${item.className}-${item.subject}-${item.title}`, item);
  });

  const warnings: string[] = [];
  warnings.push(...collectTimeNormalizationWarnings(lines));
  if (lines.length > 0 && uniqueItems.size === 0) {
    warnings.push('Não foi possível reconhecer o horário com clareza. Tente uma imagem mais nítida ou edite o texto manualmente.');
  }
  if (lines.length > 0 && uniqueItems.size > 0 && uniqueItems.size < Math.max(2, Math.floor(lines.length / 3))) {
    warnings.push('Alguns horários não puderam ser identificados. Revise antes de salvar.');
  }

  return {
    items: Array.from(uniqueItems.values()),
    warnings,
  };
}

function dedupeScheduleItems(items: ScheduleImportItem[]): ScheduleImportItem[] {
  const uniqueItems = new Map<string, ScheduleImportItem>();
  items.forEach(item => {
    const key = item.kind === 'class'
      ? `${item.kind}-${item.weekday}-${item.start_time}-${item.end_time}-${item.className}`
      : `${item.kind}-${item.weekday}-${item.start_time}-${item.end_time}-${item.title}`;
    const current = uniqueItems.get(key);
    if (!current || getImportItemQualityScore(item) > getImportItemQualityScore(current)) {
      uniqueItems.set(key, item);
    }
  });
  return Array.from(uniqueItems.values());
}

function getImportItemQualityScore(item: ScheduleImportItem): number {
  if (item.kind === 'reserved') return item.title.length;

  const subjectKey = normalizeKey(item.subject);
  let score = item.className.length + item.subject.length;
  if (subjectKey === 'LINGUA_INGLESA') score += 50;
  if (subjectKey === 'QUIMICA') score += 25;
  if (item.sourceText.includes('/') || item.sourceText.includes('\\')) score += 5;
  return score;
}

function getSameScheduleContentKey(item: ScheduleImportItem): string {
  return item.kind === 'class'
    ? `${item.kind}-${item.weekday}-${item.className}-${item.subject}`
    : `${item.kind}-${item.weekday}-${item.title}`;
}

function mergeTableAndTextItems(tableItems: ScheduleImportItem[], textItems: ScheduleImportItem[]): ScheduleImportItem[] {
  const tableContentKeys = new Set(tableItems.map(getSameScheduleContentKey));
  const missingFromTable = textItems.filter(item => !tableContentKeys.has(getSameScheduleContentKey(item)));
  return [...tableItems, ...missingFromTable];
}

export function parseScheduleTableFromOcr(input: ScheduleOcrParseInput | string): ScheduleImportPreview {
  const text = typeof input === 'string' ? input : input.text;
  const blocks = typeof input === 'string' ? [] : input.blocks;
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const textPreview = parseScheduleOcrText(text);
  const tableItems = mergeConsecutiveItems(parseCoordinateTableBlocks(blocks));
  const tableHasStructure = tableItems.length > 0;
  const items = dedupeScheduleItems(tableHasStructure ? mergeTableAndTextItems(tableItems, textPreview.items) : textPreview.items);
  const warnings: string[] = [];
  warnings.push(...collectTimeNormalizationWarnings(lines));

  if (lines.length > 0 && items.length === 0) {
    warnings.push('O texto foi reconhecido, mas a estrutura da tabela precisa de revisão manual.');
  }

  if ((blocks?.length ?? 0) > 0 && !tableHasStructure && textPreview.items.length > 0) {
    warnings.push('O texto foi reconhecido, mas a estrutura da tabela precisa de revisão manual.');
  }

  if (tableHasStructure && items.length < Math.max(2, Math.floor(lines.length / 4))) {
    warnings.push('Alguns horários podem não ter sido identificados pela tabela. Revise antes de salvar.');
  }

  if (!tableHasStructure) {
    warnings.push(...textPreview.warnings);
  }

  return { items, warnings: dedupeWarnings(warnings) };
}

function dedupeWarnings(warnings: string[]): string[] {
  return Array.from(new Set(warnings));
}

export function summarizeScheduleImport(items: ScheduleImportItem[]) {
  const classNames = new Set<string>();
  const subjects = new Set<string>();
  let reservedCount = 0;

  items.forEach(item => {
    if (item.kind === 'class') {
      classNames.add(item.className);
      subjects.add(item.subject);
    } else {
      reservedCount++;
    }
  });

  return {
    classes: Array.from(classNames).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    subjects: Array.from(subjects).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    lessons: items.filter(item => item.kind === 'class').length,
    reserved: reservedCount,
  };
}

export function findMatchingClass(classes: Class[], item: ScheduleImportItem): Class | undefined {
  return classes.find(classItem => (
    classItem.name.trim().toLowerCase() === item.className.trim().toLowerCase()
    && classItem.subject.trim().toLowerCase() === item.subject.trim().toLowerCase()
  ));
}
