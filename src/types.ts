export interface Config {
	/**
	 * Plugin name. Must be unique.
	 */
	name: 'effect';
	/**
	 * Name of the generated file.
	 * @default 'effect'
	 */
	output?: string;
	/**
	 * Base URL of the API.
	 */
	baseUrl: string;
}
