import express from 'express';
import compression from 'compression';
import cors from 'cors';
import graphqlHTTP from 'express-graphql';
import { DocumentNode, ExecutionArgs, GraphQLError, Source } from 'graphql';
import { GqlTypesCommon } from './gql_infra/gqlTypesCommon';
import { Logger } from './logger';
import { GqlProvider } from './gql_infra/gqlProvider';
import { cachedResolveFns } from './resolve_funcs/cached/cachedDataResolveFuncs';
import { sqlResolveFns, connectToSql } from './resolve_funcs/sql/sqlServerResolveFuncs';
import { User, ChatMessage, Chat } from './types/types';
import bodyParser from 'body-parser';

const storage = process.env.GqlSchemalessServiceStorage;

export const logger = new Logger();
const gqlProvider = new GqlProvider(logger);
export const gqlTypesCommon = gqlProvider.typesCommon;

(async function main() {
    const server1 = express();

    server1.use('*', cors());
    server1.use(compression());

    server1.use('/graphql', graphqlHTTP({
        schema: gqlProvider.schema,  // schema stub
        graphiql: true,

        customParseFn: (source: Source): DocumentNode =>
            gqlProvider.parseFn(source.body),

        customExecuteFn: async (args: ExecutionArgs): Promise<any> =>
            await gqlProvider.executeFn(args.document.definitions[0]),

        customValidateFn: (schema, documentAST, validationRules): any =>
            gqlProvider.validateFn(schema, documentAST, validationRules),

        customFormatErrorFn: (error: GraphQLError) =>
            gqlProvider.formatErrorFn(error),
    }));

    let port1 = 3000;
    let address1 = `http://localhost:${port1}/graphql`;

    try {
        await server1.listen(port1);
        logger.log(`\n--- GraphQL schemaless service is listening on ${address1}`);
    }
    catch (err) {
        logger.log(`\n*** Error to listen on ${address1}. ${err}`)
    }

    let resolveFns: any;
    switch (storage) {
        case "SqlServer":
            resolveFns = sqlResolveFns;
            gqlProvider.contextConst['sql'] = await connectToSql(logger);
            break;
        default:
            resolveFns = cachedResolveFns;
            break;
    }

    // Settings for gqlProvider.
    // Placed after start listening for test purposes.
    gqlProvider
        .registerTypes(User, ChatMessage, Chat)
        .registerResolveFunctions(resolveFns)
        .registerResolvedFields(
            //-- user ---------------------------------------------------------------
            {
                fullFieldPath: 'user',
                type: User, // required for topmost fields only
            },

            //-- personChats --------------------------------------------------------
            {
                fullFieldPath: 'personChats',
                type: [Chat], // required for topmost fields only
            },
            {
                fullFieldPath: 'personChats.messages',
                resolveFunc: async (field, args, contextConst, contextVar) => {
                    const filterArgs = field.children.map((c: any) => c.fieldName);
                    GqlTypesCommon.setFilter(field.fieldName, filterArgs, contextVar);

                    await gqlProvider.resolveFunc('personChats.messages',
                                                 field, args, contextConst, contextVar);
                }
            },
            {
                fullFieldPath: 'personChats.messages.author',
                resolveFunc: async (field, args, contextConst, contextVar) => {
                    const fieldName = field.arrPath[1];

                    await gqlProvider.resolveFunc('personChats.messages.author',
                                                          field, args, contextConst, contextVar);

                    GqlTypesCommon.applyFilter(fieldName, contextVar);
                }
            },

            //-- addMessaqe ---------------------------------------------------------
            {
                fullFieldPath: 'addMessage',
                type: ChatMessage, // required for topmost fields only
            },

            //-----------------------------------------------------------------------
        );


    // Process source string

    const src = `
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
        `;

    const output = await gqlProvider.processSource(src);


    // REST Server Processes GQL query as Plain Text

    const server2 = express();
    server2.use(bodyParser.urlencoded({ extended: true }));
    server2.use(bodyParser.json());
    server2.use(bodyParser.raw());
    server2.use(bodyParser.text());

    server2.use('*', cors());
    server2.use(compression());

    const port2 = 4000;
    const address2 = `http://localhost:${port2}`;

    server2.post('/', async (req: any, res: any) => {
        let output = 'No result';
        if (req.headers['content-type'] === 'text/plain')
            output = await gqlProvider.processSource(req.body);

        res.send(output);
    });

    try {
        await server2.listen(port2);
        logger.log(`\n--- Server2 is listening on ${address2}`);
    }
    catch (err) {
        logger.log(`\n*** Error to listen on ${address2}. ${err}`)
    }

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



