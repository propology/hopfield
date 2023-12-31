import { BaseHopfieldSchema } from './base.js';
import type { AnyBaseHopfieldFunction } from './function.js';

export type BaseHopfieldFunctionTuple = [
  AnyBaseHopfieldFunction,
  ...AnyBaseHopfieldFunction[],
];

export type ChatStream = boolean;

export type StreamingResult<T> = {
  [Symbol.asyncIterator](): AsyncIterableIterator<T>;
  readableStream(): ReadableStream<T>;
  streaming: true;
};

export type StreamingOptions<T> = {
  onChunk?: (value: T) => any | Promise<any>;
  onDone?: (values: T[]) => any | Promise<any>;
};

export type StreamingWithFunctionsOptions<F, T> = StreamingOptions<T> & {
  onFunctionCall?: (value: F) => any | Promise<any>;
};

export type InferStreamingResult<Chat extends BaseHopfieldSchema> =
  StreamingResult<InferResult<Chat>>;

export type InferResult<Chat extends BaseHopfieldSchema> =
  Chat['returnType']['_output'];

export type InferInput<Chat extends BaseHopfieldSchema> =
  Chat['parameters']['_input'];

export type InferInputMessage<Chat extends BaseHopfieldChat<any, any, any>> =
  Chat['parameters']['_input']['messages'][number];

export const defaultChatN = 1;
export type DefaultChatN = typeof defaultChatN;

export type BaseHopfieldChatProps<
  ModelName extends string,
  N extends number,
  Stream extends ChatStream,
> = {
  model: ModelName;
  n: N;
  stream: Stream;
};

export abstract class BaseHopfieldChat<
  ModelName extends string,
  N extends number,
  Stream extends ChatStream,
> extends BaseHopfieldSchema {
  model: ModelName;

  protected _stream: Stream;
  protected _n: N;

  constructor({
    model,
    stream,
    n,
  }: BaseHopfieldChatProps<ModelName, N, Stream>) {
    super();

    this.model = model;
    this._stream = stream;
    this._n = n;
  }
}

export type BaseHopfieldChatWithFunctionsProps<
  ModelName extends string,
  N extends number,
  Stream extends ChatStream,
  Functions extends BaseHopfieldFunctionTuple,
> = {
  model: ModelName;
  n: N;
  stream: Stream;
  functions: Functions;
};

export abstract class BaseHopfieldChatWithFunctions<
  ModelName extends string,
  N extends number,
  Stream extends ChatStream,
  Functions extends BaseHopfieldFunctionTuple,
> extends BaseHopfieldChat<ModelName, N, Stream> {
  protected _functions: Functions;

  constructor(
    props: BaseHopfieldChatWithFunctionsProps<ModelName, N, Stream, Functions>,
  ) {
    super(props);

    this._functions = props.functions;
  }
}
