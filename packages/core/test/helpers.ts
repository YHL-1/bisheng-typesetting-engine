import { createLayoutOptions } from "../src/defaults";
import type { LayoutOptions } from "../src/types";

export function createDefaultOptions(overrides: Partial<LayoutOptions> = {}): LayoutOptions {
  return createLayoutOptions(overrides);
}
