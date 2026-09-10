import { afterEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import { gameMessages } from "../../i18n/game-messages";
import { ZombieRenderer } from "./zombies";

afterEach(() => vi.restoreAllMocks());
it("repaints existing enemy nameplates with Persian labels and the local font", () => {
  const context = {
    fillStyle: "",
    font: "",
    textAlign: "",
    fillRect: vi.fn(),
    fillText: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  const scene = new THREE.Scene(),
    renderer = new ZombieRenderer(scene);
  const sprites: THREE.Sprite[] = [];
  scene.traverse((object) => {
    if (object instanceof THREE.Sprite) sprites.push(object);
  });
  const textures = sprites.map((sprite) => sprite.material.map);
  renderer.presentation(gameMessages.en.zombieNames, "Arial");
  context.fillText.mockClear();
  renderer.presentation(gameMessages.fa.zombieNames, "Vazir");
  expect(context.fillText.mock.calls.map(([label]) => label)).toEqual(
    Object.values(gameMessages.fa.zombieNames),
  );
  expect(context.font).toBe("bold 25px Vazir");
  expect(sprites.map((sprite) => sprite.material.map)).toEqual(textures);
  renderer.dispose();
});
