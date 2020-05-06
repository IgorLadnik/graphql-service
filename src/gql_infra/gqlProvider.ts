const graphql = require('graphql');
const { GraphQLObjectType, GraphQLSchema, GraphQLID } = graphql;
import { DocumentNode, GraphQLError } from 'graphql';
import { parse } from 'graphql/language/parser';
import _ from 'lodash';
import { ILogger } from '../logger';
import { ValidationRule } from 'graphql/validation/ValidationContext';
import { GqlRequestHandler, Field, ContextMap, ResolvedFieldsMap } from './gqlRequestHandler';
import { GqlTypesCommon } from './gqlTypesCommon';
import { Utils } from './utils';

export interface IGqlProvider {
    readonly types: Array<any>;
    readonly resolvedFields: ResolvedFieldsMap;
    findRegisteredType(typeName: string): any;
    resolveFunc(fullFieldPath: string, field: any, args: any, contextConst: any, contextVar: any): Promise<boolean>;
}

export class GqlProvider implements GqlProvider {
    static readonly maxHandlerId = 1000;

    readonly schema: any;
    readonly types = Array<any>();
    readonly resolvedFields: ResolvedFieldsMap = { };
    readonly contextConst: ContextMap = { };
    readonly typesCommon: GqlTypesCommon;

    resolveFns: any;

    private currentHandlerId: number = 0;

    constructor(private logger: ILogger, private withExecution: boolean = true) {
        const config = new GraphQLObjectType({ name: 'Query' }).toConfig();
        config.fields['_'] = GqlProvider.createFreshDummyField();
        this.schema = new GraphQLSchema({ query: new GraphQLObjectType(config) });

        this.typesCommon = new GqlTypesCommon(this, logger);
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

    processSource = async (src: string): Promise<string> => {
        try {
            return await this.executeFn(this.parseFn(src).definitions[0]);
        }
        catch (err) {
            const errorMessage = `*** Error in \"executeFn()\".`;
            this.logger.log(`${errorMessage} ${err}`);
            return errorMessage;
        }
    }

    parseFn = (src: string): any => {
        try {
            return parse(src, {noLocation: true});
        }
        catch (err) {
            const errorMessage = `*** Error in parsing source \"${src}\". ${err}`;
            this.logger.log(errorMessage);
            return errorMessage;
        }
    }

    registerTypes = (...arrArgs: Array<any>): GqlProvider => {
        arrArgs?.forEach((args: any) => this.types.push(args));
        return this;
    }

    registerResolveFunctions = (resolveFns: any) => {
        this.resolveFns = resolveFns;
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

    resolveFunc = async (fullFieldPath: string,
                         field: any, args: any, contextConst: any, contextVar: any): Promise<boolean>=> {
        const strInterim = fullFieldPath.split(Utils.pathDelim).join('_');
        const queryFn = this.resolveFns[`query_${strInterim}`]
        if (!_.isNil(queryFn)) {
            await this.typesCommon.resolveQuery(field, args, contextConst, contextVar, queryFn);
            return true;
        }

        const mutationFn = this.resolveFns[`mutation_${strInterim}`]
        if (!_.isNil(mutationFn)) {
            await this.typesCommon.resolveMutation(field, args, contextConst, contextVar, mutationFn);
            return true;
        }

        return false;
    }
}
