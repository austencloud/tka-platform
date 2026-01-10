import type { OceanParticle } from "../../domain/models/DeepOceanModels";
import type { IParticleRenderer } from "../contracts/IParticleRenderer";

export class ParticleRenderer implements IParticleRenderer {
  drawParticles(
    ctx: CanvasRenderingContext2D,
    particles: OceanParticle[]
  ): void {
    ctx.save();
    for (const particle of particles) {
      ctx.globalAlpha = particle.opacity;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
