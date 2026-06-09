export function parseJsonLike(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return JSON.parse(stripTrailingCommas(stripJsonComments(content)));
  }
}

export function updateJsonLikeTopLevelSection(
  content: string,
  key: string,
  value: unknown,
): string {
  const jsonValue = JSON.stringify(value, null, 2);
  const rootStart = findRootObjectStart(content);
  const rootEnd = findMatchingBracket(content, rootStart, '{', '}');
  const existingSection = findTopLevelProperty(content, rootStart, rootEnd, key);

  if (existingSection) {
    const propertyIndent = getLineIndent(content, existingSection.propertyStart);
    const replacementValue = indentMultiline(jsonValue, propertyIndent);
    return content.slice(0, existingSection.valueStart) + replacementValue + content.slice(existingSection.valueEnd);
  }

  const propertyIndent = detectPropertyIndent(content, rootStart, rootEnd);
  const property = `${propertyIndent}${JSON.stringify(key)}: ${indentMultiline(jsonValue, propertyIndent)}`;
  const closingIndent = getLineIndent(content, rootEnd);
  const hasProperties = objectHasProperties(content, rootStart, rootEnd);
  const insertion = hasProperties ? `,\n${property}\n${closingIndent}` : `\n${property}\n${closingIndent}`;

  return content.slice(0, rootEnd) + insertion + content.slice(rootEnd);
}

function stripJsonComments(content: string): string {
  let result = '';
  let inString = false;
  let stringDelimiter = '';

  for (let i = 0; i < content.length; i++) {
    const current = content[i]!;
    const next = content[i + 1];
    const previous = content[i - 1];

    if (inString) {
      result += current;
      if (current === stringDelimiter && !isEscaped(content, i)) {
        inString = false;
        stringDelimiter = '';
      }
      continue;
    }

    if (current === '"' || current === "'") {
      inString = true;
      stringDelimiter = current;
      result += current;
      continue;
    }

    if (current === '/' && next === '/') {
      i += 2;
      while (i < content.length && content[i] !== '\n') {
        i++;
      }
      if (i < content.length) {
        result += '\n';
      }
      continue;
    }

    if (current === '/' && next === '*') {
      i += 2;
      while (i < content.length - 1) {
        if (content[i] === '*' && content[i + 1] === '/') {
          i++;
          break;
        }

        if (content[i] === '\n') {
          result += '\n';
        }
        i++;
      }
      continue;
    }

    result += current;
  }

  return result;
}

function stripTrailingCommas(content: string): string {
  let result = '';
  let inString = false;
  let stringDelimiter = '';

  for (let i = 0; i < content.length; i++) {
    const current = content[i]!;

    if (inString) {
      result += current;
      if (current === stringDelimiter && !isEscaped(content, i)) {
        inString = false;
        stringDelimiter = '';
      }
      continue;
    }

    if (current === '"' || current === "'") {
      inString = true;
      stringDelimiter = current;
      result += current;
      continue;
    }

    if (current === ',') {
      let j = skipWhitespaceAndComments(content, i + 1);
      if (content[j] === '}' || content[j] === ']') {
        continue;
      }
    }

    result += current;
  }

  return result;
}

function findRootObjectStart(content: string): number {
  const start = skipWhitespaceAndComments(content, 0);
  if (content[start] !== '{') {
    throw new Error('Expected a JSON object at the root of the file.');
  }
  return start;
}

function objectHasProperties(content: string, rootStart: number, rootEnd: number): boolean {
  return skipWhitespaceAndComments(content, rootStart + 1) < rootEnd;
}

function detectPropertyIndent(content: string, rootStart: number, rootEnd: number): string {
  const firstToken = skipWhitespaceAndComments(content, rootStart + 1);
  if (firstToken < rootEnd && content[firstToken] === '"') {
    return getLineIndent(content, firstToken);
  }
  return '  ';
}

function findTopLevelProperty(
  content: string,
  rootStart: number,
  rootEnd: number,
  key: string,
): { propertyStart: number; valueStart: number; valueEnd: number } | null {
  let index = skipWhitespaceAndComments(content, rootStart + 1);

  while (index < rootEnd) {
    if (content[index] === '}') {
      break;
    }

    const propertyStart = index;
    if (content[index] !== '"') {
      throw new Error('Expected a quoted property name in JSON object.');
    }

    const keyEnd = scanString(content, index);
    const parsedKey = JSON.parse(content.slice(index, keyEnd)) as string;
    index = skipWhitespaceAndComments(content, keyEnd);

    if (content[index] !== ':') {
      throw new Error('Expected a colon after a JSON property name.');
    }

    const valueStart = skipWhitespaceAndComments(content, index + 1);
    const valueEnd = scanValue(content, valueStart);

    if (parsedKey === key) {
      return { propertyStart, valueStart, valueEnd };
    }

    index = skipWhitespaceAndComments(content, valueEnd);
    if (content[index] === ',') {
      index = skipWhitespaceAndComments(content, index + 1);
      continue;
    }

    if (content[index] === '}') {
      break;
    }
  }

  return null;
}

function scanValue(content: string, index: number): number {
  const current = content[index];

  if (current === '"') {
    return scanString(content, index);
  }

  if (current === '{') {
    return findMatchingBracket(content, index, '{', '}') + 1;
  }

  if (current === '[') {
    return findMatchingBracket(content, index, '[', ']') + 1;
  }

  let cursor = index;
  while (cursor < content.length) {
    const char = content[cursor];
    if (char === ',' || char === '}' || char === ']') {
      return cursor;
    }
    cursor++;
  }

  return cursor;
}

function scanString(content: string, index: number): number {
  const delimiter = content[index];
  let cursor = index + 1;

  while (cursor < content.length) {
    if (content[cursor] === delimiter && !isEscaped(content, cursor)) {
      return cursor + 1;
    }
    cursor++;
  }

  throw new Error('Unterminated string literal.');
}

function findMatchingBracket(content: string, index: number, open: string, close: string): number {
  let depth = 0;
  let inString = false;
  let stringDelimiter = '';

  for (let cursor = index; cursor < content.length; cursor++) {
    const current = content[cursor]!;
    const next = content[cursor + 1];

    if (inString) {
      if (current === stringDelimiter && !isEscaped(content, cursor)) {
        inString = false;
        stringDelimiter = '';
      }
      continue;
    }

    if (current === '"' || current === "'") {
      inString = true;
      stringDelimiter = current;
      continue;
    }

    if (current === '/' && next === '/') {
      cursor += 2;
      while (cursor < content.length && content[cursor] !== '\n') {
        cursor++;
      }
      continue;
    }

    if (current === '/' && next === '*') {
      cursor += 2;
      while (cursor < content.length - 1) {
        if (content[cursor] === '*' && content[cursor + 1] === '/') {
          cursor++;
          break;
        }
        cursor++;
      }
      continue;
    }

    if (current === open) {
      depth++;
      continue;
    }

    if (current === close) {
      depth--;
      if (depth === 0) {
        return cursor;
      }
    }
  }

  throw new Error(`Unterminated ${open}${close} block.`);
}

function skipWhitespaceAndComments(content: string, index: number): number {
  let cursor = index;

  while (cursor < content.length) {
    const current = content[cursor]!;
    const next = content[cursor + 1];

    if (/\s/.test(current)) {
      cursor++;
      continue;
    }

    if (current === '/' && next === '/') {
      cursor += 2;
      while (cursor < content.length && content[cursor] !== '\n') {
        cursor++;
      }
      continue;
    }

    if (current === '/' && next === '*') {
      cursor += 2;
      while (cursor < content.length - 1) {
        if (content[cursor] === '*' && content[cursor + 1] === '/') {
          cursor += 2;
          break;
        }
        cursor++;
      }
      continue;
    }

    break;
  }

  return cursor;
}

function getLineIndent(content: string, index: number): string {
  const lineStart = content.lastIndexOf('\n', index - 1) + 1;
  let cursor = lineStart;
  while (cursor < index && (content[cursor] === ' ' || content[cursor] === '\t')) {
    cursor++;
  }
  return content.slice(lineStart, cursor);
}

function indentMultiline(content: string, indent: string): string {
  const lines = content.split('\n');
  if (lines.length <= 1) {
    return content;
  }

  return lines[0]! + lines.slice(1).map((line) => `\n${indent}${line}`).join('');
}

function isEscaped(content: string, index: number): boolean {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && content[cursor] === '\\'; cursor--) {
    backslashes++;
  }
  return backslashes % 2 === 1;
}
