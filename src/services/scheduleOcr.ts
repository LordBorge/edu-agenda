import TextRecognition, {
  TextRecognitionScript,
  type Frame,
  type TextRecognitionResult,
} from '@react-native-ml-kit/text-recognition';

export type OcrSource = {
  uri: string;
  name?: string;
  mimeType?: string;
  type: 'camera' | 'image' | 'document';
};

export type OcrMode = 'local' | 'online';

export type RecognizeScheduleTextOptions = {
  mode?: OcrMode;
};

export type OcrTextBlock = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  source: 'line' | 'element';
};

export type RecognizedScheduleOcr = {
  text: string;
  blocks: OcrTextBlock[];
  mode: OcrMode;
};

export class OcrOfflineUnavailableError extends Error {
  constructor() {
    super('O OCR offline precisa de uma build nativa para funcionar.');
    this.name = 'OcrOfflineUnavailableError';
  }
}

export class OcrPdfUnsupportedError extends Error {
  constructor() {
    super('A leitura direta de PDF ainda nao esta disponivel.');
    this.name = 'OcrPdfUnsupportedError';
  }
}

export class OcrLowConfidenceError extends Error {
  constructor() {
    super('OCR local nao retornou texto suficiente.');
    this.name = 'OcrLowConfidenceError';
  }
}

export class OcrOnlineNotConfiguredError extends Error {
  constructor() {
    super('OCR online ainda nao configurado.');
    this.name = 'OcrOnlineNotConfiguredError';
  }
}

function getOcrEndpoint(): string {
  const maybeProcess = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process;
  return maybeProcess?.env?.EXPO_PUBLIC_EDUAGENDA_OCR_ENDPOINT ?? '';
}

function isPdfSource(source: OcrSource): boolean {
  const mimeType = source.mimeType?.toLowerCase() ?? '';
  const name = source.name?.toLowerCase() ?? '';
  const uri = source.uri.toLowerCase();
  return mimeType.includes('pdf') || name.endsWith('.pdf') || uri.endsWith('.pdf');
}

function extractTextFromNativeResult(result: TextRecognitionResult): string {
  if (result.text?.trim()) return result.text.trim();

  return result.blocks
    .flatMap(block => block.lines.map(line => line.text))
    .join('\n')
    .trim();
}

function blockFromFrame(
  text: string,
  frame: Frame | undefined,
  source: OcrTextBlock['source']
): OcrTextBlock | null {
  const trimmed = text.trim();
  if (!trimmed || !frame) return null;

  const { left, top, width, height } = frame;
  if (![left, top, width, height].every(Number.isFinite)) return null;
  if (width <= 0 || height <= 0) return null;

  return {
    text: trimmed,
    x: left,
    y: top,
    width,
    height,
    source,
  };
}

function extractBlocksFromNativeResult(result: TextRecognitionResult): OcrTextBlock[] {
  const blocks: OcrTextBlock[] = [];

  result.blocks.forEach(block => {
    block.lines.forEach(line => {
      const lineBlock = blockFromFrame(line.text, line.frame, 'line');
      if (lineBlock) blocks.push(lineBlock);

      line.elements.forEach(element => {
        const elementBlock = blockFromFrame(element.text, element.frame, 'element');
        if (elementBlock) blocks.push(elementBlock);
      });
    });
  });

  return blocks;
}

function isNativeModuleUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("doesn't seem to be linked")
    || message.includes('rebuilt the app')
    || message.includes('Expo managed workflow')
    || message.includes('Native module')
    || message.includes('TextRecognition')
  );
}

function extractTextFromOcrResponse(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const data = payload as Record<string, any>;

  if (typeof data.text === 'string') return data.text;
  if (typeof data.fullText === 'string') return data.fullText;
  if (typeof data.full_text === 'string') return data.full_text;
  if (typeof data.fullTextAnnotation?.text === 'string') return data.fullTextAnnotation.text;
  if (Array.isArray(data.responses) && typeof data.responses[0]?.fullTextAnnotation?.text === 'string') {
    return data.responses[0].fullTextAnnotation.text;
  }
  if (Array.isArray(data.parsedResults) && typeof data.parsedResults[0]?.ParsedText === 'string') {
    return data.parsedResults[0].ParsedText;
  }
  if (Array.isArray(data.ParsedResults) && typeof data.ParsedResults[0]?.ParsedText === 'string') {
    return data.ParsedResults[0].ParsedText;
  }

  return '';
}

async function recognizeScheduleLocally(source: OcrSource): Promise<RecognizedScheduleOcr> {
  if (isPdfSource(source)) {
    throw new OcrPdfUnsupportedError();
  }

  try {
    const result = await TextRecognition.recognize(source.uri, TextRecognitionScript.LATIN);
    const text = extractTextFromNativeResult(result);
    const blocks = extractBlocksFromNativeResult(result);

    if (!text) {
      console.log('[EduAgenda OCR] ML Kit retornou texto vazio.', {
        uri: source.uri,
        name: source.name,
        mimeType: source.mimeType,
      });
      throw new OcrLowConfidenceError();
    }

    return { text, blocks, mode: 'local' };
  } catch (error) {
    if (error instanceof OcrLowConfidenceError) throw error;
    console.log('[EduAgenda OCR] Falha ao processar imagem localmente.', {
      uri: source.uri,
      name: source.name,
      mimeType: source.mimeType,
      error,
    });
    if (isNativeModuleUnavailable(error)) throw new OcrOfflineUnavailableError();
    throw new OcrLowConfidenceError();
  }
}

async function recognizeScheduleOnline(source: OcrSource): Promise<RecognizedScheduleOcr> {
  const endpoint = getOcrEndpoint();
  if (!endpoint) {
    throw new OcrOnlineNotConfiguredError();
  }

  const formData = new FormData();
  formData.append('file', {
    uri: source.uri,
    name: source.name ?? 'horario.jpg',
    type: source.mimeType ?? 'image/jpeg',
  } as any);
  formData.append('sourceType', source.type);

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`OCR falhou com status ${response.status}`);
  }

  const payload = await response.json();
  const text = extractTextFromOcrResponse(payload).trim();
  if (!text) {
    throw new OcrLowConfidenceError();
  }

  return { text, blocks: [], mode: 'online' };
}

export async function recognizeScheduleOcrFromSource(
  source: OcrSource,
  options: RecognizeScheduleTextOptions = {}
): Promise<RecognizedScheduleOcr> {
  const mode = options.mode ?? 'local';

  if (mode === 'online') {
    return recognizeScheduleOnline(source);
  }

  return recognizeScheduleLocally(source);
}

export async function recognizeScheduleTextFromSource(
  source: OcrSource,
  options: RecognizeScheduleTextOptions = {}
): Promise<string> {
  const result = await recognizeScheduleOcrFromSource(source, options);
  return result.text;
}
