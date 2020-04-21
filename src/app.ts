import express from 'express';
import compression from 'compression';
import cors from 'cors';
import graphqlHTTP from 'express-graphql';
import { GqlProvider, FieldDescription } from './gqlProvider';
import { ExecutionArgs, GraphQLError } from 'graphql';
import { Logger } from './logger';
import { User, ChatMessage, Chat, Role } from './types';
import { TypesCommon } from './typesCommon';
import { sqlResolveFns, connectToSql } from './sqlServerResolveFuncs';
import { testResolveFns } from './testData';

export const logger = new Logger();
export const typesCommon = new TypesCommon(logger);

const isTestObjects = true;

(async function main() {
    const app = express();

    app.use('*', cors());
    app.use(compression());

    const gqlProvider = new GqlProvider(logger);

    app.use('/graphql', graphqlHTTP({
        schema: gqlProvider.schema,
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
                    await typesCommon.resolveFunc01(gqlProvider, field, args, contextConst, contextVar,
                        resolveFns.fetchData_user)
            },

            //-----------------------------------------------------------------------
            {
                fullFieldPath: 'myChats',
                type: Chat,
                resolveFunc: async (field, args, contextConst, contextVar) =>
                    await typesCommon.resolveFunc01(gqlProvider, field, args, contextConst, contextVar,
                        resolveFns.fetchData_myChats)
            },
            {
                fullFieldPath: 'myChats.participants',
                type: User,
                resolveFunc: async (field, args, contextConst, contextVar) =>
                    await typesCommon.resolveFunc01(gqlProvider, field, args, contextConst, contextVar,
                        resolveFns.fetchData_myChats_participants)
            },
            {
                fullFieldPath: 'myChats.messages',
                type: ChatMessage,
                resolveFunc: async (field, args, contextConst, contextVar) =>
                    await typesCommon.resolveFunc01(gqlProvider, field, args, contextConst, contextVar,
                        resolveFns.fetchData_myChats_messages)
            },
            {
                fullFieldPath: 'myChats.messages.author',
                type: User,
                resolveFunc: async (field, args, contextConst, contextVar) => {
                    const fieldName0 = field.arrPath[0];
                    const fieldName1 = field.arrPath[1];

                    const grandParents = gqlProvider.contextVar[`${fieldName0}-0`][fieldName0];
                    contextVar[`${fieldName1}_properties`] = ['text', 'author'];
                    contextVar[`${fieldName1}_array`] = new Array<any>();

                    for (let  k = 0; k < grandParents.length; k++)
                        await typesCommon.resolveFunc01(gqlProvider, field, args, contextConst, contextVar,
                            resolveFns.fetchData_myChats_messages_author);

                    TypesCommon.filterObject(fieldName1, contextVar);
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
  myChats {
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



