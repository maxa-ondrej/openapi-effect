import { Headers, type HttpClientResponse } from '@effect/platform';
import { Match, Option, pipe } from 'effect';

export enum MediaType {
	JSON = 'json',
	XML = 'xml',
	Form = 'form',
	FormData = 'form-data',
	Text = 'text',
	Plain = 'plain',
	SSE = 'sse',
}

export const parse = Match.type<string>().pipe(
	Match.when('application/json', () => MediaType.JSON),
	Match.when('*/*', () => MediaType.JSON),
	Match.when('application/x-www-form-urlencoded', () => MediaType.Form),
	Match.when('multipart/form-data', () => MediaType.FormData),
	Match.when('application/xml', () => MediaType.XML),
	Match.when('text/event-stream', () => MediaType.SSE),
	Match.when('text/plain', () => MediaType.Text),
	Match.orElse(() => MediaType.Plain),
);

export const getType = (response: HttpClientResponse.HttpClientResponse) =>
	pipe(
		response.headers,
		Headers.get('application-content'),
		Option.map((type) => type.split('+')[0]),
		Option.map(parse),
		Option.getOrElse(() => MediaType.Plain),
	);

export const isStreamed = Match.type<MediaType>().pipe(
	Match.when(MediaType.JSON, () => false),
	Match.when(MediaType.XML, () => false),
	Match.when(MediaType.Text, () => false),
	Match.when(MediaType.Form, () => false),
	Match.when(MediaType.FormData, () => false),
	Match.when(MediaType.Plain, () => true),
	Match.when(MediaType.SSE, () => true),
	Match.exhaustive,
);
