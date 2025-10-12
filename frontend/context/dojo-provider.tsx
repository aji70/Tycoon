'use client';

import { ReactNode, useEffect, useState } from 'react';
import { DojoSdkProvider } from '@dojoengine/sdk/react';
import { dojoConfig } from '../dojoConfig';
import { setupWorld } from '../typescript/contracts.gen';
import { SchemaType } from '../typescript/models.gen';

interface DojoProviderProps {
  children: ReactNode;
}

export function DojoProvider({ children }: DojoProviderProps) {
  const [sdk, setSdk] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initializeSdk() {
      try {
        setIsLoading(true);
        setError(null);

        // Dynamic import with error handling for WASM modules
        console.log('Importing @dojoengine/sdk...');
        const { init } = await import('@dojoengine/sdk');
        console.log('Successfully imported @dojoengine/sdk');

        const sdkInstance = await init<SchemaType>({
          client: {
            toriiUrl: dojoConfig.toriiUrl,
            relayUrl: dojoConfig.relayUrl,
            worldAddress: dojoConfig.manifest.world.address,
          },
          domain: {
            name: 'Blockopoly',
            revision: '1.0.0',
            chainId: 'KATANA',
            version: '1.0.0',
          },
        });

        setSdk(sdkInstance);
      } catch (error) {
        console.error('Failed to initialize Dojo SDK:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    initializeSdk();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading Dojo SDK...</div>
      </div>
    );
  }

  return (
    <DojoSdkProvider sdk={sdk} dojoConfig={dojoConfig} clientFn={setupWorld}>
      {children}
    </DojoSdkProvider>
  );
}