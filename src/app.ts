import express from 'express';
import compression from 'compression';
import cors from 'cors';
import graphqlHTTP from 'express-graphql';
import { ExecutionArgs, GraphQLError } from 'graphql';
import { Logger } from './logger';
import { GqlProvider } from './gql_infra/gqlProvider';
import { User, ChatMessage, Chat } from './types/types';
import { GqlTypesCommon } from './gql_infra/gqlTypesCommon';
import { cachedResolveFns } from './resolve_funcs/cached/cachedDataResolveFuncs';
import { sqlResolveFns, connectToSql } from './resolve_funcs/sql/sqlServerResolveFuncs';

const isCachedObjects = true;  // false - to use SQL Server

export const logger = new Logger();
const gqlProvider = new GqlProvider(logger);
export const gqlTypesCommon = new GqlTypesCommon(gqlProvider, logger);

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
    if (isCachedObjects)
        resolveFns = cachedResolveFns;
    else {
        resolveFns = sqlResolveFns;
        gqlProvider.contextConst['sql'] = await connectToSql(logger);
    }

    // Settings for gqlProvider.
    // Placed after start listening for test purposes.
    gqlProvider
        .registerTypes(User, ChatMessage, Chat)
        .registerResolvedFields(
            //-- user ---------------------------------------------------------------
            {
                fullFieldPath: 'user',
                type: User, // required for topmost fields only
                resolveFunc: async (field, args, contextConst, contextVar) =>
                    await gqlTypesCommon.resolveQuery(field, args, contextConst, contextVar,
                                                      resolveFns.query_user)
            },

            //-- personChats --------------------------------------------------------
            {
                fullFieldPath: 'personChats',
                type: [Chat], // required for topmost fields only
                resolveFunc: async (field, args, contextConst, contextVar) =>
                    await gqlTypesCommon.resolveQuery(field, args, contextConst, contextVar,
                                                      resolveFns.query_personChats)
            },
            {
                fullFieldPath: 'personChats.participants',
                resolveFunc: async (field, args, contextConst, contextVar) =>
                    await gqlTypesCommon.resolveQuery(field, args, contextConst, contextVar,
                                                      resolveFns.query_personChats_participants)
            },
            {
                fullFieldPath: 'personChats.messages',
                resolveFunc: async (field, args, contextConst, contextVar) => {
                    const filterArgs = field.children.map((c: any) => c.fieldName);
                    GqlTypesCommon.setFilter(field.fieldName, filterArgs, contextVar);

                    await gqlTypesCommon.resolveQuery(field, args, contextConst, contextVar,
                                                      resolveFns.query_personChats_messages);
                }
            },
            {
                fullFieldPath: 'personChats.messages.author',
                resolveFunc: async (field, args, contextConst, contextVar) => {
                    const fieldName = field.arrPath[1];

                    await gqlTypesCommon.resolveQuery(field, args, contextConst, contextVar,
                                                      resolveFns.query_personChats_messages_author);

                    GqlTypesCommon.applyFilter(fieldName, contextVar);
                }
            },

            //-- addMessaqe ---------------------------------------------------------
            {
                fullFieldPath: 'addMessage',
                type: ChatMessage, // required for topmost fields only
                resolveFunc: async (field, args, contextConst, contextVar) =>
                    await gqlTypesCommon.resolveMutation(field, args, contextConst, contextVar,
                                                         resolveFns.mutation_dummy)
            },

            //-----------------------------------------------------------------------
        );
})();


/* Requests

query TheQuery {
  personChats(personName: "Rachel") {
    id
    topic
    participants {
      name
      email
    }
    messages {
      author {
        name
       	role
      }
      text
      time
    }
  }

  user(id: 1) {
    name
    email
    role
  }
}

mutation TheMutation {
  addMessage(
    chat: "topic2",
    text: "some text",
    time: "2020-04-10"
    author: "Zeev"
  )
}

*/



