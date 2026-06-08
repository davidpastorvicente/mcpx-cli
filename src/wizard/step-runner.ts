import { isCancel } from '@clack/prompts';

export const BACK = Symbol('BACK');
export type BackSignal = typeof BACK;

/**
 * Verifica se o resultado de um prompt clack foi cancelado (Ctrl+C / Esc).
 * Retorna BACK se cancelado, senão retorna o valor original.
 */
export function handleCancel<T>(value: T | symbol): T | BackSignal {
  if (isCancel(value)) return BACK;
  return value as T;
}

export type Step<S> = (state: Partial<S>) => Promise<Partial<S> | BackSignal | null>;

/**
 * Executa etapas sequenciais com navegação para trás.
 * Ctrl+C/Esc em qualquer etapa volta ao passo anterior.
 * Na primeira etapa, cancela o wizard.
 */
export async function runSteps<S>(steps: Step<S>[], initialState: Partial<S> = {}): Promise<S | null> {
  const stateHistory: Partial<S>[] = [{ ...initialState }];
  let index = 0;

  while (index < steps.length) {
    const currentState = { ...stateHistory[index]! };
    const result = await steps[index]!(currentState);

    if (result === BACK) {
      if (index === 0) return null;
      index--;
      continue;
    }

    if (result === null) return null;

    const merged = { ...currentState, ...result };
    stateHistory[index + 1] = merged;
    index++;
  }

  return stateHistory[index] as S;
}
