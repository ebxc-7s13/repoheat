export interface Measurement {
  loc: number;
  complexity: number;
}

/**
 * Language-agnostic complexity based on indentation, as described in
 * "Your Code as a Crime Scene" (Adam Tornhill). Deeply nested code is
 * harder to change, whatever language it is written in.
 */
export function measure(content: string): Measurement {
  const lines = content.split(/\r?\n/);
  const indents: { tabs: number; spaces: number }[] = [];
  let even = 0;
  let twoNotFour = 0;
  for (const line of lines) {
    if (line.trim() === '') continue;
    const lead = /^[\t ]*/.exec(line)![0];
    let tabs = 0;
    let spaces = 0;
    for (const ch of lead) ch === '\t' ? tabs++ : spaces++;
    indents.push({ tabs, spaces });
    if (spaces > 0 && spaces % 2 === 0) {
      even++;
      if (spaces % 4 !== 0) twoNotFour++;
    }
  }
  // Odd counts (JSDoc " * ", alignment) are noise; decide between 2 and 4 from the even ones.
  const unit = even > 0 && twoNotFour / even > 0.1 ? 2 : 4;
  let complexity = 0;
  for (const { tabs, spaces } of indents) complexity += tabs + Math.floor(spaces / unit);
  return { loc: indents.length, complexity };
}

export function isBinary(content: string): boolean {
  return content.slice(0, 8000).includes('\u0000');
}
