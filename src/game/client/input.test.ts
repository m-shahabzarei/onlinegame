import { afterEach, expect, it, vi } from "vitest";
import { GameInput } from "./input";
import { DEFAULT_SETTINGS } from "../shared/settings";

let input: GameInput;
afterEach(() => input?.dispose());
function setup() {
  const canvas = document.createElement("canvas");
  const release = vi.fn(),
    shop = vi.fn(),
    equip = vi.fn(),
    reload = vi.fn();
  canvas.requestPointerLock = vi.fn().mockResolvedValue(undefined);
  input = new GameInput(
    canvas,
    () => DEFAULT_SETTINGS,
    () => true,
    vi.fn(),
    reload,
    vi.fn(),
    shop,
    equip,
    release,
  );
  input.locked = true;
  return { canvas, release, shop, equip, reload };
}
it("switches 1/2 once per press and sends a single release for held trigger on blur", () => {
  const { equip, release } = setup();
  document.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit1" }));
  document.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit2" }));
  document.dispatchEvent(
    new KeyboardEvent("keydown", { code: "Digit2", repeat: true }),
  );
  expect(equip.mock.calls).toEqual([["primary"], ["secondary"]]);
  document.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
  document.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
  expect(input.triggerSeq).toBe(1);
  window.dispatchEvent(new Event("blur"));
  expect(release).toHaveBeenCalledExactlyOnceWith(1);
  document.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
  expect(release).toHaveBeenCalledTimes(1);
});
it("B works unlocked, ignores repeats/editable controls, and pointer lock requires enter", async () => {
  const { canvas, shop } = setup();
  input.release();
  document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyB" }));
  document.dispatchEvent(
    new KeyboardEvent("keydown", { code: "KeyB", repeat: true }),
  );
  const field = document.createElement("input");
  document.body.append(field);
  field.dispatchEvent(
    new KeyboardEvent("keydown", { code: "KeyB", bubbles: true }),
  );
  field.remove();
  expect(shop).toHaveBeenCalledTimes(1);
  expect(canvas.requestPointerLock).not.toHaveBeenCalled();
  await input.enter();
  expect(canvas.requestPointerLock).toHaveBeenCalledTimes(1);
});
