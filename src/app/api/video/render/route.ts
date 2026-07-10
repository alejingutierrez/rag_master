import { NextRequest } from "next/server";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

export const dynamic = "force-dynamic";
export const maxDuration = 3600;

/**
 * Render LOCAL de la partitura a MP4 (solo para probar en la máquina de desarrollo:
 * usa el Remotion CLI + Chromium, que NO corren en App Runner). En producción esto
 * se reemplaza por @remotion/lambda. Escribe el MP4 en public/videos y devuelve su URL.
 * `--public-dir` apunta al public/ del app Next para hallar las imágenes de archivo.
 */
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const score = body?.score;
  if (!score?.meta || !Array.isArray(score?.scenes)) return json({ error: "Partitura requerida" }, 400);

  // App Runner no trae Chromium ni el CLI de Remotion: el render a MP4 corre solo
  // en desarrollo. En producción el preview funciona y el MP4 llega en la fase Lambda.
  if (process.env.NODE_ENV === "production") {
    return json(
      { error: "El render a MP4 en la nube llega en la siguiente fase. Por ahora usa el preview y «Descargar partitura»." },
      501
    );
  }

  try {
    const repo = process.cwd();
    const remotion = join(repo, "remotion");
    const id = `${score.meta.periodCode}-${Date.now().toString(36)}`;
    mkdirSync(join(remotion, "out"), { recursive: true });
    mkdirSync(join(repo, "public", "videos"), { recursive: true });
    const scorePath = join(remotion, "out", `score-web-${id}.json`);
    writeFileSync(scorePath, JSON.stringify(score));
    const outPath = join(repo, "public", "videos", `${id}.mp4`);
    execSync(
      `npx remotion render src/index.ts TypographicVideo "${outPath}" --props="${scorePath}" --public-dir="${join(repo, "public")}" --concurrency=4`,
      { cwd: remotion, stdio: "ignore" }
    );
    return json({ url: `/videos/${id}.mp4` });
  } catch (e) {
    return json({ error: "Render local falló: " + (e as Error).message.slice(0, 180) }, 500);
  }
}
