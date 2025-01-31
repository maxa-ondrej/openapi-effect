import { Context, Layer, Ref } from 'effect';

export type ApiConfig = {
	baseUrl: string;
};

export class Config extends Context.Tag('ApiClientConfig')<
	Config,
	Ref.Ref<ApiConfig>
>() {}

export const layer = (config: ApiConfig) =>
	Ref.make(config).pipe(Layer.effect(Config));
