// Template registry keyed by `screens.template` (§3.2 "ship 2-3, not a
// builder"). ScreenRenderer picks a component from here — this is the single
// place template code is chosen, so admin preview and the (displays-unit-
// owned) TV render route stay on "same route, same code."
import type { JSX } from "react";
import type { ScreenTemplate } from "@/db/schema";
import type { ScreenTemplateProps } from "./types";
import { ListTemplate } from "./ListTemplate";
import { GridTemplate } from "./GridTemplate";
import { SpotlightTemplate } from "./SpotlightTemplate";

export type { ScreenTemplateProps } from "./types";
export { ListTemplate } from "./ListTemplate";
export { GridTemplate } from "./GridTemplate";
export { SpotlightTemplate } from "./SpotlightTemplate";

export const SCREEN_TEMPLATES: Record<ScreenTemplate, (props: ScreenTemplateProps) => JSX.Element> = {
  list: ListTemplate,
  grid: GridTemplate,
  spotlight: SpotlightTemplate,
};
