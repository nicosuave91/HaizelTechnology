import { OpenFeature, InMemoryProvider } from '@openfeature/js-sdk';

const provider = new InMemoryProvider({
  TENANT_BANNER_EXAMPLE: true,
});

OpenFeature.setProvider(provider);

export const getFeatureClient = () => OpenFeature.getClient('web');
