const graphql = require('graphql');
const { GraphQLObjectType, GraphQLSchema, GraphQLID } = graphql;
import {buildSchema, DocumentNode, ExecutionArgs, GraphQLError, GraphQLResolveInfo} from 'graphql';
import { parse } from 'graphql/language/parser';
import _ from 'lodash';
import { ILogger } from '../logger';
import { ValidationRule } from 'graphql/validation/ValidationContext';
import { GqlRequestHandler, Field, ContextMap, ResolvedFieldsMap } from './gqlRequestHandler';
import { GqlTypesCommon } from './gqlTypesCommon';
import { Utils } from './utils';
import graphqlHTTP from 'express-graphql';

export interface IGqlProvider {
    readonly types: Array<any>;
    readonly resolvedFields: ResolvedFieldsMap;
    readonly withSchema: boolean;
    findRegisteredType(typeName: string): any;
    resolveFunc(fullFieldPath: string, field: any, args: any, contextConst: any, contextVar: any): Promise<boolean>;
}

export type ResolverFn = (parent: any, args: any, context: any, info: GraphQLResolveInfo) => any;

export interface ResolverMap {
    [fieldName: string]: ResolverFn;
}

export class GqlProvider implements GqlProvider {
    static readonly maxHandlerId = 1000;

    readonly types = Array<any>();
    readonly resolvedFields: ResolvedFieldsMap = { };
    readonly contextConst: ContextMap = { };
    readonly typesCommon: GqlTypesCommon;

    schema: any;
    resolvers: ResolverMap = { };
    resolveFns: any;

    private currentHandlerId: number = 0;

    public withSchema = true;

    constructor(private logger: ILogger) {
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

    private validateFn = (schema: any, documentAST: DocumentNode, rules: ReadonlyArray<ValidationRule>) => true;

    private formatErrorFn = (error: GraphQLError) => this.logger.log(`*** Error: ${error}`);

    private executeFn = async (inboundObj: any): Promise<string> =>
        await new GqlRequestHandler(
                        this.newHandlerId(),
                        this,
                        this.contextConst,
                        this.logger)
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
        arrArgs?.forEach((type: any) => this.types.push(type));

        // Dummy schema generation
        const config = new GraphQLObjectType({name: 'Query'}).toConfig();
        config.fields['_'] = GqlProvider.createFreshDummyField();
        this.schema = new GraphQLSchema({query: new GraphQLObjectType(config)});

        this.withSchema = false;
        return this;
    }

    registerTypesAndCreateSchema = (...arrArgs: Array<any>): GqlProvider => {
        arrArgs?.forEach((type: any) => this.types.push(type));

        this.types.forEach((type: any) =>
            this.logger.log(`\n${type.type}\n${GqlRequestHandler.jsonStringifyFormatted(type)}`));

        this.schema = buildSchema(this.generateSchemaByRegisteredTypes());

        this.withSchema = true;
        return this;
    }

    private generateSchemaByRegisteredTypes = (): string => {
        //Not Implemented yet
        //TODO: add here schema generation based on this.types

            //
            // type Query {
            //     me: User!
            //     user(id: ID!): User
            //     allUsers: [User]
            //     search(term: String!): [SearchResult!]!
            //     personChats(personName: String!): [Chat!]!
            // }

        return `
            scalar Date
    
            schema {
                query: Query1           
            }
            
            type Query1 {
                personChats(personName: String!): [Chat!]!
                user(id: ID!): User
            }
                      
            enum Role {
                USER,
                ADMIN,
            }
            
            interface Common {
                id: Int!
            }
            
            union SearchResult = User | Chat | ChatMessage
            
            type User implements Common {
                id: Int!
                name: String!
                email: String!
                role: Role!
            }
            
            type Chat implements Common {
                id: Int!
                topic: String!
                participants: [User!]!
            }
            
            type ChatMessage implements Common {
                id: Int!
                text: String!
                time: Date!
                user: User!
                chat: Chat!
            }
        `;
    }

    registerResolveFunctions = (resolveFns: any) => {
        this.resolveFns = resolveFns;
        return this;
    }

    registerResolvedFields = (...arrArgs: Array<Field>): GqlProvider => {
        arrArgs?.forEach((field: any) => {
            this.resolvedFields[field.fullFieldPath] = field;

            this.resolvers[field.fullFieldPath] =
                    async (parent: any, args: any, context: any, info: GraphQLResolveInfo) =>
                        await this.executeFn(context.operation);
        });
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

    setGqlOptions = (): graphqlHTTP.Options => {
        const options: graphqlHTTP.Options = {
            schema: this.schema,
            graphiql: true,
            customFormatErrorFn: (error: GraphQLError) => this.formatErrorFn(error)
        };

        if (this.withSchema)
            options.rootValue = this.resolvers;
        else {
            options.customExecuteFn = async (args: ExecutionArgs): Promise<any> =>
                await this.executeFn(args.document.definitions[0]);

            options.customValidateFn =
                (schema, documentAST, validationRules): any =>
                    this.validateFn(schema, documentAST, validationRules);
        }

        return options;
    }
}
