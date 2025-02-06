import { Array, Effect, Option, Stream, Tuple } from 'effect';

export type PaginationConfig<
	D extends object,
	P extends keyof D,
	L extends keyof D,
	Response,
	Item,
> = {
	page: P;
	limit: L;
	firstPage: number;
	getTotalPages: (props: {
		limit: number;
		response: Response;
	}) => number;
	getPageData: (response: Response) => readonly Item[];
};

type KeysWithOptionNumber<D extends { query: object }> = {
	[K in keyof D['query']]: D['query'][K] extends Option.Option<number>
		? K
		: never;
}[keyof D['query']];

export const paginate =
	<D extends { query: object }, E1, R1, Response, Item>(
		fetchPage: (data: D) => Effect.Effect<Response, E1, R1>,
	) =>
	<P extends KeysWithOptionNumber<D>, L extends KeysWithOptionNumber<D>>({
		page,
		limit,
		firstPage = 1,
		getPageData,
		getTotalPages,
	}: PaginationConfig<D, P, L, Response, Item>) =>
	(limitValue: number = 10, initialPage: number = 0) =>
	(
		data: Omit<D, 'query'> & { query: Omit<D['query'], P | L> },
	): Stream.Stream<
		readonly Readonly<{
			item: Item;
			page: number;
			limit: number;
			totalPages: number;
		}>[],
		E1,
		R1
	> =>
		Stream.paginateEffect(initialPage, (n) =>
			Effect.gen(function* () {
				yield* Effect.logInfo('Paginate', { page, limit, firstPage });
				const requestData = {
					...data,
					query: {
						...data.query,
						[page]: Option.some(n),
						[limit]: Option.some(limitValue),
					},
				} as D;
				const response = yield* fetchPage(requestData);
				const totalPages =
					getTotalPages({ limit: limitValue, response }) - firstPage + 1;
				const items = Array.map(getPageData(response), (item) => ({
					item,
					page: n,
					limit: limitValue,
					totalPages,
				}));

				return Tuple.make(
					items,
					n < totalPages ? Option.some(n + 1) : Option.none(),
				);
			}),
		);

type BaseRequest<PageField extends string, LimitField extends string> = {
	readonly [page in PageField]: Option.Option<number>;
} & {
	readonly [limit in LimitField]: Option.Option<number>;
};

type BaseResponse<DataField extends string, TotalField extends string> = {
	readonly [data in DataField]: readonly unknown[];
} & {
	readonly [total in TotalField]: number;
};

export const createPaginator =
	<
		PageField extends string,
		LimitField extends string,
		DataField extends string,
		TotalField extends string,
	>(
		page: PageField,
		limit: LimitField,
		dataField: DataField,
		total: TotalField,
		firstPage: number,
	) =>
	(limitValue: number = 10, initialPage: number = 0) =>
	<
		E1,
		R1,
		Data extends { readonly query: BaseRequest<PageField, LimitField> },
		Response extends BaseResponse<DataField, TotalField>,
	>(
		fetchPage: (data: Data) => Effect.Effect<Response, E1, R1>,
	) =>
	(
		data: Omit<Data, 'query'> & {
			query: Omit<Data['query'], KeysWithOptionNumber<Data>>;
		},
	) =>
		paginate(fetchPage)({
			firstPage,
			limit: limit as unknown as KeysWithOptionNumber<Data>,
			page: page as unknown as KeysWithOptionNumber<Data>,
			getPageData: (response) => response[dataField],
			getTotalPages: ({ response }) => response[total],
		})(
			limitValue,
			initialPage,
		)(data) as Stream.Stream<
			Response extends {
				readonly page: readonly (infer T)[];
			}
				? readonly Readonly<{
						item: T;
						page: number;
						limit: number;
						totalPages: number;
					}>[]
				: never,
			E1,
			R1
		>;
