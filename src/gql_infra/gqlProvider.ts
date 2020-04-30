const graphql = require('graphql');
const { GraphQLObjectType, GraphQLSchema, GraphQLID } = graphql;
import { DocumentNode, GraphQLError } from 'graphql';
import { parse } from 'graphql/language/parser';
import _ from 'lodash';
import { ILogger } from '../logger';
import { ValidationRule } from 'graphql/validation/ValidationContext';
import { GqlRequestHandler, Field, ContextMap, ResolvedFieldsMap } from './gqlRequestHandler';

export interface IGqlProvider {
    readonly types: Array<any>;
    readonly resolvedFields: ResolvedFieldsMap;
    findRegisteredType(typeName: string): any;
}

export class GqlProvider implements GqlProvider {
    static readonly maxHandlerId = 1000;

    readonly schema: any;
    readonly types = Array<any>();
    readonly resolvedFields: ResolvedFieldsMap = { };
    readonly contextConst: ContextMap = { };

    private currentHandlerId: number = 0;

    constructor(private logger: ILogger, private withExecution: boolean = true) {
        const config = new GraphQLObjectType({ name: 'Query' }).toConfig();
        config.fields['_'] = GqlProvider.createFreshDummyField();
        this.schema = new GraphQLSchema({ query: new GraphQLObjectType(config) });
    }

    private static createFreshDummyField = () => {
        const dummyField = new GraphQLObjectType({name: '_', fields: {dummy: {}}}).toConfig().fields.dummy;
        dummyField.type = new GraphQLObjectType({
            name: '_',
            fields: () => ({
                id: { type: GraphQLID },
            })
        });
        return dummyField;
    }

    validateFn = (schema: any, documentAST: DocumentNode, rules: ReadonlyArray<ValidationRule>) => true;

    formatErrorFn = (error: GraphQLError) => this.logger.log(`*** Error: ${error}`);

    executeFn = async (inboundObj: any): Promise<string> =>
        await new GqlRequestHandler(
                        this.newHandlerId(),
                        this,
                        this.contextConst,
                        this.logger,
                        this.withExecution)
            .executeFn(inboundObj);

    processSource = async (src: string): Promise<string> =>
        await this.executeFn(parse(src).definitions[0]);

    registerTypes = (...arrArgs: Array<any>): GqlProvider => {
        arrArgs?.forEach((args: any) => this.types.push(args));
        return this;
    }

    registerResolvedFields = (...arrArgs: Array<Field>): GqlProvider => {
        arrArgs?.forEach((field: any) => this.resolvedFields[field.fullFieldPath] = field);
        return this;
    }

    findRegisteredType = (typeName: string): any => {
        const types = this.types;
        for (let i = 0; i < types.length; i++)
            if (types[i].type === typeName)
                return types[i];

        return null;
    }

    private newHandlerId = (): string => {
        if (this.currentHandlerId >= GqlProvider.maxHandlerId - 1)
            this.currentHandlerId = 0;

        return `${++this.currentHandlerId}`;
    }
}
