'use client';
import type { FC } from 'react';
import { useEffect } from 'react';

import styles from './styles.module.css';

type ParticlesGlobal = {
  particlesJS?: {
    load: (tag_id: string, path_config_json: string, callback?: () => void) => void;
  };
};

const TAG_ID = 'particles';
const PATH_CONFIG_JSON = './particles.json';

const Particles: FC = () => {
  useEffect(() => {
    const loadParticles = async () => {
      // Dynamically import only in the browser
      // @ts-ignore
      await import('particles.js');

      const g = globalThis as unknown as ParticlesGlobal;

      if (g.particlesJS?.load) {
        g.particlesJS.load(TAG_ID, PATH_CONFIG_JSON);
      }
    };

    loadParticles();
  }, []);

  return <div className={styles.particles} id={TAG_ID} />;
};

export default Particles;
