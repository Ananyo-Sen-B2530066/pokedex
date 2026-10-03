import * as fs from 'fs';
import * as path from 'path';

// Resolves project-relative files (data/, public/) across the different ways this
// code is loaded:
//  - Local server (`npm start`): process.cwd() is the project root.
//  - Netlify function bundle: esbuild inlines src/ into the function file, and
//    data files are shipped inside the function archive via `[functions]
//    included_files` in netlify.toml. Their location depends on the bundle
//    layout, so we probe a handful of candidate bases and take the first hit.
function candidateBases(): string[] {
  const bases: string[] = [process.cwd()];
  bases.push(path.join(__dirname, '..', '..', '..')); // dist/src/services -> project root (local build)
  bases.push(path.join(__dirname, '..', '..'));
  bases.push(path.join(__dirname, '..'));       // bundle root sibling
  bases.push(__dirname);                        // bundle root
  return bases;
}

export function resolveProjectPath(rel: string): string | null {
  for (const base of candidateBases()) {
    const candidate = path.join(base, rel);
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // permission or fs error — try the next candidate
    }
  }
  return null;
}