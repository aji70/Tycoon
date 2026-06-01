'use client';

import { useEffect } from 'react';
import useSound from 'use-sound';

type ThemeSoundPlayerProps = {
  playing: boolean;
};

/**
 * Mount only after the user enables theme audio so /sound/monopoly-theme.mp3
 * is not fetched on initial load.
 */
export default function ThemeSoundPlayer({ playing }: ThemeSoundPlayerProps) {
  const [play, { pause }] = useSound('/sound/monopoly-theme.mp3', {
    volume: 0.5,
    loop: true,
  });

  useEffect(() => {
    if (playing) {
      void play();
    } else {
      pause();
    }
  }, [playing, play, pause]);

  return null;
}
