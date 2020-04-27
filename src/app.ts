import express from 'express';
import compression from 'compression';
import cors from 'cors';
import graphqlHTTP from 'express-graphql';
import { GqlProvider, FieldDescription } from './gql_infra/gqlProvider';
import { ExecutionArgs, GraphQLError } from 'graphql';
import { Logger } from './logger';
import { User, ChatMessage, Chat, Role } from './types/types';
import { TypesCommon } from './gql_infra/typesCommon';
import { sqlResolveFns, connectToSql } from './resolve_funcs/sql/sqlServerResolveFuncs';
import { testResolveFns } from './resolve_funcs/cached/cachedDataResolveFuncs';

const isTestObjects = true;  // false - to use SQL Server

export const logger = new Logger();
const gqlProvider = new GqlProvider(logger);
export const typesCommon = new TypesCommon(gqlProvider, logger);

(async function main() {
    const app = express();

    app.use('*', cors());
    app.use(compression());

    app.use('/graphql', graphqlHTTP({
        schema: gqlProvider.schema,  // schema stub
        graphiql: true,

        customExecuteFn: async (args: ExecutionArgs): Promise<any> =>
            await gqlProvider.executeFn(args.document.definitions[0]),

        customValidateFn: (schema, documentAST, validationRules): any =>
            gqlProvider.validateFn(schema, documentAST, validationRules),

        customFormatErrorFn: (error: GraphQLError) =>
            gqlProvider.formatErrorFn(error),
    }));

    let port = 3000;
    let address = `http://localhost:${port}/graphql`;

    try {
        await app.listen(port);
        logger.log(`\n--- GraphQL schemaless service is listening on ${address}`);
    } catch (err) {
        logger.log(`\n*** Error to listen on ${address}. ${err}`)
    }

    let resolveFns: any;
    if (isTestObjects)
        resolveFns = testResolveFns;
    else {
        resolveFns = sqlResolveFns;
        gqlProvider.contextConst['sql'] = await connectToSql(logger);
    }

    // Settings for gqlProvider.
    // Placed after start listening for test purposes.
    gqlProvider
        .registerTypes(User, ChatMessage, Chat)
        .registerResolvedFields(
    {
                fullFieldPath: 'user',
                type: User,
                resolveFunc: async (field, args, contextConst, contextVar) =>
                    await typesCommon.resolveFunc(field, args, contextConst, contextVar,
                        resolveFns.fetchData_user)
            },

            //-----------------------------------------------------------------------
            {
                fullFieldPath: 'personChats',
                type: Chat,
                resolveFunc: async (field, args, contextConst, contextVar) =>
                    await typesCommon.resolveFunc(field, args, contextConst, contextVar,
                        resolveFns.fetchData_personChats)
            },
            {
                fullFieldPath: 'personChats.participants',
                type: User,
                resolveFunc: async (field, args, contextConst, contextVar) =>
                    await typesCommon.resolveFunc(field, args, contextConst, contextVar,
                        resolveFns.fetchData_personChats_participants)
            },
            {
                fullFieldPath: 'personChats.messages',
                type: ChatMessage,
                resolveFunc: async (field, args, contextConst, contextVar) => {
                    const filterArgs = field.children.map((c: any) => c.fieldName);
                    TypesCommon.setFilter(field.fieldName, filterArgs, contextVar);

                    await typesCommon.resolveFunc(field, args, contextConst, contextVar,
                        resolveFns.fetchData_personChats_messages);
                }
            },
            {
                fullFieldPath: 'personChats.messages.author',
                type: User,
                resolveFunc: async (field, args, contextConst, contextVar) => {
                    const fieldName = field.arrPath[1];

                    await typesCommon.resolveFunc(field, args, contextConst, contextVar,
                        resolveFns.fetchData_personChats_messages_author);

                    TypesCommon.applyFilter(fieldName, contextVar);
                }
            }
            //-----------------------------------------------------------------------
        );
})();


/* Queries

query {
  user(id: 1) {
    name
    id
  }
}

query {
  personChats(personName: "Rachel") {
    id
    participants {
        name
    }
    messages {
        author {
            name
        }
        text
    }
  }
}

*/



