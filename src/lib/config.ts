import { Headers } from '@effect/platform';
import { Context, Layer, Ref } from 'effect';

export type ApiConfig = {
	baseUrl: string;
	headers: Headers.Input;
};

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export class Config extends Context.Tag('ApiClientConfig')<
	Config,
	Ref.Ref<ApiConfig>
>() {}

export const layer = ({
	baseUrl,
	headers = Headers.empty,
}: Optional<ApiConfig, 'headers'>) =>
	Ref.make({
		baseUrl,
		headers,
	}).pipe(Layer.effect(Config));
