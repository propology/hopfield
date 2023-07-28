import { BaseHopfieldSchema } from './base.js';
import { BaseError } from './errors.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

import type { IsEmptyArray } from './type-utils.js';
import {
  type AnyZodObject,
  ZodFirstPartyTypeKind,
  type ZodTypeDef,
  z,
} from 'zod';
import type { Refs } from 'zod-to-json-schema/src/Refs.js';
import type { JsonSchema7Type } from 'zod-to-json-schema/src/parseDef.js';

export type AnyBaseHopfieldFunction = BaseHopfieldFunction<
  any,
  any,
  any,
  any,
  any
>;

type FunctionProperty<
  T extends AnyBaseHopfieldFunction,
  K extends keyof T,
> = T extends { [P in K]: infer N } ? N : never;

export type FunctionPropertyOrNever<
  T extends AnyBaseHopfieldFunction[],
  K extends keyof T[number],
> = IsEmptyArray<T> extends true
  ? never
  : [FunctionProperty<T[number], K>, ...FunctionProperty<T[number], K>[]];

export type DisabledTypes =
  | ZodFirstPartyTypeKind[]
  | readonly ZodFirstPartyTypeKind[]
  | false;

export type TypeTemplates =
  | Partial<Record<ZodFirstPartyTypeKind, (input: string) => string>>
  | false;

export interface JsonSchemaFunction<
  Name extends string,
  Description extends string = string,
> {
  /**
   * The name of the function to be called. Must be a-z, A-Z, 0-9, or contain
   * underscores and dashes, with a maximum length of 64.
   */
  name: Name;
  /**
   * A description of what the function does, used by the model to choose when and
   * how to call the function.
   */
  description: Description;
  /**
   * The parameters the functions accepts, described as a JSON Schema object. See the
   * [guide](/docs/guides/gpt/function-calling) for examples, and the
   * [JSON Schema reference](https://json-schema.org/understanding-json-schema/) for
   * documentation about the format.
   *
   * To describe a function that accepts no parameters, provide the value
   * `{"type": "object", "properties": {}}`.
   */
  parameters: JsonSchema7Type;
}

const requiredDescriptionTypes: ZodFirstPartyTypeKind[] = [
  ZodFirstPartyTypeKind.ZodBigInt,
  ZodFirstPartyTypeKind.ZodBoolean,
  ZodFirstPartyTypeKind.ZodDate,
  ZodFirstPartyTypeKind.ZodEnum,
  ZodFirstPartyTypeKind.ZodFunction,
  ZodFirstPartyTypeKind.ZodNativeEnum,
  ZodFirstPartyTypeKind.ZodNumber,
  ZodFirstPartyTypeKind.ZodString,
];

export type HopfieldFunctionOptions<
  D extends DisabledTypes,
  T extends TypeTemplates,
> = {
  /**
   * Allows you to throw development errors in production. This defaults to `false`
   * for speed/devex when deploying to prod.
   */
  requireDescriptions?: boolean;
  /**
   * Allows you to throw development errors in production. This defaults to `false`
   * for speed/devex when deploying to prod.
   */
  templates?: T;
  /**
   * Allows you override or disable "unstable" types, which are types that do not typically
   * produce good results with a given model. These are defined on a per-model basis and
   * test cases must back up their unreliability.
   *
   * Set to false to allow all "unstable" types.
   */
  disabledTypes?: D;
};

const stringToJSONSchema = z.string().transform((str, ctx): object => {
  try {
    return JSON.parse(str);
  } catch (_e) {
    ctx.addIssue({
      code: 'custom',
      message:
        'Invalid JSON when parsing - likely the arguments are malformed.',
    });
    return z.NEVER;
  }
});

const NameSchema = z
  .string()
  .max(64, {
    message: "Function name can't exceed 64 characters.",
  })
  .refine((value) => /^[a-zA-Z0-9_-]+$/.test(value), {
    message:
      'Function name can only contain a-z, A-Z, 0-9, underscores and dashes.',
  });

const DescriptionSchema = z.string().min(1).max(500);

export type BaseHopfieldFunctionProps<
  FName extends string,
  FDescription extends string,
  FParams extends AnyZodObject,
  DTypes extends DisabledTypes,
  TTemplates extends TypeTemplates,
> = {
  name: FName;
  description: FDescription;
  parameters: FParams;
  options?: HopfieldFunctionOptions<DTypes, TTemplates>;
};

export abstract class BaseHopfieldFunction<
  FName extends string,
  FDescription extends string,
  FParams extends AnyZodObject,
  DTypes extends DisabledTypes,
  TTemplates extends TypeTemplates,
> extends BaseHopfieldSchema {
  name: FName;
  description: FDescription;

  parameters: FParams;
  protected _options: HopfieldFunctionOptions<DTypes, TTemplates>;

  constructor({
    name,
    description,
    parameters,
    options = {},
  }: BaseHopfieldFunctionProps<
    FName,
    FDescription,
    FParams,
    DTypes,
    TTemplates
  >) {
    super();

    this.name = name;
    this.description = description;
    this.parameters = parameters;

    this._options = options;
  }

  protected abstract get _defaultTypeTemplates(): TypeTemplates;
  protected abstract get _defaultDisabledTypes(): DisabledTypes;

  /**
   * Returns a formatted JSON schema function definition for LLM function calling.
   * This is checked for correctness against the provided rules, so make sure this is only done
   * once and not called repeatedly in the critical path.
   *
   * @returns @interface JsonSchemaFunction a definition for a valid JSON schema function.
   */
  get jsonSchema(): JsonSchemaFunction<FName> {
    const parsedName = NameSchema.safeParse(this.name);
    const parsedDescription = DescriptionSchema.safeParse(this.description);

    if (!parsedName.success) {
      throw new BaseError('You must define a valid function name.', {
        docsPath: '/api/function',
        details: parsedName.error,
      });
    }
    if (!parsedDescription.success) {
      throw new BaseError('You must define a valid function description.', {
        docsPath: '/api/function',
        details: parsedDescription.error,
      });
    }

    const onParseDef = (
      def: ZodTypeDef,
      _refs: Refs,
      schema: JsonSchema7Type,
    ) => {
      const typeName: ZodFirstPartyTypeKind = (def as any).typeName;

      const templates =
        this._options.templates === false
          ? false
          : {
              ...this._defaultTypeTemplates,
              ...this._options.templates,
            };
      const requireDescriptions = this._options.requireDescriptions ?? true;
      const disabledTypes = !this._options.disabledTypes
        ? false
        : {
            ...this._defaultDisabledTypes,
            ...this._options.disabledTypes,
          };

      // check here for typeName and description being defined
      if (
        requireDescriptions &&
        requiredDescriptionTypes.includes(typeName) &&
        !schema.description
      ) {
        throw new BaseError(
          `You must define a description for the type: ${typeName}`,
          {
            docsPath: '/api/function',
            details: `There must be a description provided for ${typeName}, to describe what the function does for the LLM to infer a value.`,
          },
        );
      }

      const descriptionEnding =
        typeof templates === 'object'
          ? templates?.[typeName]?.('') ?? null
          : null;

      if (
        descriptionEnding &&
        schema.description &&
        !schema.description?.endsWith(descriptionEnding)
      ) {
        throw new BaseError('You should template your descriptions.', {
          docsPath: '/api/function',
          details: `It's recommended to template your descriptions - we recommend ending the type ${typeName} with "${descriptionEnding}".`,
        });
      }

      // check here for disabled types
      if (
        typeof disabledTypes !== 'boolean' &&
        disabledTypes.includes(typeName)
      ) {
        throw new BaseError(`You should not use ${typeName}.`, {
          docsPath: '/api/function',
          details: `You should not use ${typeName} yet - it provides unreliable results from LLMs.`,
        });
      }
    };

    return {
      name: this.name,
      description: this.description,
      parameters: zodToJsonSchema(this.parameters, {
        $refStrategy: 'none',
        onParseDef,
      }),
    } as const;
  }

  get returnType() {
    return z.object({
      name: z.literal(this.name).describe('The name of the function to call.'),
      arguments: z.lazy(() =>
        stringToJSONSchema
          .describe(
            'The arguments to call the function with, as generated by the model in JSON format and coerced into the provided schema. Note that the model does not always generate valid JSON, and may hallucinate parameters not defined by your function schema.',
          )
          .transform((obj): z.infer<typeof this.parameters> => {
            const result = this.parameters.safeParse(obj);
            if (!result.success) {
              throw result.error;
            }
            return result.data;
          }),
      ),
    });
  }

  get schema() {
    return z.object({
      name: z.literal(this.name).describe('The name of the function.'),
      description: z
        .literal(this.description)
        .describe('The description of the function.'),
      parameters: z
        .object({
          type: z.literal('object'),
          properties: z.record(z.any()).optional(),
          required: z.array(z.string()).optional(),
          additionalProperties: z.boolean(),
          $schema: z.string(),
        })
        .passthrough(),
    });
  }
}