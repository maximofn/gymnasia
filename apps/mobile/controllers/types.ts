import type { ShellLayerId } from "../shell/shellRegistry";

export type ScreenController<
  Model,
  Actions,
  Layer extends ShellLayerId = never,
> = {
  model: Readonly<Model>;
  actions: Readonly<Actions>;
  back: {
    layers: Record<Layer, boolean>;
    handlers: Record<Layer, () => boolean>;
  };
};
