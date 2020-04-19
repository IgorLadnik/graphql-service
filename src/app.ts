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
                resolveFunc: async (actionTree, args, contextConst, contextVar) => {
                    const query = `SELECT id, name, email FROM Users WHERE id = ${args.id}`;
                    await typesCommon.resolveFunc0('user', query, contextConst, contextVar);
                }
            },

            //-----------------------------------------------------------------------
            {
                fullFieldPath: 'myChats',
                type: Chat,
                resolveFunc: async (actionTree, args, contextConst, contextVar) => {
                    const query = `
                        SELECT id, topic FROM Chats WHERE id in
                            (SELECT chatId FROM Participants WHERE userId in
                                (SELECT id FROM Users WHERE name = 'Rachel'))`;
                    await typesCommon.resolveFunc0('myChats', query, contextConst, contextVar);
                }
            },
            {
                fullFieldPath: 'myChats.participants',
                type: User,
                resolveFunc: async (actionTree, args, contextConst, contextVar) => {
                    logger.log('resolveFunc for myChats.participants');
                    const sql = gqlProvider.contextConst['sql'];
                    const parents = gqlProvider.contextVar['myChats'];
                    contextVar['User_properties'] = ['name'];
                    for (let  i = 0; i < parents.length; i++) {
                        const parent = parents[i];
                        const rs = await sql.query(`
                                        SELECT * FROM Users WHERE id in 
                                            (SELECT userId FROM Participants WHERE chatId = ${parent.id})
                        `);

                        parent['participants'] = new Array<any>();
                        rs.forEach((item: any) => {
                            contextVar['User_data'] = item;
                            User.resolveFunc(actionTree, args, contextConst, contextVar);
                            parent['participants'].push(contextVar['User_data']);
                        });
                    }
                }
            },
            {
                fullFieldPath: 'myChats.messages',
                type: ChatMessage,
                resolveFunc: async (actionTree, args, contextConst, contextVar) => {
                    logger.log('resolveFunc for myChats.messages');
                    const sql = gqlProvider.contextConst['sql'];
                    const parents = gqlProvider.contextVar['myChats'];
                    contextVar['ChatMessage_properties'] = ['text', 'authorId'];
                    for (let  i = 0; i < parents.length; i++) {
                        const parent = parents[i];
                        const rs = await sql.query(`                                                                                                   
                                 SELECT id, text, authorId FROM ChatMessages WHERE chatId = ${parent.id}               
                            `);

                        parent['messages'] = new Array<any>();
                        rs.forEach((item: any) => {
                            contextVar['ChatMessage_data'] = item;
                            ChatMessage.resolveFunc(actionTree, args, contextConst, contextVar);
                            const result = contextVar['ChatMessage_data'];
                            parent['messages'].push(result);
                        });
                    }
                }
            },
            {
                fullFieldPath: 'myChats.messages.author',
                type: User,
                resolveFunc: async (actionTree, args, contextConst, contextVar) => {
                    console.log('resolveFunc for myChats.messages.author');
                    const sql = gqlProvider.contextConst['sql'];
                    const grandParents = gqlProvider.contextVar['myChats'];
                    contextVar['User_properties'] = ['name'];
                    for (let  k = 0; k < grandParents.length; k++) {
                        const parents = grandParents[k].messages;
                        for (let  i = 0; i < parents.length; i++) {
                            const parent = parents[i];
                            const rs = await sql.query(`                                                                                                   
                                SELECT id, name FROM Users WHERE id = ${parent.authorId}               
                            `);

                            delete parent.authorId;

                            rs.forEach((item: any) => {
                                contextVar['User_data'] = item;
                                User.resolveFunc(actionTree, args, contextConst, contextVar);
                                const result = contextVar['User_data'];
                                parent['author'] = result;
                            });
                        }
                    }
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



