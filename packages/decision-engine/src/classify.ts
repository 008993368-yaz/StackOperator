import micromatch from "micromatch";
import type { RepoRules } from "@stackoperator/config";
import type { ChangedFile } from "@stackoperator/stack-core";
import type { Classification } from "./types.js";

function pathsFor(file: ChangedFile): string[] {
  if (file.previousPath && file.previousPath !== file.path) {
    return [file.path, file.previousPath];
  }
  return [file.path];
}

function matchesGlob(path: string, pattern: string): boolean {
  return micromatch.isMatch(path, pattern, { dot: true });
}

export function classifyChangedFiles(
  files: readonly ChangedFile[],
  rules: RepoRules | null,
): Classification {
  if (!rules || rules.rules.length === 0) {
    return {
      classes: [],
      unmatchedPaths: files.map((file) => file.path),
      testsNeeded: [],
      unknown: true,
    };
  }

  const classes = new Set<string>();
  const tests = new Set<string>();
  const unmatched: string[] = [];

  if (files.length === 0) {
    return {
      classes: [],
      unmatchedPaths: [],
      testsNeeded: [],
      unknown: true,
    };
  }

  for (const file of files) {
    const candidates = pathsFor(file);
    let matched = false;
    for (const rule of rules.rules) {
      const hit = candidates.some((path) =>
        rule.paths.some((pattern) => matchesGlob(path, pattern)),
      );
      if (hit) {
        matched = true;
        classes.add(rule.className);
        for (const test of rule.tests) {
          tests.add(test);
        }
      }
    }
    if (!matched) {
      unmatched.push(file.path);
    }
  }

  return {
    classes: [...classes].sort(),
    unmatchedPaths: unmatched,
    testsNeeded: [...tests].sort(),
    unknown: unmatched.length > 0,
  };
}
