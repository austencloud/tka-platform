import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { OceanParticle } from "../../domain/models/DeepOceanModels";
import type { IParticleSystem } from "../contracts/IParticleSystem";

export class ParticleSystem implements IParticleSystem {
  initializeParticles(dimensions: Dimensions, count: number): OceanParticle[] {
    const particles: OceanParticle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push(this.createParticle(dimensions));
    }
    return particles;
  }

  createParticle(dimensions: Dimensions): OceanParticle {
    return {
      x: Math.random() * dimensions.width,
      y: Math.random() * dimensions.height,
      vx: (Math.random() - 0.5) * 0.2, // Slower horizontal: ±0.1 instead of ±0.25
      vy: -0.05 - Math.random() * 0.15, // Slower upward: -0.05 to -0.2 instead of -0.1 to -0.4
      size: 0.8 + Math.random() * 2, // Smaller: 0.8-2.8 instead of 1-4
      opacity: 0.15 + Math.random() * 0.25, // More subtle opacity for dark particles
      color: this.getParticleColor(),
      life: 0,
      maxLife: 100 + Math.random() * 200,
    };
  }

  updateParticles(
    particles: OceanParticle[],
    dimensions: Dimensions,
    frameMultiplier: number
  ): OceanParticle[] {
    const updatedParticles: OceanParticle[] = [];

    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      if (!particle) continue;

      // Update position
      particle.x += particle.vx * frameMultiplier;
      particle.y += particle.vy * frameMultiplier;
      particle.life += frameMultiplier;

      // Update opacity based on life
      const lifeRatio = particle.life / particle.maxLife;
      particle.opacity = (1 - lifeRatio) * (0.15 + Math.random() * 0.25);

      // Remove if dead or off-screen, otherwise keep
      if (particle.life >= particle.maxLife || particle.y < -10) {
        // Replace with new particle
        updatedParticles.push(this.createParticle(dimensions));
      } else {
        updatedParticles.push(particle);
      }
    }

    return updatedParticles;
  }

  getParticleCount(quality: string): number {
    switch (quality) {
      case "minimal":
        return 15; // Reduced from 25
      case "low":
        return 30; // Reduced from 50
      case "medium":
        return 45; // Reduced from 75
      case "high":
        return 60; // Reduced from 100
      default:
        return 45;
    }
  }

  getParticleColor(): string {
    // Darker ocean particle colors
    const colors = ["#1a3a4a", "#1e4250", "#224956", "#1f4148"];
    return colors[Math.floor(Math.random() * 4)] || "#1a3a4a";
  }
}
