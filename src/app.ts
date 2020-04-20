import express from 'express';
import compression from 'compression';
import cors from 'cors';
import _ from 'lodash';
import graphqlHTTP from 'express-graphql';
import { GqlProvider, FieldDescription } from './gqlProvider';
import { ExecutionArgs, GraphQLError } from 'graphql';
import { ILogger, Logger } from './logger';
import { User, ChatMessage, Chat, Role } from './types';
import { SqlServerProvider } from './sqlServerProvider';
import {TypesCommon} from './typesCommon';

export const logger = new Logger();
export const typesCommon = new TypesCommon(logger);

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
    }
    catch (err) {
        logger.log(`\n*** Error to listen on ${address}. ${err}`)
    }

    gqlProvider.contextConst['sql'] = await connectToSql(logger);

    // Settings for gqlProvider.
    // Placed after start listening for test purposes.
    gqlProvider
        .registerTypes(User, ChatMessage, Chat)
        .registerResolvedFields(
    {
                fullFieldPath: 'user',
                type: User,
                resolveFunc: async (field, args, contextConst, contextVar) => {
                    const query = `SELECT id, name, email FROM Users WHERE id = ${args.id}`;
                    await typesCommon.resolveFunc0(field, query, contextConst, contextVar);
                }
            },

            //-----------------------------------------------------------------------
            {
                fullFieldPath: 'myChats',
                type: Chat,
                resolveFunc: async (field, args, contextConst, contextVar) => {
                    const query = `
                        SELECT id, topic FROM Chats WHERE id in
                            (SELECT chatId FROM Participants WHERE userId in
                                (SELECT id FROM Users WHERE name = 'Rachel'))`;
                    await typesCommon.resolveFunc0(field, query, contextConst, contextVar);
                }
            },
            {
                fullFieldPath: 'myChats.participants',
                type: User,
                resolveFunc: async (field, args, contextConst, contextVar) => {
                    const query =
                        'SELECT * FROM Users WHERE id in' +
                            '(SELECT userId FROM Participants WHERE chatId = ${parent.id})';
                    contextVar['User_properties'] = ['name', 'email'];
                    await typesCommon.resolveFunc1(gqlProvider, field, query, args, contextConst, contextVar);
                }
            },
            {
                fullFieldPath: 'myChats.messages',
                type: ChatMessage,
                resolveFunc: async (field, args, contextConst, contextVar) => {
                    const query = 'SELECT id, text, authorId FROM ChatMessages WHERE chatId = ${parent.id}';
                    contextVar['ChatMessage_properties'] = ['text', 'authorId'];
                    await typesCommon.resolveFunc1(gqlProvider, field, query, args, contextConst, contextVar);
                }
            },
            {
                fullFieldPath: 'myChats.messages.author',
                type: User,
                resolveFunc: async (field, args, contextConst, contextVar) => {
                    console.log('resolveFunc for myChats.messages.author');
                    const grandParents = gqlProvider.contextVar['myChats-0']['myChats'];
                    contextVar['User_properties'] = ['name'];
                    const query = 'SELECT * FROM Users WHERE id = ${parent.authorId}';
                    for (let  k = 0; k < grandParents.length; k++)
                        await typesCommon.resolveFunc1(gqlProvider, field, query, args, contextConst, contextVar);
                }
            }
            //-----------------------------------------------------------------------
        );
})();

async function connectToSql (logger: ILogger): Promise<any> {
    const server = 'IGORMAIN\\MSSQLSERVER01';
    const database = 'ChatsDb';
    let sql = new SqlServerProvider({server, database}, logger);
    try {
        await sql.connect();
    }
    catch (err) {
        logger.log(err);
        logger.log(`*** Error in connection to database {server: \"${server}\", database: ${database}. ${err}`);
        return false;
    }

    return sql;
}

// Test Data ------------------------------------------------------------------------------------
// export const users = [
//     { type: 'User', id: 0, name: 'Julius Verne', email: 'jv@MysteriousIsland.com', role: Role.Admin },
//     { type: 'User', id: 1, name: 'Cyrus Smith', email: 'cs@MysteriousIsland.com', role: Role.User },
//     { type: 'User', id: 2, name: 'Gedeon Spilett', email: 'gs@MysteriousIsland.com', role: Role.User },
// ];
//
// export const chatMessages = [
//     { type: 'ChatMessage', id: 0, content: 'aaaaaaa', time: Date.parse('2020-04-07'), author: users[0] },
//     { type: 'ChatMessage', id: 1, content: 'bbbbbbb', time: Date.parse('2020-04-07'), author: users[1] },
//     { type: 'ChatMessage', id: 2, content: 'ccccccc', time: Date.parse('2020-04-07'), author: users[0] },
//     { type: 'ChatMessage', id: 3, content: 'ddddddd', time: Date.parse('2020-04-07'), author: users[0] },
//     { type: 'ChatMessage', id: 4, content: 'eeeeeee', time: Date.parse('2020-04-07'), author: users[2] },
// ];
//
// export const chats = [
//     { type: 'Chat', id: 0, participants: [users[0], users[1], users[2]], messages: [chatMessages[0], chatMessages[1]] },
//     { type: 'Chat', id: 1, participants: [users[1], users[0]], messages: [chatMessages[1], chatMessages[2], chatMessages[3]] },
//     { type: 'Chat', id: 2, participants: [users[0], users[1]], messages: [chatMessages[4], chatMessages[1]] },
//     { type: 'Chat', id: 3, participants: [users[2], users[0]], messages: [chatMessages[4], chatMessages[1], chatMessages[2]] },
// ];
// -----------------------------------------------------------------------------------------

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



