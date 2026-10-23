"use client";

import { useEffect, useRef } from "react";
import "./side-rays.css";

const hexToRgb = (hex) => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

  return match
    ? [parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255]
    : [1, 1, 1];
};

const originToFlip = (origin) => {
  switch (origin) {
    case "top-left":
      return [1, 0];
    case "bottom-right":
      return [0, 1];
    case "bottom-left":
      return [1, 1];
    default:
      return [0, 0];
  }
};

export default function SideRays({
  speed = 2.4,
  rayColor1 = "#F0A72F",
  rayColor2 = "#315FF4",
  intensity = 2.3,
  spread = 2,
  origin = "top-right",
  tilt = -6,
  saturation = 1.55,
  blend = 0.62,
  falloff = 1.4,
  opacity = 0.96,
  className = "",
}) {
  const containerRef = useRef(null);
  const uniformsRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return undefined;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      container.dataset.mode = "static";
      return undefined;
    }

    container.dataset.mode = "loading";

    let disposed = false;
    let renderer = null;
    let mesh = null;
    let resizeObserver = null;
    let intersectionObserver = null;
    let animationId = null;
    let lastFrame = 0;
    const frameInterval = window.innerWidth <= 760 ? 50 : 33;
    let isVisible = true;
    let pageVisible = !document.hidden;

    const stopLoop = () => {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    };

    const renderFrame = (time) => {
      if (!renderer || !mesh || !uniformsRef.current || disposed) return;

      uniformsRef.current.iTime.value = time * 0.001;
      renderer.render({ scene: mesh });
    };

    const loop = (time) => {
      if (disposed || !isVisible || !pageVisible) {
        animationId = null;
        return;
      }

      if (time - lastFrame >= frameInterval) {
        try {
          renderFrame(time);
          lastFrame = time;
        } catch {
          stopLoop();
          container.dataset.mode = "fallback";
          return;
        }
      }

      animationId = requestAnimationFrame(loop);
    };

    const updatePlayback = () => {
      if (!renderer || !mesh || disposed) return;

      if (isVisible && pageVisible) {
        if (animationId === null) animationId = requestAnimationFrame(loop);
      } else {
        stopLoop();
      }
    };

    const handleVisibilityChange = () => {
      pageVisible = !document.hidden;
      updatePlayback();
    };

    const initialize = async () => {
      try {
        const { Renderer, Program, Triangle, Mesh } = await import("ogl");

        if (disposed || !containerRef.current) return;

        renderer = new Renderer({
          dpr: Math.min(window.devicePixelRatio || 1, window.innerWidth <= 1040 ? 1 : 1.5),
          alpha: true,
          antialias: false,
        });

        const gl = renderer.gl;
        const canvas = gl.canvas;
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.setAttribute("aria-hidden", "true");
        canvas.setAttribute("role", "presentation");

        const vertex = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

        const fragment = `precision highp float;

uniform float iTime;
uniform vec2 iResolution;
uniform float iSpeed;
uniform vec3 iRayColor1;
uniform vec3 iRayColor2;
uniform float iIntensity;
uniform float iSpread;
uniform float iFlipX;
uniform float iFlipY;
uniform float iTilt;
uniform float iSaturation;
uniform float iBlend;
uniform float iFalloff;
uniform float iOpacity;

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  float cosAngle = dot(normalize(sourceToCoord), rayRefDirection);
  float phase = iTime * speed;
  float radialPhase = length(sourceToCoord) * 0.0022;
  float waveA = 0.5 + 0.5 * sin(cosAngle * seedA + radialPhase - phase * 1.6);
  float waveB = 0.5 + 0.5 * cos(cosAngle * seedB - radialPhase * 0.7 + phase * 1.1);
  float strength = 0.08 + 0.62 * pow(waveA, 2.6) + 0.34 * pow(waveB, 3.4);
  float distanceFade = clamp((iResolution.x - length(sourceToCoord)) / iResolution.x, 0.45, 1.0);
  return clamp(strength, 0.0, 1.0) * distanceFade;
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  if (iFlipX > 0.5) fragCoord.x = iResolution.x - fragCoord.x;
  if (iFlipY > 0.5) fragCoord.y = iResolution.y - fragCoord.y;

  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  vec2 rayPos = vec2(iResolution.x * 1.1, -0.5 * iResolution.y);

  float tiltRad = iTilt * 3.14159265 / 180.0;
  float cs = cos(tiltRad);
  float sn = sin(tiltRad);
  vec2 rel = coord - rayPos;
  vec2 tiltedCoord = vec2(rel.x * cs - rel.y * sn, rel.x * sn + rel.y * cs) + rayPos;

  float halfSpread = iSpread * 0.275;
  float sweep = sin(iTime * iSpeed * 0.32) * 0.07;
  vec2 rayRefDir1 = normalize(vec2(cos(0.785398 + halfSpread + sweep), sin(0.785398 + halfSpread + sweep)));
  vec2 rayRefDir2 = normalize(vec2(cos(0.785398 - halfSpread - sweep), sin(0.785398 - halfSpread - sweep)));

  vec4 rays1 = vec4(iRayColor1, 1.0) * rayStrength(rayPos, rayRefDir1, tiltedCoord, 36.2214, 21.11349, iSpeed);
  vec4 rays2 = vec4(iRayColor2, 1.0) * rayStrength(rayPos, rayRefDir2, tiltedCoord, 22.3991, 18.0234, iSpeed * 0.6);

  vec4 color = rays1 * (1.0 - iBlend) * 0.9 + rays2 * iBlend * 0.9;

  float distanceToLight = length(fragCoord.xy - vec2(rayPos.x, iResolution.y - rayPos.y)) / iResolution.y;
  float brightness = iIntensity * 0.4 / pow(max(distanceToLight, 0.001), iFalloff);
  color.rgb *= brightness;

  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  color.rgb = mix(vec3(gray), color.rgb, iSaturation);

  color.a = max(color.r, max(color.g, color.b)) * iOpacity;
  gl_FragColor = color;
}`;

        const [flipX, flipY] = originToFlip(origin);
        const uniforms = {
          iTime: { value: 0 },
          iResolution: { value: [1, 1] },
          iSpeed: { value: speed },
          iRayColor1: { value: hexToRgb(rayColor1) },
          iRayColor2: { value: hexToRgb(rayColor2) },
          iIntensity: { value: intensity },
          iSpread: { value: spread },
          iFlipX: { value: flipX },
          iFlipY: { value: flipY },
          iTilt: { value: tilt },
          iSaturation: { value: saturation },
          iBlend: { value: blend },
          iFalloff: { value: falloff },
          iOpacity: { value: opacity },
        };

        uniformsRef.current = uniforms;

        const geometry = new Triangle(gl);
        const program = new Program(gl, { vertex, fragment, uniforms });
        mesh = new Mesh(gl, { geometry, program });

        if (disposed || !containerRef.current) return;

        container.replaceChildren(canvas);

        const updateSize = () => {
          if (!renderer || disposed) return;

          const width = container.clientWidth;
          const height = container.clientHeight;

          if (width <= 0 || height <= 0) return;

          renderer.dpr = Math.min(window.devicePixelRatio || 1, width <= 1040 ? 1 : 1.5);
          renderer.setSize(width, height);
          uniforms.iResolution.value = [width * renderer.dpr, height * renderer.dpr];

          try {
            renderFrame(0);
            container.dataset.mode = "live";
          } catch {
            container.dataset.mode = "fallback";
          }
        };

        resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(container);
        updateSize();
        updatePlayback();
      } catch {
        container.dataset.mode = "fallback";
      }
    };

    intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        updatePlayback();
      },
      { threshold: 0.05 },
    );
    intersectionObserver.observe(container);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    initialize();

    return () => {
      disposed = true;
      stopLoop();
      intersectionObserver?.disconnect();
      resizeObserver?.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      uniformsRef.current = null;

      const canvas = renderer?.gl?.canvas;
      if (canvas?.parentNode === container) canvas.remove();

      renderer = null;
      mesh = null;
    };
    // The WebGL instance is mounted once; the following effect updates every prop-driven uniform.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const uniforms = uniformsRef.current;
    if (!uniforms) return;

    uniforms.iSpeed.value = speed;
    uniforms.iRayColor1.value = hexToRgb(rayColor1);
    uniforms.iRayColor2.value = hexToRgb(rayColor2);
    uniforms.iIntensity.value = intensity;
    uniforms.iSpread.value = spread;
    const [flipX, flipY] = originToFlip(origin);
    uniforms.iFlipX.value = flipX;
    uniforms.iFlipY.value = flipY;
    uniforms.iTilt.value = tilt;
    uniforms.iSaturation.value = saturation;
    uniforms.iBlend.value = blend;
    uniforms.iFalloff.value = falloff;
    uniforms.iOpacity.value = opacity;
  }, [speed, rayColor1, rayColor2, intensity, spread, origin, tilt, saturation, blend, falloff, opacity]);

  return (
    <div
      ref={containerRef}
      className={`side-rays-container ${className}`.trim()}
      aria-hidden="true"
      role="presentation"
    />
  );
}
