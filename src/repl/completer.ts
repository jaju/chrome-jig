/**
 * REPL tab completion
 */

import { getCommandCompletions } from './commands.js';
import type { ResolvedConfig } from '../config/schema.js';

export function createCompleter(config: ResolvedConfig) {
  const commandCompletions = getCommandCompletions();

  // Script names for .inject completion
  const scriptNames = Object.keys(config.scripts.registry);
  const scriptAliases = Object.values(config.scripts.registry)
    .map((e) => e.alias)
    .filter((a): a is string => !!a);

  return function completer(line: string): [string[], string] {
    // Command completion
    if (line.startsWith('.')) {
      const matches = commandCompletions.filter((c) =>
        c.startsWith(line.toLowerCase())
      );
      return [matches, line];
    }

    // Inject script completion
    if (line.startsWith('.inject ') || line.startsWith('.i ') || line.startsWith('.load ')) {
      const parts = line.split(' ');
      const partial = parts[parts.length - 1] || '';

      const allScripts = [...scriptNames, ...scriptAliases];
      const matches = allScripts.filter((s) =>
        s.toLowerCase().startsWith(partial.toLowerCase())
      );

      return [matches, partial];
    }

    // No completion for JS expressions (could add window properties later)
    return [[], line];
  };
}
